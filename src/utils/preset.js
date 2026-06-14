// utils/preset.js
import {
    stateToDiff,
    diffToState,
    FIELD_BY_ALIAS,
    FIELD_BY_IDX,
} from "./presetSchema";

const VERSION = 1;

// ─── Base64url sin dependencias externas ──────────────────────────────────

function toBase64url(bytes) {
    // bytes = Uint8Array o Array de números
    const bin = String.fromCharCode(...bytes);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64url(str) {
    try {
        const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
        return Uint8Array.from(bin, (c) => c.charCodeAt(0));
    } catch {
        return null;
    }
}

// ─── Escritura de bytes tipados ───────────────────────────────────────────

function writeField(bytes, alias, value) {
    const field = FIELD_BY_ALIAS[alias];
    if (!field) return;

    const { idx, type, meta } = field;
    bytes.push(idx);

    switch (type) {
        case "b":
            bytes.push(value ? 1 : 0);
            break;

        case "f2": {
            const v = Math.max(
                -32768,
                Math.min(32767, Math.round(value * 100)),
            );
            bytes.push((v >> 8) & 0xff, v & 0xff);
            break;
        }

        case "u8":
            bytes.push(Math.round(value) & 0xff);
            break;

        case "e":
            bytes.push(meta.indexOf(value) & 0xff);
            break;

        case "hex": {
            const h = value.replace("#", "").toUpperCase();
            bytes.push(
                parseInt(h.slice(0, 2), 16),
                parseInt(h.slice(2, 4), 16),
                parseInt(h.slice(4, 6), 16),
            );
            break;
        }

        case "hsl": {
            // "hsl(H S% L% / 1)"  →  3 bytes: h÷2 (0-180), s (0-100), l (0-100)
            const m = value.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%/);
            if (m) {
                bytes.push(
                    Math.round(parseInt(m[1]) / 2),
                    parseInt(m[2]),
                    parseInt(m[3]),
                );
            } else {
                bytes.push(0, 0, 0);
            }
            break;
        }
    }
}

// ─── Lectura de bytes tipados ─────────────────────────────────────────────

function readField(bytes, cursor) {
    if (cursor >= bytes.length) throw new Error("Buffer agotado");
    const idx = bytes[cursor++];
    if (idx === undefined) throw new Error("Buffer agotado leyendo field id");
    const field = FIELD_BY_IDX[idx];
    if (!field) throw new Error(`Campo desconocido en índice ${idx}`);

    const [alias, type, meta] = field;
    let value;

    switch (type) {
        case "b":
            value = bytes[cursor++] === 1;
            break;

        case "f2": {
            let v = (bytes[cursor++] << 8) | bytes[cursor++];
            if (v > 32767) v -= 65536; // complemento a dos para negativos
            value = v / 100;
            break;
        }

        case "u8":
            value = bytes[cursor++];
            break;

        case "e":
            value = meta[bytes[cursor++]];
            break;

        case "hex": {
            const r = bytes[cursor++],
                g = bytes[cursor++],
                b = bytes[cursor++];
            value =
                "#" +
                [r, g, b]
                    .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
                    .join("");
            break;
        }

        case "hsl": {
            const h = bytes[cursor++] * 2;
            const s = bytes[cursor++];
            const l = bytes[cursor++];
            value = `hsl(${h} ${s}% ${l}% / 1)`;
            break;
        }
    }

    return { alias, value, cursor };
}

// ─── API pública ──────────────────────────────────────────────────────────

/**
 * Codifica el estado en un string binario compacto para la URL.
 * Retorna null si no hay diferencias con el estado por defecto.
 */
export function encodePreset(settings) {
    try {
        const diff = stateToDiff(settings);
        const entries = Object.entries(diff);

        if (entries.length === 0) return null;

        const bytes = [VERSION, entries.length];

        for (const [alias, value] of entries) {
            writeField(bytes, alias, value);
        }

        return toBase64url(bytes);
    } catch (e) {
        console.error("Error encoding preset:", e);
        return null;
    }
}

/**
 * Decodifica un string de la URL y retorna el estado completo
 * (diff aplicado sobre los defaults).
 * Retorna null si el preset es inválido o de versión incompatible.
 */
export function decodePreset(str) {
    try {
        const bytes = fromBase64url(str);
        if (!bytes) return null;

        let cursor = 0;
        const version = bytes[cursor++];

        if (version !== VERSION) {
            console.warn(`Preset versión ${version} desconocida, ignorando`);
            return null;
        }

        const count = bytes[cursor++];
        const diff = {};

        for (let i = 0; i < count; i++) {
            const result = readField(bytes, cursor);
            diff[result.alias] = result.value;
            cursor = result.cursor;
        }

        return diffToState(diff);
    } catch (e) {
        console.error("Error decoding preset:", e);
        return null;
    }
}

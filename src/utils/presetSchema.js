// utils/presetSchema.js
import { defaultSettings } from "./renderSettings";

/**
 * Definición de todos los campos serializables.
 * El ÍNDICE de cada campo en este array es su ID binario — nunca reordenar.
 * Para añadir campos nuevos: push al final únicamente.
 *
 * Tipos:
 *   "f2"  — float guardado como int16 ×100  (rango −327.67 a 327.67, precisión 0.01)
 *   "u8"  — entero sin signo 0-255
 *   "b"   — boolean (1 byte)
 *   "e"   — enum string (1 byte = índice en array de opciones)
 *   "hex" — color "#RRGGBB" (3 bytes)
 *   "hsl" — color "hsl(H S% L% / 1)" (3 bytes: h/2, s, l)
 */
export const FIELDS = [
  // camera
  /* 00 */ ["ct",  "f2"],
  /* 01 */ ["cp",  "f2"],
  /* 02 */ ["cr",  "f2"],
  /* 03 */ ["cf",  "f2"],

  // model
  /* 04 */ ["ms",  "f2"],
  /* 05 */ ["mpx", "f2"],
  /* 06 */ ["mpy", "f2"],
  /* 07 */ ["mpz", "f2"],
  /* 08 */ ["mrx", "f2"],
  /* 09 */ ["mry", "f2"],
  /* 10 */ ["mrz", "f2"],
  /* 11 */ ["mtf", "f2"],
  /* 12 */ ["mtl", "f2"],
  /* 13 */ ["ma",  "b"],
  /* 14 */ ["mas", "f2"],

  // lights
  /* 15 */ ["la",  "f2"],
  /* 16 */ ["l1i", "f2"],
  /* 17 */ ["l1x", "f2"],
  /* 18 */ ["l1y", "f2"],
  /* 19 */ ["l1z", "f2"],
  /* 20 */ ["l2i", "f2"],
  /* 21 */ ["l2x", "f2"],
  /* 22 */ ["l2y", "f2"],
  /* 23 */ ["l2z", "f2"],

  // ascii
  /* 24 */ ["as",  "e", ["standard", "blocks", "shade", "thin", "dots"]],
  /* 25 */ ["ac",  "u8"],
  /* 26 */ ["ai",  "b"],
  /* 27 */ ["ao",  "b"],
  /* 28 */ ["av",  "b"],
  /* 29 */ ["asi", "f2"],
  /* 30 */ ["ag",  "b"],
  /* 31 */ ["agi", "f2"],
  /* 32 */ ["ags", "u8"],
  /* 33 */ ["at",  "hex"],

  // postfx
  /* 34 */ ["pc",  "f2"],
  /* 35 */ ["pb",  "f2"],

  // ui
  /* 36 */ ["ua",  "hsl"],
];

// Lookup por alias → { idx, type, meta? }
export const FIELD_BY_ALIAS = Object.fromEntries(
  FIELDS.map(([alias, type, meta], idx) => [alias, { idx, type, meta }])
);

// Lookup por índice → [alias, type, meta?]
export const FIELD_BY_IDX = Object.fromEntries(
  FIELDS.map((f, i) => [i, f])
);

// ─── Alias map para el diff (igual que antes) ─────────────────────────────

export const ALIAS_MAP = {
  "camera.orbit.theta":              "ct",
  "camera.orbit.phi":                "cp",
  "camera.orbit.radius":             "cr",
  "camera.fov":                      "cf",
  "model.scale":                     "ms",
  "model.position.x":                "mpx",
  "model.position.y":                "mpy",
  "model.position.z":                "mpz",
  "model.rotation.x":                "mrx",
  "model.rotation.y":                "mry",
  "model.rotation.z":                "mrz",
  "model.tilt.forward":              "mtf",
  "model.tilt.left":                 "mtl",
  "model.autoRotate":                "ma",
  "model.autoRotateSpeed":           "mas",
  "lights.ambient":                  "la",
  "lights.directional1.intensity":   "l1i",
  "lights.directional1.position.0":  "l1x",
  "lights.directional1.position.1":  "l1y",
  "lights.directional1.position.2":  "l1z",
  "lights.directional2.intensity":   "l2i",
  "lights.directional2.position.0":  "l2x",
  "lights.directional2.position.1":  "l2y",
  "lights.directional2.position.2":  "l2z",
  "ascii.style":                     "as",
  "ascii.cellSize":                  "ac",
  "ascii.invert":                    "ai",
  "ascii.color":                     "ao",
  "ascii.volumeShading":             "av",
  "ascii.shadingIntensity":          "asi",
  "ascii.glow":                      "ag",
  "ascii.glowIntensity":             "agi",
  "ascii.glowSize":                  "ags",
  "ascii.tintColor":                 "at",
  "postfx.contrastAdjust":           "pc",
  "postfx.brightnessAdjust":         "pb",
  "ui.accentColor":                  "ua",
};

export const ALIAS_REVERSE = Object.fromEntries(
  Object.entries(ALIAS_MAP).map(([path, alias]) => [alias, path])
);

// ─── Helpers ──────────────────────────────────────────────────────────────

function roundFloat(v) {
  return typeof v === "number" && !Number.isInteger(v)
    ? Math.round(v * 100) / 100
    : v;
}

function getNestedValue(obj, pathParts) {
  return pathParts.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setNestedValue(obj, pathParts, value) {
  let cursor = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const key = pathParts[i];
    cursor[key] = Array.isArray(cursor[key])
      ? [...cursor[key]]
      : { ...cursor[key] };
    cursor = cursor[key];
  }
  cursor[pathParts[pathParts.length - 1]] = value;
}

// ─── API pública ──────────────────────────────────────────────────────────

export function stateToDiff(settings) {
  const diff = {};

  for (const [path, alias] of Object.entries(ALIAS_MAP)) {
    const pathParts = path.split(".").map((p) => (isNaN(Number(p)) ? p : Number(p)));
    const current  = roundFloat(getNestedValue(settings, pathParts));
    const defaults = roundFloat(getNestedValue(defaultSettings, pathParts));

    if (JSON.stringify(current) !== JSON.stringify(defaults)) {
      diff[alias] = current;
    }
  }

  return diff;
}

export function diffToState(diff) {
  const result = JSON.parse(JSON.stringify(defaultSettings));

  for (const [alias, value] of Object.entries(diff)) {
    const path = ALIAS_REVERSE[alias];
    if (!path) continue;
    const pathParts = path.split(".").map((p) => (isNaN(Number(p)) ? p : Number(p)));
    setNestedValue(result, pathParts, value);
  }

  return result;
}
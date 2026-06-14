import { useMemo } from "react";
import { decodePreset } from "./utils/preset.js";
import { defaultSettings } from "./utils/renderSettings.js";
import AsthreeScene from "./core/AsthreeScene.jsx";

/**
 * @param {string}  [preset]      - Código de preset generado por el editor
 * @param {object}  [settings]    - Objeto de settings directamente (alternativa al preset)
 * @param {string}  [model]       - Ruta al archivo .glb del modelo
 * @param {string}  [width]       - Ancho del canvas (default "100%")
 * @param {string}  [height]      - Alto del canvas (default "100%")
 * @param {boolean} [enableOrbit] - Permitir rotar el modelo con el ratón
 * @param {boolean} [enableZoom]  - Permitir zoom con la rueda del ratón
 */
export function AsthreeRender({
    preset,
    settings,
    hdr = "/hdr/studio.hdr",
    model = "/models/model.glb",
    width = "100%",
    height = "100%",
    enableOrbit = true,
    enableZoom = true,
}) {
    const resolvedSettings = useMemo(() => {
        if (preset) {
            const decoded = decodePreset(preset);
            if (decoded) return decoded;
        }
        if (settings) return { ...defaultSettings, ...settings };
        return defaultSettings;
    }, [preset, settings]);

    return (
        <AsthreeScene
            settings={resolvedSettings}
            model={model}
            hdr={hdr}
            width={width}
            height={height}
            enableOrbit={enableOrbit}
            enableZoom={enableZoom}
        />
    );
}
export const defaultSettings = {
    camera: {
        position: { x: 0, y: 0, z: 5 },
        target: { x: 0, y: 0, z: 0 },
        fov: 50,
        orbit: {
            theta: 0, // horizontal (izq/der)
            phi: 1.5, // vertical (arriba/abajo)
            radius: 4.5, // distancia
        },
    },

    model: {
        scale: 2,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        tilt: { forward: 0, left: 0 },
        autoRotate: true,
        autoRotateSpeed: 0.2,
    },

    lights: {
        ambient: 0,
        directional1: {
            position: [2, 3.5, 6],
            intensity: 3,
        },
        directional2: {
            position: [-2, 1.5, 4],
            intensity: 0.35,
        },
    },

    ascii: {
        style: "standard",
        cellSize: 9,
        invert: true,
        color: true,
        volumeShading: true,
        shadingIntensity: 0.5,
        glow: true,
        glowIntensity: 7,
        glowSize: 3,
        tintColor: "#6B51F0",
    },

    postfx: {
        contrastAdjust: 1.5,
        brightnessAdjust: 0.2,
    },
};
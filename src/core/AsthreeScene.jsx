import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { Environment } from "@react-three/drei";
import { Vector2 } from "three";
import { AsthreeEffect } from "./AsthreeEffect.jsx";
import AsthreeModel from "./AsthreeModel.jsx";
import CameraController from "./CameraController.jsx";

function SceneContent({ settings, modelPath, resolution }) {
    const { gl } = useThree();
    const [composerReady, setComposerReady] = useState(false);
    const frameCount = useRef(0);
    const { lights } = settings;

    useFrame(() => {
        frameCount.current++;
        if (frameCount.current >= 3 && !composerReady) {
            const t = setTimeout(() => {
                try {
                    const context = gl.getContext();
                    if (context && !context.isContextLost?.()) {
                        setComposerReady(true);
                    }
                } catch (e) {}
            }, 100);
            return () => clearTimeout(t);
        }
    });

    return (
        <>
            <Environment files="/hdr/studio.hdr" background={false} />
            <ambientLight intensity={lights.ambient} />
            <directionalLight
                position={lights.directional1.position}
                intensity={lights.directional1.intensity}
            />
            <directionalLight
                position={lights.directional2.position}
                intensity={lights.directional2.intensity}
            />
            <Suspense fallback={null}>
                <AsthreeModel settings={settings} modelPath={modelPath} />
            </Suspense>
            {composerReady && (
                <EffectComposer>
                    <AsthreeEffect
                        settings={settings}
                        characterSet="terminal"
                        resolution={resolution}
                    />
                </EffectComposer>
            )}
        </>
    );
}

export default function AsthreeScene({
    settings,
    modelPath,
    width = "100%",
    height = "100%",
    enableOrbit = true,
    enableZoom = true,
}) {
    const containerRef = useRef(null);
    const [mousePos] = useState(() => new Vector2(0, 0));
    const [resolution] = useState(() => new Vector2(1920, 1080));
    const { ascii } = settings;

    const sizeFactor = Math.pow(ascii.glowSize / 2, 1.2);
    const blurBig    = 10 * sizeFactor;
    const blurSmall  = 5 * sizeFactor;
    const normalized = (ascii.glowIntensity - 1) / 9;
    const alpha = Math.round(179 * normalized).toString(16).padStart(2, "0").toUpperCase();

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateResolution = () => {
            const rect = container.getBoundingClientRect();
            const dpr  = window.devicePixelRatio || 1;
            resolution.set((rect.width || 1920) * dpr, (rect.height || 1080) * dpr);
        };

        const handleMouseMove = (e) => {
            const rect = container.getBoundingClientRect();
            mousePos.set(e.clientX - rect.left, rect.height - (e.clientY - rect.top));
        };

        updateResolution();
        const ro = new ResizeObserver(updateResolution);
        ro.observe(container);
        container.addEventListener("mousemove", handleMouseMove);

        return () => {
            ro.disconnect();
            container.removeEventListener("mousemove", handleMouseMove);
        };
    }, [mousePos, resolution]);

    return (
        <div
            ref={containerRef}
            style={{ width, height, cursor: enableOrbit ? "grab" : "default" }}
        >
            <Canvas
                style={{
                    filter: ascii.glow
                        ? `drop-shadow(${ascii.tintColor}${alpha} 0px 0px ${blurBig}px) drop-shadow(${ascii.tintColor}${alpha} 0px 0px ${blurSmall}px)`
                        : "none",
                }}
                dpr={Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 1.5)}
                camera={{
                    position: [settings.camera.position.x, settings.camera.position.y, settings.camera.position.z],
                    fov: settings.camera.fov,
                }}
                onCreated={({ gl }) => {
                    gl.toneMappingExposure = 0.6;
                }}
            >
                <CameraController
                    containerRef={containerRef}
                    settings={settings}
                    enableOrbit={enableOrbit}
                    enableZoom={enableZoom}
                />
                <SceneContent
                    settings={settings}
                    modelPath={modelPath}
                    resolution={resolution}
                />
            </Canvas>
        </div>
    );
}
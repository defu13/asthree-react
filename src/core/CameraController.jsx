// src/core/CameraController.jsx
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

function CameraController({
    containerRef,
    settings,
    enableOrbit = true,
    enableZoom = true,
}) {
    const { camera } = useThree();
    const cam = settings.camera;

    const camOrbitRef = useRef(cam.orbit);
    useEffect(() => {
        camOrbitRef.current = cam.orbit;
    }, [cam.orbit]);

    const orbitRef = useRef({
        theta:  cam.orbit.theta,
        phi:    cam.orbit.phi,
        radius: cam.orbit.radius,
    });

    const dragOrbit = useRef({
        theta:  cam.orbit.theta,
        phi:    cam.orbit.phi,
        radius: cam.orbit.radius,
    });

    const isDragging       = useRef(false);
    const last             = useRef({ x: 0, y: 0 });
    const lastPinchDistance = useRef(null);

    // =========================
    // FOV
    // =========================
    useEffect(() => {
        camera.fov = cam.fov;
        camera.updateProjectionMatrix();
    }, [cam.fov, camera]);

    // =========================
    // ORBIT ANIMATION LOOP
    // =========================
    useFrame(() => {
        const target = isDragging.current ? dragOrbit.current : camOrbitRef.current;

        orbitRef.current.theta  = THREE.MathUtils.lerp(orbitRef.current.theta,  target.theta,  0.12);
        orbitRef.current.phi    = THREE.MathUtils.lerp(orbitRef.current.phi,    target.phi,    0.12);
        orbitRef.current.radius = THREE.MathUtils.lerp(orbitRef.current.radius, target.radius, 0.12);

        const { theta, phi, radius } = orbitRef.current;

        camera.position.set(
            cam.target.x + radius * Math.sin(phi) * Math.sin(theta),
            cam.target.y + radius * Math.cos(phi),
            cam.target.z + radius * Math.sin(phi) * Math.cos(theta),
        );
        camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
    });

    // =========================
    // EVENTOS — se registran una sola vez
    // =========================
    useEffect(() => {
        const el = containerRef?.current;
        if (!el) return;
        if (!enableOrbit && !enableZoom) return;

        const startDrag = (x, y) => {
            if (!enableOrbit) return;
            isDragging.current = true;
            last.current = { x, y };
            dragOrbit.current = { ...camOrbitRef.current };
        };

        const moveDrag = (x, y) => {
            if (!enableOrbit || !isDragging.current) return;
            const dx = x - last.current.x;
            const dy = y - last.current.y;
            last.current = { x, y };
            const sensitivity = 0.005;
            dragOrbit.current.theta -= dx * sensitivity;
            dragOrbit.current.phi = Math.max(
                0.1,
                Math.min(Math.PI - 0.1, dragOrbit.current.phi - dy * sensitivity),
            );
        };

        const endDrag = () => {
            if (!enableOrbit || !isDragging.current) return;
            const finalOrbit = { ...dragOrbit.current };
            orbitRef.current.theta  = finalOrbit.theta;
            orbitRef.current.phi    = finalOrbit.phi;
            orbitRef.current.radius = finalOrbit.radius;
            camOrbitRef.current = { ...camOrbitRef.current, ...finalOrbit };
            isDragging.current = false;
            // En el paquete npm no hay store — el orbit es solo visual
            // Si el consumidor quiere persistir el estado, puede pasarlo por onOrbitChange
        };

        const zoomTo = (newRadius) => {
            const clamped = Math.max(1.5, Math.min(10, newRadius));
            dragOrbit.current.radius = clamped;
            camOrbitRef.current = { ...camOrbitRef.current, radius: clamped };
        };

        // ── Mouse ─────────────────────────────────────────────

        const onMouseDown = (e) => {
            startDrag(e.clientX, e.clientY);
            if (enableOrbit) el.style.cursor = "grabbing";
        };
        const onMouseUp = () => {
            endDrag();
            if (enableOrbit) el.style.cursor = "grab";
        };
        const onMouseMove = (e) => moveDrag(e.clientX, e.clientY);

        const onWheel = (e) => {
            if (!enableZoom) return;
            e.preventDefault();
            zoomTo(camOrbitRef.current.radius + e.deltaY * 0.01);
        };

        // ── Touch ─────────────────────────────────────────────

        const onTouchStart = (e) => {
            if (e.touches.length === 1 && enableOrbit) {
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2 && enableZoom) {
                isDragging.current = false;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastPinchDistance.current = Math.hypot(dx, dy);
            }
        };

        const onTouchMove = (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && enableOrbit) {
                moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2 && enableZoom && lastPinchDistance.current !== null) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.hypot(dx, dy);
                const delta = lastPinchDistance.current - distance;
                lastPinchDistance.current = distance;
                dragOrbit.current.radius = Math.max(
                    1.5,
                    Math.min(10, camOrbitRef.current.radius + delta * 0.03),
                );
            }
        };

        const onTouchEnd = (e) => {
            if (e.touches.length === 0) {
                lastPinchDistance.current = null;
                endDrag();
            } else if (e.touches.length === 1 && enableOrbit) {
                lastPinchDistance.current = null;
                startDrag(e.touches[0].clientX, e.touches[0].clientY);
            }
        };

        // ── Registro ──────────────────────────────────────────

        el.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mouseup", onMouseUp);
        window.addEventListener("mousemove", onMouseMove);
        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchmove", onTouchMove, { passive: false });
        el.addEventListener("touchend", onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mouseup", onMouseUp);
            window.removeEventListener("mousemove", onMouseMove);
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchmove", onTouchMove);
            el.removeEventListener("touchend", onTouchEnd);
        };
    }, [enableOrbit, enableZoom]);

    return null;
}

export default CameraController;
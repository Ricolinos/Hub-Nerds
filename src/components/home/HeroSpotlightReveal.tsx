"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./HeroSpotlightReveal.module.scss";

interface HeroSpotlightRevealProps {
  /** Imagen base: paneles de cristal vacíos, siempre visible de fondo. */
  baseSrc: string;
  /** Imagen "reveal": mismos paneles iluminados, recortada por la máscara del cursor. */
  revealSrc: string;
  /**
   * Contenido del Hero (titular, CTAs). Se renderiza DENTRO del mismo
   * contenedor que escucha mousemove/touchmove — si viviera como hermano
   * (position absolute aparte) los eventos sobre ese texto nunca burbujean
   * al listener, porque el bubbling de eventos sube por ancestros, no entre
   * hermanos: el reveal se quedaría "congelado" en su posición inicial en
   * cuanto el cursor pasara sobre cualquier bloque de texto/botón.
   */
  children?: ReactNode;
}

// Radio del círculo de reveal (px, espacio del contenedor) y velocidad del
// lerp que suaviza el cursor — mismos valores que el mecanismo de referencia.
const REVEAL_RADIUS = 260;
const LERP_FACTOR = 0.1;
// En touch no hay cursor: sin esto el hero se ve completamente oscuro hasta
// el primer toque. Se anima una deriva ambient breve alrededor del centro.
const IDLE_DRIFT_MS = 3000;

// Genera, cuadro a cuadro, una máscara radial (canvas oculto → data URL)
// centrada en la posición suavizada del cursor/touch, y la aplica como
// mask-image al layer de la imagen "reveal". El canvas nunca se muestra:
// solo sirve para fabricar la máscara.
export function HeroSpotlightReveal({ baseSrc, revealSrc, children }: HeroSpotlightRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Posiciones en refs (no state): evita re-render en cada mousemove/frame.
  const rawPos = useRef({ x: 0, y: 0 });
  const smoothPos = useRef({ x: 0, y: 0 });
  const hasInteracted = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const reveal = revealRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !reveal || !ctx) return;

    reveal.style.setProperty("mask-size", "100% 100%");
    reveal.style.setProperty("-webkit-mask-size", "100% 100%");
    reveal.style.setProperty("mask-repeat", "no-repeat");
    reveal.style.setProperty("-webkit-mask-repeat", "no-repeat");

    // Posición inicial: centro del contenedor (no fuera de pantalla), tanto
    // para el fallback táctil como para el instante antes del primer
    // mousemove en desktop.
    const initialRect = container.getBoundingClientRect();
    rawPos.current = { x: initialRect.width / 2, y: initialRect.height / 2 };
    smoothPos.current = { ...rawPos.current };

    const isTouchDevice = window.matchMedia("(hover: none)").matches;
    const startedAt = performance.now();
    let rafId = 0;

    const tick = () => {
      const rect = container.getBoundingClientRect();

      // Deriva ambient breve en touch mientras no haya habido interacción.
      if (isTouchDevice && !hasInteracted.current) {
        const elapsed = performance.now() - startedAt;
        if (elapsed < IDLE_DRIFT_MS) {
          const angle = (elapsed / IDLE_DRIFT_MS) * Math.PI * 2;
          rawPos.current = {
            x: rect.width / 2 + Math.cos(angle) * Math.min(60, rect.width * 0.12),
            y: rect.height / 2 + Math.sin(angle) * Math.min(40, rect.height * 0.08),
          };
        }
      }

      smoothPos.current.x += (rawPos.current.x - smoothPos.current.x) * LERP_FACTOR;
      smoothPos.current.y += (rawPos.current.y - smoothPos.current.y) * LERP_FACTOR;

      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      const { x, y } = smoothPos.current;
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, REVEAL_RADIUS);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.4, "rgba(255,255,255,1)");
      gradient.addColorStop(0.6, "rgba(255,255,255,0.75)");
      gradient.addColorStop(0.75, "rgba(255,255,255,0.4)");
      gradient.addColorStop(0.88, "rgba(255,255,255,0.12)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, REVEAL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      const dataUrl = canvas.toDataURL();
      reveal.style.setProperty("mask-image", `url(${dataUrl})`);
      reveal.style.setProperty("-webkit-mask-image", `url(${dataUrl})`);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const updateFromClient = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    hasInteracted.current = true;
    rawPos.current = { x: clientX - rect.left, y: clientY - rect.top };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={(event) => updateFromClient(event.clientX, event.clientY)}
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) updateFromClient(touch.clientX, touch.clientY);
      }}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      <img
        src={baseSrc}
        alt=""
        aria-hidden
        className={styles.kenBurns}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // Oscurece la base para legibilidad del texto encima, sin recurrir
          // a un color de fondo Once-UI (los tokens de tema cambian con
          // light/dark y no dan contraste consistente sobre una imagen).
          filter: "brightness(0.55) saturate(0.9)",
        }}
      />
      <div
        ref={revealRef}
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <img
          src={revealSrc}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {/* Nunca se muestra: solo sirve para fabricar el data URL de la máscara. */}
      <canvas ref={canvasRef} aria-hidden style={{ display: "none" }} />
      {children}
    </div>
  );
}

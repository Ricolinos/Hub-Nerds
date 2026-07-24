"use client";

import { ReactNode, useEffect, useRef } from "react";

interface HomeScrollVideoSectionProps {
  src: string;
  children: ReactNode;
}

// Atenúa el clip para que el texto encima sea legible sin depender de un
// scrim de color (los tokens de tema cambian con light/dark y no dan
// contraste consistente sobre un video).
const VIDEO_FILTER_BASE = "brightness(0.55) saturate(0.9)";

// El Hero se lee nítido; a partir de ahí el blur crece hasta este máximo
// conforme se scrollea hacia Showcase/CreatorsCTA, y se queda ahí el resto.
const MAX_BLUR_PX = 16;
// Distancia (px de scroll) tras el final del Hero hasta alcanzar el blur máximo.
const BLUR_TRANSITION_DISTANCE = 600;

// Envuelve el contenido del home en una sección donde el video queda
// "pegado" (sticky) detrás mientras se hace scroll, y su currentTime se ata
// al progreso de scroll dentro de esta sección — nunca se reproduce solo.
// El truco sticky + margin-top negativo confina el video a la altura real
// del contenido: al llegar al Footer (fuera de este wrapper) el video ya
// dejó de pegarse, no se filtra detrás (el Footer usa un fondo alpha).
export function HomeScrollVideoSection({ src, children }: HomeScrollVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const content = contentRef.current;
    if (!video || !content) return;

    let duration = 0;
    let rafId = 0;

    const readDuration = () => {
      duration = video.duration || 0;
    };
    video.addEventListener("loadedmetadata", readDuration);
    if (video.readyState >= 1) readDuration();

    // Marca opcional (ver page.tsx) que delimita el final real del Hero; si
    // no está presente, se aproxima con 80vh (el minHeight que usa HomeHero).
    const heroBoundary = content.querySelector<HTMLElement>("[data-hero-boundary]");

    // Loop continuo (en vez de depender del evento "scroll") para que el
    // avance del video y el blur queden sincronizados con CUALQUIER forma de
    // scroll (rueda, trackpad, teclado, o arrastrar la barra del navegador),
    // y no se sientan a tirones por la cadencia del evento "scroll".
    const tick = () => {
      if (duration) {
        const rect = content.getBoundingClientRect();
        const scrollable = rect.height - window.innerHeight;
        const progress = scrollable > 0 ? -rect.top / scrollable : 0;
        const clamped = Math.min(1, Math.max(0, progress));
        const target = clamped * duration;

        // Evita reasignar currentTime si ya está prácticamente ahí.
        if (Math.abs(video.currentTime - target) > 0.01) {
          video.currentTime = target;
        }

        const heroBottom = heroBoundary
          ? heroBoundary.getBoundingClientRect().bottom
          : rect.top + window.innerHeight * 0.8;
        const pastHero = Math.max(0, -heroBottom);
        const blurProgress = Math.min(1, pastHero / BLUR_TRANSITION_DISTANCE);
        video.style.filter = `${VIDEO_FILTER_BASE} blur(${(blurProgress * MAX_BLUR_PX).toFixed(1)}px)`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      video.removeEventListener("loadedmetadata", readDuration);
      cancelAnimationFrame(rafId);
    };
  }, [src]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100vh",
          overflow: "hidden",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: `${VIDEO_FILTER_BASE} blur(0px)` }}
        />
      </div>
      <div ref={contentRef} style={{ marginTop: "-100vh", position: "relative", zIndex: 1, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

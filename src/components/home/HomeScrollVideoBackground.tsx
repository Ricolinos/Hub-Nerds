"use client";

import { ReactNode, useEffect, useRef } from "react";

interface HomeScrollVideoSectionProps {
  src: string;
  children: ReactNode;
}

// Atenúa el clip para que el texto encima sea legible sin depender de un
// scrim de color (los tokens de tema cambian con light/dark y no dan
// contraste consistente sobre un video).
const VIDEO_FILTER = "brightness(0.55) saturate(0.9)";

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
    let ticking = false;

    const readDuration = () => {
      duration = video.duration || 0;
    };
    video.addEventListener("loadedmetadata", readDuration);
    if (video.readyState >= 1) readDuration();

    const applyScrollProgress = () => {
      ticking = false;
      if (!duration) return;

      const rect = content.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress = scrollable > 0 ? -rect.top / scrollable : 0;
      const clamped = Math.min(1, Math.max(0, progress));
      const target = clamped * duration;

      // Evita micro-seeks que el decoder no puede resolver a esa frecuencia.
      if (Math.abs(video.currentTime - target) > 0.03) {
        video.currentTime = target;
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyScrollProgress);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    applyScrollProgress();

    return () => {
      video.removeEventListener("loadedmetadata", readDuration);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
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
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: VIDEO_FILTER }}
        />
      </div>
      <div ref={contentRef} style={{ marginTop: "-100vh", position: "relative", zIndex: 1, width: "100%" }}>
        {children}
      </div>
    </div>
  );
}

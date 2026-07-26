"use client";

import { useEffect, useRef, useState } from "react";

// Capas del hero, de atrás hacia adelante. `depth` = cuántos píxeles se
// desplaza como máximo esa capa al mover el cursor de un borde al otro.
//
// GOTCHA de contenido: el contenido de la PANTALLA del monitor (el logo
// Hub-Nerds) vive en la capa de paneles, no en la del monitor. Por eso ambas
// comparten `depth`: si se movieran a distinta velocidad, el logo se
// despegaría del bisel. Si más adelante se quiere que los paneles floten con
// más profundidad que el monitor, hay que mover ese contenido de pantalla a
// la capa del monitor en Photoshop y recién ahí separar los `depth`.
interface HeroLayer {
  src: string;
  depth: number;
  /** Solo la capa de paneles lleva encima la variante revelada por el foco. */
  reveal?: boolean;
}

const LAYERS: HeroLayer[] = [
  { src: "layer-1-bg.webp", depth: 10 },
  { src: "layer-2-monitor.webp", depth: 24 },
  { src: "layer-3-panels.webp", depth: 24, reveal: true },
  { src: "layer-4-fg.webp", depth: 48 },
];

const REVEAL_SRC = "layer-3b-panels-alt.webp";
const BASE = "/images/home/parallax";

// Radio del foco que revela la segunda versión de los paneles.
const SPOTLIGHT_R = 260;

// Degradado de la máscara: opaco (visible) en el centro y desvaneciéndose al
// borde. Se resuelve con un radial-gradient de CSS movido por custom
// properties, NO dibujando en un <canvas> y exportando con toDataURL() en
// cada frame: eso último implica una lectura sincrónica de GPU a CPU más una
// codificación PNG completa 60 veces por segundo, y hunde el rendimiento en
// móvil. Aquí el compositor lo resuelve en GPU.
//
// La caída es deliberadamente CORTA (opaco hasta el 72% del radio y apagado
// del todo en el 100%). Con la caída larga del patrón original —que empieza a
// desvanecer desde el 40%— queda una franja semitransparente de ~150px donde
// se ven LAS DOS versiones de los paneles a la vez: como cada versión tiene un
// título distinto ("Graphic Design" vs "Illustration"), los textos se
// superponían y se leía como un fallo de render, no como un efecto.
const MASK = `radial-gradient(circle ${SPOTLIGHT_R}px at var(--spot-x, -9999px) var(--spot-y, -9999px), rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.6) 86%, rgba(0,0,0,0.15) 95%, rgba(0,0,0,0) 100%)`;

export function HeroParallax() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const revealRef = useRef<HTMLDivElement>(null);
  // Posición cruda del puntero (-1..1 respecto al centro) y su versión suavizada.
  const target = useRef({ x: 0, y: 0, px: -9999, py: -9999 });
  const smooth = useRef({ x: 0, y: 0, px: -9999, py: -9999 });
  const rafRef = useRef<number | null>(null);

  // El efecto solo se activa en punteros finos (mouse/trackpad) y si el
  // visitante no pidió reducir movimiento. En táctil no hay cursor que seguir
  // y el canvas animándose solo gastaría batería, así que ahí las capas
  // quedan quietas y compuestas como una imagen estática.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(mq.matches && !reduce.matches);
    update();
    mq.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      target.current.x = (e.clientX - rect.left) / rect.width - 0.5;
      target.current.y = (e.clientY - rect.top) / rect.height - 0.5;
      // Posición del foco en coordenadas locales del hero.
      target.current.px = e.clientX - rect.left;
      target.current.py = e.clientY - rect.top;
    };

    const onLeave = () => {
      target.current.x = 0;
      target.current.y = 0;
      target.current.px = -9999;
      target.current.py = -9999;
    };

    const tick = () => {
      const t = target.current;
      const s = smooth.current;
      s.x += (t.x - s.x) * 0.08;
      s.y += (t.y - s.y) * 0.08;
      // El foco persigue al cursor un poco más rápido que el parallax: si va
      // igual de lento se siente "pegajoso" y se despega demasiado del puntero.
      s.px += (t.px - s.px) * 0.16;
      s.py += (t.py - s.py) * 0.16;

      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (!el) return;
        el.style.transform = `translate3d(${-s.x * layer.depth}px, ${-s.y * layer.depth}px, 0) scale(1.06)`;
      });

      const rev = revealRef.current;
      if (rev) {
        // La máscara vive DENTRO de una capa que a su vez se está desplazando,
        // así que hay que restarle ese desplazamiento: si se posicionara en
        // coordenadas de pantalla, el foco se iría despegando del cursor
        // conforme la capa se mueve.
        const dx = -s.x * LAYERS[2].depth;
        const dy = -s.y * LAYERS[2].depth;
        rev.style.setProperty("--spot-x", `${s.px - dx}px`);
        rev.style.setProperty("--spot-y", `${s.py - dy}px`);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const root = rootRef.current;
    window.addEventListener("pointermove", onMove, { passive: true });
    root?.addEventListener("pointerleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      root?.removeEventListener("pointerleave", onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}
    >
      {LAYERS.map((layer, i) => (
        <div
          key={layer.src}
          ref={(el) => {
            layerRefs.current[i] = el;
          }}
          style={{
            position: "absolute",
            inset: 0,
            // scale(1.06) de serie: junto al 15% de outpaint de las imágenes,
            // garantiza que al desplazarse una capa nunca asome su borde.
            transform: "translate3d(0,0,0) scale(1.06)",
            willChange: enabled ? "transform" : undefined,
            backgroundImage: `url(${BASE}/${layer.src})`,
            backgroundSize: "cover",
            backgroundPosition: "46% 42%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* La variante revelada solo se monta cuando el efecto está activo.
              Dejarla montada con opacity:0 en táctil igual descargaría su
              imagen (~190 KB) para nunca mostrarla. */}
          {layer.reveal && enabled && (
            <div
              ref={revealRef}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(${BASE}/${REVEAL_SRC})`,
                backgroundSize: "cover",
                backgroundPosition: "46% 42%",
                backgroundRepeat: "no-repeat",
                maskImage: MASK,
                WebkitMaskImage: MASK,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

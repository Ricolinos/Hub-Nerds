"use client";

import { useEffect, useRef, useState } from "react";
import {
  HERO_PANELS,
  quadToMatrix3d,
  uvToLocal,
  type PanelQuad,
} from "./heroPanelGeometry";

export interface HeroPiece {
  id: string;
  title: string;
  image: string;
  designer: string;
  tag: string | null;
}

// Capas del hero, de atrás hacia adelante. `depth` = píxeles que se desplaza
// como máximo esa capa al recorrer el cursor de un borde al otro.
//
// El monitor va DESPUÉS del escritorio: está apoyado sobre él, así que debe
// taparlo. Comparte `depth` con el escritorio porque están prácticamente a la
// misma distancia de la cámara; con velocidades distintas el monitor se
// deslizaría sobre la mesa como si flotara.
const LAYERS = [
  { src: "layer-1-bg.webp", depth: 10 },
  { src: "layer-2-desk.webp", depth: 26 },
  { src: "layer-3-monitor.webp", depth: 26 },
] as const;

const GLASS_SRC = "layer-4-glass.webp";
const GLASS_DEPTH = 44;
const BASE = "/images/home/parallax";

const SPOTLIGHT_R = 260;

// Caída deliberadamente corta: con una caída larga queda una franja ancha
// donde se ven los DOS sets de piezas a la vez y los títulos se superponen,
// lo que se lee como un fallo de render en vez de como un efecto.
const MASK = `radial-gradient(circle ${SPOTLIGHT_R}px at var(--spot-x, -9999px) var(--spot-y, -9999px), rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.6) 86%, rgba(0,0,0,0.15) 95%, rgba(0,0,0,0) 100%)`;

/** Cuántas piezas muestra cada panel, en orden izquierda / centro / derecha. */
const PANEL_SLOTS = [4, 2, 4] as const;
const TOTAL_SLOTS = PANEL_SLOTS.reduce((a, b) => a + b, 0);

/**
 * Rellena los huecos ciclando el feed. La plataforma es joven y puede haber
 * menos piezas publicadas que huecos (con 6 piezas el panel derecho se
 * quedaba vacío); ciclar es preferible a mostrar un panel hueco.
 */
function fillSlots(pieces: HeroPiece[], offset = 0): HeroPiece[] {
  if (!pieces.length) return [];
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const piece = pieces[(i + offset) % pieces.length];
    // La key debe ser única aunque la pieza se repita en otro hueco.
    return { ...piece, id: `${piece.id}-${i}` };
  });
}

function PanelContent({
  panel,
  pieces,
  title,
}: {
  panel: PanelQuad;
  pieces: HeroPiece[];
  title: string;
}) {
  const cols = pieces.length <= 2 ? 1 : 2;
  return (
    <div
      style={{
        width: panel.base.w,
        height: panel.base.h,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          color: "rgba(255,255,255,0.92)",
          fontSize: 26,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          textShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 12,
          minHeight: 0,
        }}
      >
        {pieces.map((piece) => (
          <div
            key={piece.id}
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              // El contenido se ve a TRAVÉS del cristal y por debajo del
              // overlay oscuro del hero, así que sin este realce las portadas
              // quedaban lavadas y casi ilegibles.
              filter: "saturate(1.15) contrast(1.08) brightness(1.28)",
            }}
          >
            {/* <img> plano y no next/image: este contenido vive dentro de una
                cadena de transformaciones proyectivas y no necesita el
                pipeline de optimización (las portadas ya vienen de Storage). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={piece.image}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                padding: "16px 10px 8px",
                background: "linear-gradient(to top, rgba(0,0,0,0.78), transparent)",
                color: "rgba(255,255,255,0.95)",
                fontSize: 13,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {piece.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Los tres paneles con su contenido, encajados en perspectiva. */
function PanelSet({
  pieces,
  titles,
  size,
}: {
  pieces: HeroPiece[];
  titles: string[];
  size: { w: number; h: number };
}) {
  let cursor = 0;
  return (
    <>
      {HERO_PANELS.map((panel, i) => {
        const slots = PANEL_SLOTS[i];
        const slice = pieces.slice(cursor, cursor + slots);
        cursor += slots;
        if (!slice.length) return null;
        const quad = panel.corners.map((uv) => uvToLocal(uv, size.w, size.h)) as [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ];
        return (
          <div
            key={panel.id}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "0 0",
              transform: quadToMatrix3d(panel.base.w, panel.base.h, quad),
            }}
          >
            <PanelContent panel={panel} pieces={slice} title={titles[i] ?? ""} />
          </div>
        );
      })}
    </>
  );
}

export function HeroParallax({ pieces = [] }: { pieces?: HeroPiece[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glassRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0, px: -9999, py: -9999 });
  const smooth = useRef({ x: 0, y: 0, px: -9999, py: -9999 });
  const rafRef = useRef<number | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // El efecto solo se activa con puntero fino y sin prefers-reduced-motion:
  // en táctil no hay cursor que seguir y el bucle solo gastaría batería.
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

  // El encaje del contenido depende del tamaño renderizado del hero (la
  // matriz se recalcula con él), así que hay que observarlo.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e: PointerEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      target.current.x = (e.clientX - rect.left) / rect.width - 0.5;
      target.current.y = (e.clientY - rect.top) / rect.height - 0.5;
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
      // El foco persigue al cursor más rápido que el parallax: si va igual de
      // lento se siente pegajoso y se despega demasiado del puntero.
      s.px += (t.px - s.px) * 0.16;
      s.py += (t.py - s.py) * 0.16;

      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${-s.x * layer.depth}px, ${-s.y * layer.depth}px, 0) scale(1.06)`;
        }
      });

      const dx = -s.x * GLASS_DEPTH;
      const dy = -s.y * GLASS_DEPTH;
      const glass = glassRef.current;
      if (glass) glass.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.06)`;

      const rev = revealRef.current;
      if (rev) {
        // La máscara vive dentro de una capa que se está desplazando: si se
        // posicionara en coordenadas de pantalla, el foco se iría despegando
        // del cursor conforme la capa se mueve.
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

  const ready = size.w > 0 && pieces.length > 0;
  // Set base y set revelado: el foco descubre OTRAS piezas reales, no una
  // segunda imagen. El segundo set arranca desplazado para que, aun con pocas
  // piezas publicadas, el foco muestre algo distinto de lo que ya se ve.
  const setA = fillSlots(pieces, 0);
  const setB = fillSlots(pieces, Math.max(1, Math.floor(pieces.length / 2)));
  // Los DOS sets comparten título a propósito: el foco cambia la obra, no la
  // categoría. Con títulos distintos, la franja de transición de la máscara
  // mostraba ambos textos superpuestos y se leía como un fallo de render.
  const titles = ["Diseño gráfico", "Motion", "Branding"];

  const layerBase = {
    position: "absolute",
    inset: 0,
    transform: "translate3d(0,0,0) scale(1.06)",
    backgroundSize: "cover",
    backgroundPosition: "46% 42%",
    backgroundRepeat: "no-repeat",
  } as const;

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
            ...layerBase,
            willChange: enabled ? "transform" : undefined,
            backgroundImage: `url(${BASE}/${layer.src})`,
          }}
        />
      ))}

      {/* Capa de cristal: a diferencia de las demás NO lleva la imagen como
          fondo del propio div, porque el contenido de los paneles tiene que
          quedar POR DEBAJO del cristal para que sus brillos y bordes lo
          cubran. Por eso el contenido va primero y la imagen del cristal
          encima, ambos dentro del mismo div para compartir el desplazamiento. */}
      <div
        ref={glassRef}
        style={{
          position: "absolute",
          inset: 0,
          transform: "translate3d(0,0,0) scale(1.06)",
          willChange: enabled ? "transform" : undefined,
        }}
      >
        {ready && <PanelSet pieces={setA} titles={titles} size={size} />}
        {ready && enabled && (
          <div
            ref={revealRef}
            style={{
              position: "absolute",
              inset: 0,
              maskImage: MASK,
              WebkitMaskImage: MASK,
            }}
          >
            <PanelSet pieces={setB} titles={titles} size={size} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${BASE}/${GLASS_SRC})`,
            backgroundSize: "cover",
            backgroundPosition: "46% 42%",
            backgroundRepeat: "no-repeat",
          }}
        />
      </div>
    </div>
  );
}

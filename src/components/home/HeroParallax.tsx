"use client";

import { useEffect, useRef, useState } from "react";
import {
  HERO_PANELS,
  quadToMatrix3d,
  uvToLocal,
  type PanelQuad,
  type Quad,
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

// Caída corta a propósito: con una caída larga queda una franja ancha donde
// los proyectos se ven a medio aparecer y se lee como un fallo de render.
const MASK = `radial-gradient(circle ${SPOTLIGHT_R}px at var(--spot-x, -9999px) var(--spot-y, -9999px), rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.6) 86%, rgba(0,0,0,0.15) 95%, rgba(0,0,0,0) 100%)`;

/** Cuántos proyectos muestra cada panel, en orden izquierda / centro / derecha. */
const PANEL_SLOTS = [4, 2, 4] as const;
const TOTAL_SLOTS = PANEL_SLOTS.reduce((a, b) => a + b, 0);

type LocalQuad = [[number, number], [number, number], [number, number], [number, number]];

/**
 * Rellena los huecos ciclando el feed. La plataforma es joven y puede haber
 * menos piezas publicadas que huecos; ciclar es preferible a dejar un panel
 * a medias.
 */
function fillSlots(pieces: HeroPiece[]): HeroPiece[] {
  if (!pieces.length) return [];
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => {
    const piece = pieces[i % pieces.length];
    return { ...piece, id: `${piece.id}-${i}` };
  });
}

const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Alto de diseño que conserva la proporción del cuadrilátero destino. Si se
 * fijara a mano, el texto y las miniaturas saldrían estirados en cuanto el
 * quad no tuviera la misma relación de aspecto.
 */
function baseHeightFor(quad: LocalQuad, baseW: number): number {
  const top = dist(quad[0], quad[1]);
  const left = dist(quad[0], quad[3]);
  if (!top) return baseW;
  return Math.max(1, Math.round(baseW * (left / top)));
}

/** Envuelve contenido plano y lo encaja en un cuadrilátero en perspectiva. */
function Fitted({
  quad,
  baseW,
  children,
}: {
  quad: LocalQuad;
  baseW: number;
  children: (size: { w: number; h: number }) => React.ReactNode;
}) {
  const h = baseHeightFor(quad, baseW);
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "0 0",
        transform: quadToMatrix3d(baseW, h, quad),
      }}
    >
      {children({ w: baseW, h })}
    </div>
  );
}

function ProjectGrid({ pieces, cols }: { pieces: HeroPiece[]; cols: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 12,
        padding: 12,
        boxSizing: "border-box",
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
            border: "1px solid rgba(255,255,255,0.16)",
            // Las portadas se ven a TRAVÉS del cristal y bajo el overlay
            // oscuro del hero: sin realce quedan lavadas.
            filter: "saturate(1.15) contrast(1.08) brightness(1.3)",
          }}
        >
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
              padding: "18px 10px 8px",
              background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
              color: "rgba(255,255,255,0.96)",
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

  // El encaje depende del tamaño renderizado del hero: las matrices se
  // recalculan con él.
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
        // La máscara vive dentro de una capa que se desplaza: sin restarle ese
        // desplazamiento, el foco se despegaría del cursor.
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

  const ready = size.w > 0;
  const slots = fillSlots(pieces);
  const toLocal = (q: Quad): LocalQuad =>
    q.map((uv) => uvToLocal(uv, size.w, size.h)) as LocalQuad;

  const layerBase = {
    position: "absolute",
    inset: 0,
    transform: "translate3d(0,0,0) scale(1.06)",
    backgroundSize: "cover",
    backgroundPosition: "46% 42%",
    backgroundRepeat: "no-repeat",
  } as const;

  let cursor = 0;
  const panelSlices = HERO_PANELS.map((_, i) => {
    const slice = slots.slice(cursor, cursor + PANEL_SLOTS[i]);
    cursor += PANEL_SLOTS[i];
    return slice;
  });

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

      {/* Capa de cristal: la imagen NO va como fondo del div porque el
          contenido debe quedar por debajo del vidrio para que sus brillos y
          bordes lo cubran. Todo vive en el mismo contenedor para compartir el
          desplazamiento del parallax. */}
      <div
        ref={glassRef}
        style={{
          position: "absolute",
          inset: 0,
          transform: "translate3d(0,0,0) scale(1.06)",
          willChange: enabled ? "transform" : undefined,
        }}
      >
        {/* 1. Desenfoque REAL del fondo, recortado a la silueta de cada panel.
               El vidrio de la imagen solo aporta bordes y reflejos: el efecto
               de "cristal esmerilado" tiene que difuminar en vivo las capas de
               atrás, que además se mueven con el parallax. Va sobre la silueta
               exterior porque el vidrio abarca todo el panel, no solo su área
               de contenido. */}
        {ready &&
          HERO_PANELS.map((panel: PanelQuad) => (
            <Fitted key={`blur-${panel.id}`} quad={toLocal(panel.outer)} baseW={panel.base.w}>
              {({ w, h }) => (
                <div
                  style={{
                    width: w,
                    height: h,
                    borderRadius: 14,
                    backdropFilter: "blur(14px) saturate(1.15)",
                    WebkitBackdropFilter: "blur(14px) saturate(1.15)",
                    background: "rgba(180, 214, 224, 0.05)",
                  }}
                />
              )}
            </Fitted>
          ))}

        {/* 2. Título de la categoría: SIEMPRE visible, en la franja entre el
               borde superior del cristal y el marco interior. Es el estado
               base del panel — sin proyectos. */}
        {ready &&
          HERO_PANELS.map((panel: PanelQuad) => (
            <Fitted key={`title-${panel.id}`} quad={toLocal(panel.header)} baseW={panel.base.w}>
              {({ w, h }) => (
                <div
                  style={{
                    width: w,
                    height: h,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 26px",
                    boxSizing: "border-box",
                    color: "rgba(255,255,255,0.9)",
                    fontSize: Math.round(h * 0.42),
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    textShadow: "0 2px 14px rgba(0,0,0,0.55)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {panel.title}
                </div>
              )}
            </Fitted>
          ))}

        {/* 3. Los proyectos solo existen bajo el foco: el panel arranca
               transparente y el cursor es lo que los revela. */}
        {ready && enabled && pieces.length > 0 && (
          <div
            ref={revealRef}
            style={{
              position: "absolute",
              inset: 0,
              maskImage: MASK,
              WebkitMaskImage: MASK,
            }}
          >
            {HERO_PANELS.map((panel: PanelQuad, i) => (
              <Fitted key={`grid-${panel.id}`} quad={toLocal(panel.corners)} baseW={panel.base.w}>
                {() => (
                  <ProjectGrid
                    pieces={panelSlices[i]}
                    cols={PANEL_SLOTS[i] <= 2 ? 1 : 2}
                  />
                )}
              </Fitted>
            ))}
          </div>
        )}

        {/* 4. El cristal, encima de todo lo anterior. */}
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

"use client";

import { Media } from "@once-ui-system/core";
import { Fragment, useEffect, useRef, useState } from "react";
import { VideoCover } from "@/components/shared/VideoCover";
import { type CoverKind, resolveCoverSrc } from "@/lib/coverMedia";
import styles from "./HeroParallax.module.scss";
import {
  computeSceneFraming,
  HERO_PANELS,
  MONITOR_SCREEN,
  type PanelQuad,
  type Quad,
  quadToMatrix3d,
  uvToLocal,
} from "./heroPanelGeometry";

export interface HeroPiece {
  id: string;
  title: string;
  /** coverUrl CRUDO (puede traer el prefijo "video:", un data URL de video o
   *  un link de YouTube sin prefijo) — se resuelve en el render con
   *  `coverMedia.ts`, igual que HomeShowcase. */
  image: string;
  /** Ya calculado en page.tsx con `coverKindOf(image)`: evita repetir la
   *  detección por pieza en cada frame del panel. */
  coverKind: CoverKind | null;
  /** Ya calculado en page.tsx con `extractYouTubeId`; null si no es YouTube. */
  youtubeId: string | null;
  designer: string;
  tag: string | null;
  href?: string;
}

// Capas del hero, de atrás hacia adelante. `depth` = píxeles que se desplaza
// como máximo esa capa al recorrer el cursor de un borde al otro.
//
// El monitor va DESPUÉS del escritorio: está apoyado sobre él, así que debe
// taparlo. Comparte `depth` con el escritorio porque están prácticamente a la
// misma distancia de la cámara; con velocidades distintas el monitor se
// deslizaría sobre la mesa como si flotara.
// `bgClass` referencia HeroParallax.module.scss: el `background-image` de
// cada capa vive ahí (con su media query de reemplazo en pantallas chicas),
// no como estilo inline — ver el comentario del módulo para el porqué.
const LAYERS = [
  { src: "layer-1-bg.webp", depth: 10, bgClass: styles.layer1 },
  { src: "layer-2-desk.webp", depth: 26, bgClass: styles.layer2 },
  { src: "layer-3-monitor.webp", depth: 26, bgClass: styles.layer3 },
] as const;

/** Índice de la capa del monitor dentro de `LAYERS`: el logo que se revela
 *  al pasar el cursor cuelga de esta capa (ver JSX y el bucle rAF) para
 *  compartir exactamente su transform, no el del vidrio. */
const MONITOR_LAYER_INDEX = LAYERS.findIndex((l) => l.src === "layer-3-monitor.webp");

const GLASS_SRC = "layer-4-glass.webp";
const GLASS_DEPTH = 44;
const BASE = "/images/home/parallax";

/** Mismo breakpoint que HeroParallax.module.scss ($s de breakpoints.scss):
 *  por debajo de este ancho la escena pinta las variantes `@0.5x`. */
const COMPACT_MEDIA_QUERY = "(max-width: 768px)";

/** Inserta el sufijo `@0.5x` antes de la extensión, p.ej.
 *  `layer-1-bg.webp` -> `layer-1-bg@0.5x.webp`. Reducción proporcional
 *  exacta (mismo aspect ratio), generada con sharp — ver el módulo scss. */
const compactVariant = (file: string) => file.replace(/\.webp$/, "@0.5x.webp");

/** Nombres de archivo de las 4 capas que arman la escena (3 de `LAYERS` +
 *  el cristal), en el mismo orden de profundidad en que se pintan. Única
 *  fuente de verdad para: (a) los `<link rel="preload">` de más abajo y (b)
 *  `useHeroSceneLoaded`, el hook que consume `HomeHero` para la pantalla de
 *  carga — así ambos suman siempre el mismo total, sin repetir la lista a
 *  mano en dos sitios. */
const HERO_LAYER_FILES: readonly string[] = [...LAYERS.map((layer) => layer.src), GLASS_SRC];

/** Rutas a resolución completa (desktop). Se mantiene exportado por
 *  compatibilidad de nombre/total; la carga real (`useHeroSceneLoaded`)
 *  decide en cliente qué variante corresponde según el viewport. */
export const HERO_IMAGE_SRCS: readonly string[] = HERO_LAYER_FILES.map((file) => `${BASE}/${file}`);

/**
 * Progreso REAL de carga de las 4 capas (no un temporizador arbitrario):
 * crea una `Image` por capa, espera su `decode()` (no solo `onload`, que
 * dispara antes de que el bitmap esté listo para pintar sin jank) y cuenta
 * cuántas resolvieron. `ready`/`loaded` arrancan en el mismo valor en
 * servidor y cliente (el efecto no corre en SSR) para no producir un
 * mismatch de hidratación.
 */
export function useHeroSceneLoaded() {
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const total = HERO_LAYER_FILES.length;

    const bump = () => {
      if (cancelled) return;
      count += 1;
      setLoaded(count);
      if (count >= total) setReady(true);
    };

    // Decodifica la MISMA variante que CSS va a pintar (media query de
    // HeroParallax.module.scss): si esto siempre pidiera la de escritorio,
    // el móvil terminaría bajando las dos (esta por JS + la del CSS) y se
    // perdería todo el ahorro de servir `@0.5x`.
    const compact = window.matchMedia(COMPACT_MEDIA_QUERY).matches;
    const sources = HERO_LAYER_FILES.map(
      (file) => `${BASE}/${compact ? compactVariant(file) : file}`,
    );

    sources.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      const settle = () => {
        // decode() confirma que el bitmap ya se puede pintar sin jank; si el
        // navegador no lo soporta, onload/onerror ya alcanzan para el conteo.
        if (typeof img.decode === "function") {
          img.decode().then(bump).catch(bump);
        } else {
          bump();
        }
      };
      if (img.complete) {
        // Ya en caché del navegador: cuenta igual, pero sin esperar eventos
        // que ya no van a disparar (evita quedarse colgado en `loaded < total`).
        settle();
      } else {
        img.onload = settle;
        // Una capa rota no debe bloquear la pantalla de carga para siempre.
        img.onerror = bump;
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { loaded, total: HERO_IMAGE_SRCS.length, ready };
}

const SPOTLIGHT_R = 260;

// Caída corta a propósito: con una caída larga queda una franja ancha donde
// los proyectos se ven a medio aparecer y se lee como un fallo de render.
const MASK = `radial-gradient(circle ${SPOTLIGHT_R}px at var(--spot-x, -9999px) var(--spot-y, -9999px), rgba(0,0,0,1) 0%, rgba(0,0,0,1) 72%, rgba(0,0,0,0.6) 86%, rgba(0,0,0,0.15) 95%, rgba(0,0,0,0) 100%)`;

// Luz CONSTANTE detrás del vidrio, siempre encendida (no sigue al cursor: el
// usuario la pidió así para que los paneles se lean como pantallas
// prendidas, no como un foco que persigue al ratón). Reutiliza la misma
// silueta `outer` que ya monta la capa de desenfoque de más abajo y le
// aplica este color con `mixBlendMode: "screen"` — no depende de
// --spot-x/-y, así que no toca el bucle rAF ni se apaga con
// prefers-reduced-motion. Cian de marca (--scheme-cyan-700 en tokens.css)
// fijo a mano: esta capa vive fuera del wrapper data-theme que usa
// Particle/texto, así que no hay tokens semánticos resueltos aquí.
// v2 (2026-07-26): con alfa plano 0.16 en `screen` la luz no se leía,
// verificado por captura (el usuario tenía razón). Dos cambios, comparados
// en capturas antes/después:
// (a) `plus-lighter` en vez de `screen` en el div de abajo: sobre el fondo
//     ya oscuro de la escena, `screen` = 1-(1-a)(1-b) apenas mueve el
//     resultado cuando `b` (el color de la luz) no es muy luminoso.
//     `plus-lighter` SUMA el color directamente (clamp a blanco), así que a
//     igual alfa se nota mucho más sin "quemar" el vidrio, porque el
//     degradado de abajo cae a 0 antes del borde del panel.
// (b) degradado radial en vez de color plano: una pantalla real emite más
//     luz por el centro/arriba que por los bordes. El pico de alfa (0.55)
//     es más alto que el plano anterior (0.16) porque, con el falloff
//     radial, la mayor parte del panel queda muy por debajo de ese pico —
//     el promedio percibido sigue siendo sutil.
const PANEL_GLOW =
  "radial-gradient(ellipse 75% 65% at 50% 38%, rgba(64, 210, 255, 0.55) 0%, rgba(64, 210, 255, 0.28) 40%, rgba(23, 192, 253, 0.08) 70%, rgba(23, 192, 253, 0) 100%)";

/** Cuántos proyectos muestra cada panel, en orden izquierda / centro / derecha. */
const PANEL_SLOTS = [4, 2, 4] as const;
const TOTAL_SLOTS = PANEL_SLOTS.reduce((a, b) => a + b, 0);

type LocalQuad = [[number, number], [number, number], [number, number], [number, number]];

// Resplandor de borde por cristal, inspirado en la mecánica "GlowCard" de
// 21st.dev (radial-gradient que sigue al cursor + hue-shift por posición,
// recortado SOLO al marco). Reutiliza --spot-x/--spot-y tal cual las deja el
// bucle rAF sobre `glassRef` (mismo sistema de coordenadas que `MASK`): este
// bloque vive como hermano de `revealRef`/`.glass`, NO dentro de `Fitted`, así
// que no hace falta invertir la matriz proyectiva de cada panel para ubicar
// el punto del cursor en su espacio local.
//
// Técnica "solo marco": un único `clip-path: polygon(evenodd, ...)` que traza
// la silueta EXTERIOR del panel (con esquinas redondeadas, ver
// `roundedQuadPoints`) y, a continuación, una silueta interior encogida hacia
// su centroide (`shrinkToward`), también redondeada — con `evenodd` la región
// encerrada por ambos contornos se cancela y solo queda pintada la banda
// entre los dos (un "marco"). Es más simple que `mask-composite: intersect`
// (esa técnica opera sobre el borde real de una caja rectangular; aquí el
// panel es un cuadrilátero irregular en perspectiva, no una caja) y no
// requiere una segunda capa con blend mode para "restar" el relleno.
const EDGE_GLOW_INSET_PX = 16;
const EDGE_GLOW_RADIUS = 180;

// Mismo radio que `borderRadius: 14` de los otros bloques del panel (blur,
// PANEL_GLOW, título) para que el marco se lea consistente con el resto del
// cristal. El contorno interior usa un pelín menos: al ser un cuadrilátero
// más chico (encogido `EDGE_GLOW_INSET_PX` hacia el centro), el mismo radio
// se ve más "apretado" ahí — un poco menor evita que el redondeo domine el
// ancho del marco en las esquinas.
const EDGE_GLOW_OUTER_CORNER_RADIUS = 14;
const EDGE_GLOW_INNER_CORNER_RADIUS = 11;

/**
 * Encoge un cuadrilátero moviendo cada esquina `insetPx` hacia su centroide.
 * No es un offset paralelo perfecto (esquinas muy agudas se encogen algo
 * menos que los lados), pero para un marco de ~16px es imperceptible y evita
 * traer un algoritmo de offset de polígono completo solo para este detalle
 * decorativo.
 */
function shrinkToward(points: LocalQuad, insetPx: number): LocalQuad {
  const cx = (points[0][0] + points[1][0] + points[2][0] + points[3][0]) / 4;
  const cy = (points[0][1] + points[1][1] + points[2][1] + points[3][1]) / 4;
  return points.map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const len = Math.hypot(dx, dy) || 1;
    const t = Math.min(1, insetPx / len);
    return [x + dx * t, y + dy * t];
  }) as LocalQuad;
}

/**
 * Redondea las 4 esquinas de un cuadrilátero para usarlas en un
 * `clip-path: polygon(...)` (esa propiedad no soporta `border-radius`, así
 * que el redondeo hay que trazarlo punto a punto). Técnica estándar de
 * "rounded polygon": en cada vértice, recorta `radius` px sobre cada arista
 * adyacente (los puntos `A` y `B`) y une esos dos puntos con una curva de
 * Bézier cuadrática usando el vértice ORIGINAL como punto de control —
 * `B(t) = (1-t)²·A + 2(1-t)t·P + t²·B` — muestreada en `segments` tramos.
 *
 * El cuadrilátero NO es un rectángulo (son 4 esquinas medidas a mano en
 * perspectiva, con ángulos ligeramente distintos entre sí), así que los
 * puntos de corte se calculan con el vector unitario REAL de cada arista
 * (no un offset fijo en x/y): funciona igual de bien en una esquina de 80°
 * que en una de 100°. `radius` se clampa a la mitad de cada arista adyacente
 * para que dos esquinas contiguas nunca "invadan" el mismo tramo de borde en
 * lados cortos.
 *
 * Devuelve la lista de puntos YA cerrada implícitamente (el último punto de
 * la esquina 4 conecta, vía el cierre automático del `polygon()`, con el
 * primer punto de la esquina 1) — no repite el primer punto al final.
 */
function roundedQuadPoints(quad: LocalQuad, radius: number, segments = 6): [number, number][] {
  const n = quad.length;
  const points: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const prev = quad[(i - 1 + n) % n];
    const curr = quad[i];
    const next = quad[(i + 1) % n];
    const lenToPrev = dist(curr, prev);
    const lenToNext = dist(curr, next);
    const r = Math.max(0, Math.min(radius, lenToPrev / 2, lenToNext / 2));
    const dirToPrev: [number, number] = [(prev[0] - curr[0]) / (lenToPrev || 1), (prev[1] - curr[1]) / (lenToPrev || 1)];
    const dirToNext: [number, number] = [(next[0] - curr[0]) / (lenToNext || 1), (next[1] - curr[1]) / (lenToNext || 1)];
    const a: [number, number] = [curr[0] + dirToPrev[0] * r, curr[1] + dirToPrev[1] * r];
    const b: [number, number] = [curr[0] + dirToNext[0] * r, curr[1] + dirToNext[1] * r];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const mt = 1 - t;
      points.push([mt * mt * a[0] + 2 * mt * t * curr[0] + t * t * b[0], mt * mt * a[1] + 2 * mt * t * curr[1] + t * t * b[1]]);
    }
  }
  return points;
}

/**
 * `clip-path: polygon(evenodd, ...)` con dos contornos cerrados (exterior +
 * interior, cada uno ya redondeado por `roundedQuadPoints`) en una sola
 * lista de puntos: exterior, de vuelta a su primer punto, "puente" hacia el
 * interior, interior, de vuelta a su primer punto. El puente de ida y el
 * cierre implícito del último punto al primero (interior -> exterior)
 * recorren la MISMA línea en sentidos opuestos, así que no dejan corte
 * visible; con la regla `evenodd` el área entre ambos contornos queda
 * pintada y el interior (encerrado por número par de bordes) se cancela —
 * el resultado es un marco de esquinas redondeadas, no un relleno.
 */
function frameClipPath(
  outer: LocalQuad,
  inner: LocalQuad,
  outerCornerRadius = EDGE_GLOW_OUTER_CORNER_RADIUS,
  innerCornerRadius = EDGE_GLOW_INNER_CORNER_RADIUS,
): string {
  const pt = ([x, y]: readonly [number, number]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  const outerPts = roundedQuadPoints(outer, outerCornerRadius);
  const innerPts = roundedQuadPoints(inner, innerCornerRadius);
  const path = [...outerPts, outerPts[0], ...innerPts, innerPts[0]];
  return `polygon(evenodd, ${path.map(pt).join(", ")})`;
}

/**
 * `clip-path: polygon(...)` de UN solo contorno (la silueta exterior
 * completa del panel, ya redondeada), sin recortar un marco delgado. La usa
 * el halo difuminado de `.edgeGlowHalo`: a diferencia de `frameClipPath`
 * (banda de ~16px, sin margen donde un `blur()` pueda decaer), este clip le
 * da al halo todo el panel como lienzo para que el desenfoque se note como
 * una difuminación real hacia el interior en vez de cortarse de golpe en el
 * borde del marco nítido.
 */
function silhouetteClipPath(outer: LocalQuad, cornerRadius = EDGE_GLOW_OUTER_CORNER_RADIUS): string {
  const pt = ([x, y]: readonly [number, number]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  return `polygon(${roundedQuadPoints(outer, cornerRadius).map(pt).join(", ")})`;
}

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

function ProjectGrid({
  pieces,
  cols,
  w,
  h,
}: {
  pieces: HeroPiece[];
  cols: number;
  w: number;
  h: number;
}) {
  const GAP = 12;
  const PAD = 12;
  // Rows siempre exactas: cada slice que llega aquí tiene el tamaño fijo de
  // PANEL_SLOTS (fillSlots rellena ciclando el feed), así que nunca hay una
  // fila incompleta a medias.
  const rows = Math.max(1, Math.ceil(pieces.length / cols));
  // Alto/ancho real de una celda, usado SOLO para calcular el aspect ratio
  // que decide el eje de recorte del overscan de YouTube dentro de
  // VideoCover (ver `fill` en ese componente) — la celda en sí se sigue
  // dimensionando con `gridAutoRows: "1fr"` más abajo, no con este cálculo.
  const cellW = (w - PAD * 2 - GAP * (cols - 1)) / cols;
  const cellH = (h - PAD * 2 - GAP * (rows - 1)) / rows;
  const cellAspect = `${Math.max(1, Math.round(cellW))} / ${Math.max(1, Math.round(cellH))}`;

  return (
    <div
      style={{
        // Tamaño EXPLÍCITO, no 100%: el wrapper `Fitted` solo lleva la matriz
        // y no tiene dimensiones propias, así que un porcentaje se resolvía
        // contra el contenedor posicionado más cercano (el hero entero) y la
        // rejilla salía gigante, desbordando muy por fuera del cristal.
        width: w,
        height: h,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        // Filas de alto IGUAL y determinista: con "auto" (el default) el
        // alto de cada fila depende del contenido, y un <video>/iframe no
        // fuerza el mismo alto 100% que un <img> con height:100%. Con 1fr
        // todas las filas reparten el alto total del panel por igual, sin
        // importar qué se pinte dentro de cada celda.
        gridAutoRows: "1fr",
        gap: GAP,
        padding: PAD,
        boxSizing: "border-box",
      }}
    >
      {pieces.map((piece) => {
        const isVideo = piece.coverKind === "video";
        return (
          <a
            key={piece.id}
            href={piece.href}
            // El contenedor raíz del hero tiene pointerEvents "none" para no
            // interceptar clics fuera del foco: se reactiva SOLO aquí. Sin
            // href (pieza sin username resoluble) el enlace no navega a
            // ningún lado, así que tampoco vale la pena hacerlo clicable.
            style={{
              position: "relative",
              display: "block",
              overflow: "hidden",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.16)",
              // Las portadas se ven a TRAVÉS del cristal y bajo el overlay
              // oscuro del hero: sin realce quedan lavadas.
              filter: "saturate(1.15) contrast(1.08) brightness(1.3)",
              pointerEvents: piece.href ? "auto" : "none",
              cursor: piece.href ? "pointer" : "default",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
            // Estos proyectos viven dentro de un subárbol aria-hidden (son
            // decorativos: los mismos casos de estudio son alcanzables desde
            // HomeShowcase más abajo), así que no deben entrar al orden de
            // tabulación aunque el mouse sí pueda hacer clic sobre ellos.
            tabIndex={-1}
            // Antes vivían en el <img> directo; al pasar la rama de imagen
            // por <Media> (next/image) ya no hay forma de pasarle handlers al
            // <img> interno. `dragstart`/`contextmenu` burbujean en el DOM,
            // así que capturarlos acá (nivel del link) previene el arrastre
            // fantasma / menú contextual sobre CUALQUIER hijo, imagen o
            // video por igual.
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {isVideo ? (
              // `fill`: la celda ya tiene alto determinista (gridAutoRows
              // 1fr arriba), así que VideoCover debe llenarla exacto en vez
              // de derivar su propio alto del `aspectRatio` (pensado para
              // las tarjetas de HomeShowcase, que no fijan alto).
              <VideoCover
                youtubeId={piece.youtubeId}
                src={resolveCoverSrc(piece.image)}
                alt=""
                aspectRatio={cellAspect}
                fill
                background="neutral-alpha-weak"
              />
            ) : (
              // `fill`: mismo motivo que VideoCover arriba — la celda ya
              // tiene tamaño determinista (gridAutoRows 1fr), así que Media
              // debe llenarla exacto. `piece.image` puede ser una data URL
              // (piezas de antes de la migración a Supabase Storage, ver
              // coverMedia.ts): next/image la sirve `unoptimized`
              // automáticamente (ver get-img-props.js), no truena.
              <Media
                src={piece.image}
                alt=""
                fill
                objectFit="cover"
                sizes="(max-width: 768px) 50vw, 340px"
                style={{ width: "100%", height: "100%", position: "relative" }}
              />
            )}
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
          </a>
        );
      })}
    </div>
  );
}

export function HeroParallax({
  pieces = [],
  ambientRef,
}: {
  pieces?: HeroPiece[];
  /** Ancestro común (normalmente `heroRef` de HomeHero.tsx) sobre el que
   *  también se fijan --spot-x/-y cada frame, sin listener ni rAF nuevos:
   *  al heredarse por CSS hacia cualquier descendiente, permite pintar
   *  capas que reaccionan al cursor DESPUÉS de HeroParallax en el árbol
   *  (p.ej. el bloom ambiental de HomeHero, que necesita pintarse encima
   *  del overlay oscuro fijo). */
  ambientRef?: React.RefObject<HTMLElement | null>;
}) {
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
        if (!el) return;
        const ldx = -s.x * layer.depth;
        const ldy = -s.y * layer.depth;
        el.style.transform = `translate3d(${ldx}px, ${ldy}px, 0) scale(1.06)`;
        if (i === MONITOR_LAYER_INDEX) {
          // El logo del monitor vive DENTRO de esta capa (mismo transform,
          // ver JSX más abajo) para moverse pegado a la imagen del monitor,
          // no al vidrio (depth distinto: 26 vs GLASS_DEPTH 44). Con las
          // --spot-x/-y del vidrio el logo se despegaría del cursor en
          // cuanto este se alejara del centro.
          el.style.setProperty("--spot-x", `${s.px - ldx}px`);
          el.style.setProperty("--spot-y", `${s.py - ldy}px`);
        }
      });

      const dx = -s.x * GLASS_DEPTH;
      const dy = -s.y * GLASS_DEPTH;
      const glass = glassRef.current;
      if (glass) {
        glass.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.06)`;
        // --spot-x/-y se fijan aquí, en el contenedor común de la máscara
        // (revealRef) y el halo, para calcular el desplazamiento una sola
        // vez por frame: ambos heredan las custom properties vía CSS normal.
        // Sin restarle `dx`/`dy` (el propio desplazamiento del parallax), el
        // foco se despegaría del cursor.
        glass.style.setProperty("--spot-x", `${s.px - dx}px`);
        glass.style.setProperty("--spot-y", `${s.py - dy}px`);
      }

      // Bloom ambiental (HomeHero.tsx): `ambientRef` es el ancestro común sin
      // transform propio (a diferencia de `glass`), así que usa las mismas
      // `s.px`/`s.py` SIN restar `dx`/`dy` — ese ajuste solo compensa el
      // desplazamiento de parallax del propio `glass`, que `ambientRef` no
      // comparte.
      const ambient = ambientRef?.current;
      if (ambient) {
        ambient.style.setProperty("--spot-x", `${s.px}px`);
        ambient.style.setProperty("--spot-y", `${s.py}px`);
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
  const toLocal = (q: Quad): LocalQuad => q.map((uv) => uvToLocal(uv, size.w, size.h)) as LocalQuad;

  // Única fuente de verdad para el encuadre: el mismo `computeSceneFraming`
  // que usa `uvToLocal` (vía `toLocal` arriba) decide el `background-size`/
  // `background-position` en px de las 4 capas. Si `size` aún no se midió
  // (primer frame antes del ResizeObserver), cae al tamaño nativo — invisible
  // de todas formas, tapado por la pantalla de carga.
  const framing = computeSceneFraming(size.w, size.h);
  const sceneBackgroundSize = `${framing.drawnW}px ${framing.drawnH}px`;
  const sceneBackgroundPosition = `${framing.offsetX}px ${framing.offsetY}px`;

  const layerBase = {
    position: "absolute",
    inset: 0,
    transform: "translate3d(0,0,0) scale(1.06)",
    backgroundSize: sceneBackgroundSize,
    backgroundPosition: sceneBackgroundPosition,
    backgroundRepeat: "no-repeat",
  } as const;

  let cursor = 0;
  const panelSlices = HERO_PANELS.map((_, i) => {
    const slice = slots.slice(cursor, cursor + PANEL_SLOTS[i]);
    cursor += PANEL_SLOTS[i];
    return slice;
  });

  return (
    <>
      {/* Precarga explícita: con `background-image` en CSS el navegador no
          descubre estas 4 imágenes hasta que resuelve los estilos (más tarde
          que un <img>/<link> del HTML inicial). React 19/Next hoistea
          cualquier <link> renderizado en el árbol al <head> real,
          deduplicado por href, así que esto es válido aunque viva dentro de
          un componente "use client" montado a mitad del árbol.

          Dos <link> por capa, cada uno con `media`: el navegador solo
          descarga el que matchea, igual que la media query de
          HeroParallax.module.scss — así el móvil no se baja las dos
          variantes (la de escritorio por el preload + la `@0.5x` real del
          CSS). `media` en <link rel="preload"> es la única vía soportada
          para condicionar un preload por viewport sin depender de la
          heurística de densidad de `imagesrcset`/`imagesizes` (que resuelve
          por dppx, no por ancho de contenedor, y aquí lo que cambia es el
          ancho). */}
      {HERO_LAYER_FILES.map((file) => (
        <link
          key={`${file}-compact`}
          rel="preload"
          as="image"
          href={`${BASE}/${compactVariant(file)}`}
          media={COMPACT_MEDIA_QUERY}
        />
      ))}
      {HERO_LAYER_FILES.map((file) => (
        <link
          key={`${file}-full`}
          rel="preload"
          as="image"
          href={`${BASE}/${file}`}
          media="(min-width: 769px)"
        />
      ))}
      <div
        ref={rootRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          // En vertical (móvil/tablet) la escena ya no llena el alto —
          // `computeSceneFraming` la encoge para que quepan los tres cristales
          // a lo ancho (ver heroPanelGeometry.ts) — así que queda un tramo sin
          // imagen debajo. Mismo tono que el scrim inferior de HomeHero
          // (rgba(4,8,14,...)) para que el hueco se lea como parte de la misma
          // escena oscura, no como un corte en blanco detrás de la foto.
          backgroundColor: "#04080e",
        }}
      >
        {LAYERS.map((layer, i) => (
          <div
            key={layer.src}
            ref={(el) => {
              layerRefs.current[i] = el;
            }}
            className={layer.bgClass}
            style={{
              ...layerBase,
              willChange: enabled ? "transform" : undefined,
            }}
          >
            {/* Logo sobre la pantalla apagada del monitor, al revelar: vive
              DENTRO de esta capa (no del vidrio) para compartir su mismo
              transform de parallax — ver MONITOR_LAYER_INDEX y el bucle
              rAF, que fija --spot-x/-y aquí mismo. Mismo mecanismo de
              máscara que los proyectos (MASK + --spot-x/-y), pero con SU
              PROPIA silueta de foco: reutilizar la del vidrio la
              desalinearía del monitor en cuanto el cursor se alejara del
              centro. */}
            {i === MONITOR_LAYER_INDEX && ready && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  // Sin puntero fino (táctil) o con prefers-reduced-motion no
                  // hay foco que seguir, así que se omite la máscara: el logo
                  // queda visible de entrada en vez de no aparecer nunca.
                  maskImage: enabled ? MASK : undefined,
                  WebkitMaskImage: enabled ? MASK : undefined,
                }}
              >
                <Fitted quad={toLocal(MONITOR_SCREEN.quad)} baseW={MONITOR_SCREEN.base.w}>
                  {({ w, h }) => (
                    <div
                      style={{
                        width: w,
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/trademark/icon-dark.svg"
                        alt=""
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          width: "38%",
                          height: "auto",
                          // icon-dark.svg ya es fill #f6f6f6 (pensado para
                          // fondos oscuros, como esta pantalla): sin invertir,
                          // solo un resplandor cian para que se lea "encendido"
                          // en vez de una calca plana pegada al vidrio.
                          filter: "drop-shadow(0 0 16px rgba(120,220,255,0.9))",
                          userSelect: "none",
                          ...({ WebkitUserDrag: "none" } as React.CSSProperties),
                        }}
                      />
                    </div>
                  )}
                </Fitted>
              </div>
            )}
          </div>
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

          {/* 1.5. Luz constante encendida detrás de cada cristal: mismo quad
               `outer` que la capa de desenfoque de arriba, pintado ANTES que
               el título y los proyectos (queda por debajo de ambos) y ANTES
               que la imagen del cristal (capa 4, la última del árbol), así
               se lee atravesando el vidrio en vez de flotar encima. No
               depende de `enabled` ni del cursor: se ve en reposo, en móvil
               y con prefers-reduced-motion por igual. */}
          {ready &&
            HERO_PANELS.map((panel: PanelQuad) => (
              <Fitted key={`glow-${panel.id}`} quad={toLocal(panel.outer)} baseW={panel.base.w}>
                {({ w, h }) => (
                  <div
                    style={{
                      width: w,
                      height: h,
                      borderRadius: 14,
                      background: PANEL_GLOW,
                      mixBlendMode: "plus-lighter",
                    }}
                  />
                )}
              </Fitted>
            ))}

          {/* 1.6. Resplandor de borde por cristal (mecánica "GlowCard"): sigue
               al mismo --spot-x/--spot-y que ya heredan MASK/revealRef desde
               `glassRef` (cero listeners nuevos). Sin cursor fino o con
               prefers-reduced-motion, --spot-x/-y nunca se fijan (el rAF de
               arriba no arranca si `!enabled`), así que `var(--spot-x,
               -9999px)` cae a su sentinela y el foco queda fuera de pantalla
               — mismo mecanismo de "ocultar en reposo" que ya usa MASK, sin
               necesitar un chequeo `enabled` aparte aquí. */}
          {ready &&
            HERO_PANELS.map((panel: PanelQuad) => {
              const outer = toLocal(panel.outer);
              const inner = shrinkToward(outer, EDGE_GLOW_INSET_PX);
              return (
                <Fragment key={`edge-glow-frame-${panel.id}`}>
                  {/* Halo difuminado: silueta EXTERIOR completa (no el marco
                      delgado), con blur real y menor alfa — se pinta ANTES
                      (queda detrás) del anillo nítido de abajo, para que el
                      "tubo de neón" se lea nítido por encima de su propia
                      difuminación. */}
                  <div
                    aria-hidden
                    className={styles.edgeGlowHalo}
                    style={{
                      clipPath: silhouetteClipPath(outer),
                      pointerEvents: "none",
                      ["--edge-glow-radius" as string]: `${EDGE_GLOW_RADIUS}px`,
                    }}
                  >
                    <div className={styles.edgeGlowHaloRing} />
                  </div>
                  <div
                    aria-hidden
                    className={styles.edgeGlow}
                    style={{
                      clipPath: frameClipPath(outer, inner),
                      pointerEvents: "none",
                      ["--edge-glow-radius" as string]: `${EDGE_GLOW_RADIUS}px`,
                    }}
                  >
                    <div className={styles.edgeGlowRing} />
                  </div>
                </Fragment>
              );
            })}

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

          {/* 3. Los proyectos.
               Con puntero fino el panel arranca transparente y es el cursor
               quien los revela bajo el foco. En TÁCTIL (o con
               prefers-reduced-motion) no hay cursor que dispare nada, así que
               mantener la máscara dejaba los paneles permanentemente vacíos:
               ahí se omite y los proyectos se ven desde el inicio. Las
               miniaturas siguen siendo enlaces, así que en móvil se pueden
               tocar directamente. */}
          {ready && pieces.length > 0 && (
            <div
              ref={revealRef}
              style={{
                position: "absolute",
                inset: 0,
                maskImage: enabled ? MASK : undefined,
                WebkitMaskImage: enabled ? MASK : undefined,
              }}
            >
              {HERO_PANELS.map((panel: PanelQuad, i) => (
                <Fitted key={`grid-${panel.id}`} quad={toLocal(panel.corners)} baseW={panel.base.w}>
                  {({ w, h }) => (
                    <ProjectGrid
                      pieces={panelSlices[i]}
                      cols={PANEL_SLOTS[i] <= 2 ? 1 : 2}
                      w={w}
                      h={h}
                    />
                  )}
                </Fitted>
              ))}
            </div>
          )}

          {/* 4. El cristal, encima de todo lo anterior. Mismo encuadre que las
               3 capas de atrás (sceneBackgroundSize/Position): es la misma
               foto, solo una rebanada de profundidad distinta. */}
          <div
            className={styles.glass}
            style={{
              position: "absolute",
              inset: 0,
              backgroundSize: sceneBackgroundSize,
              backgroundPosition: sceneBackgroundPosition,
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>
      </div>
    </>
  );
}

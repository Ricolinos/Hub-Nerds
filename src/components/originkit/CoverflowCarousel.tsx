"use client";

import { IconButton, Row } from "@once-ui-system/core";
import type { MotionValue } from "framer-motion";
import { motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CarouselPreviewFrame,
  type PreviewAspectRatio,
  useIsCarouselPreview,
} from "@/components/originkit/CarouselPreview";

/* ══════════════════════════════════════════════════════════════════════════
 * Coverflow Carousel — adaptado de "Coverflow Carousel" de Originkit.
 * https://www.originkit.dev/components/coverflowcarousel
 * Pedido al MCP el 2026-07-28 con stack: "nextjs", typescript: true.
 *
 * Del original se conserva INTACTA la mecánica, que es lo que da el efecto:
 *   · `relOf`  — distancia con signo de cada tarjeta al centro, envuelta en
 *                (-count/2, count/2] para que el bucle sea infinito y la
 *                costura caiga donde la opacidad ya es 0.
 *   · `xForRel` — desplazamiento horizontal por ranura (media activa + gap +
 *                media lámina, y de ahí un paso uniforme).
 *   · el driver de un solo rAF sobre un único `pos` MotionValue, del que
 *     cuelgan posición Y tamaño, para que la tarjeta crezca exactamente al
 *     ritmo al que se desliza.
 *
 * Lo VISUAL se reemplazó por el sistema de diseño, que es justo lo que pedía
 * la tarea. Fuera del original:
 *   · `GRADIENT_FALLBACKS` — siete degradados arcoíris hardcodeados
 *     (#ff6b6b, #4facfe…) de relleno detrás de cada imagen. Aquí el hueco es
 *     `--neutral-alpha-weak`, el mismo que usa el resto del visor.
 *   · `boxShadow: "0 24px 70px rgba(0,0,0,.55)"` y su borde interior blanco →
 *     `--shadow-xl` / `--shadow-l` y `--neutral-alpha-medium`, así la sombra
 *     sigue al tema en vez de asumir fondo oscuro.
 *   · flechas `<button>` con SVG inline, `arrowColor`/`arrowBackground` en
 *     hex y `borderRadius: "50%"` → `IconButton` de Once UI (variante
 *     secondary), que ya trae foco visible, tooltip y tamaños del sistema.
 *   · `radius` numérico 0-20 con su propia fórmula → `--radius-l`.
 *
 * Añadido siguiendo el checklist de docs/originkit.md:
 *   · tamaños derivados del contenedor (ResizeObserver), no los 600×400 /
 *     200×270 fijos de upstream — punto 4 del checklist.
 *   · el rAF se detiene fuera del viewport y con la pestaña oculta
 *     (IntersectionObserver + visibilitychange) — punto 2.
 *   · `prefers-reduced-motion` ya lo respetaba upstream (salta sin animar);
 *     aquí además desactiva el autoplay, que es el que genera movimiento no
 *     solicitado — punto 3.
 *   · `RenderTarget` (shim del canvas de Framer) eliminado — no aplica fuera
 *     de Framer y solo servía para congelar el render en export/thumbnail.
 *   · las tarjetas aceptan `ReactNode`, no solo `<img>`: el visor mete slides
 *     de video (`CarouselVideoSlide`) que deben seguir funcionando.
 *
 * Nota: la ficha del MCP dice que requiere Tailwind v4. No es cierto para
 * esta variante — el código entregado estila todo inline, sin una sola clase.
 * No se instaló nada; `framer-motion` ya estaba (^12.42.0).
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CoverflowSlide {
  key: string;
  content: ReactNode;
  alt?: string;
}

interface CoverflowCarouselProps {
  slides: CoverflowSlide[];
  /** Relación de aspecto de la tarjeta activa, ej. "16 / 9". */
  aspectRatio?: string;
  autoplay?: boolean;
  showArrows?: boolean;
}

/** Máximo de láminas a cada lado que se llegan a pintar (upstream: 6). */
const RENDER_RANGE = 6;
/** Segundos que tarda un salto de ranura y espera entre saltos del autoplay. */
const MOVE_DURATION = 0.45;
const AUTOPLAY_DWELL = 2.4;

type Sizing = {
  activeWidth: number;
  activeHeight: number;
  restWidth: number;
  restHeight: number;
  gap: number;
};

/**
 * Tamaños a partir del ancho disponible. Upstream los recibía en píxeles
 * fijos por props de Framer; aquí el bloque vive dentro del artículo, cuyo
 * ancho cambia con el viewport y con el propio contenedor del visor.
 */
function sizingFor(containerWidth: number, ratio: number): Sizing {
  // La tarjeta activa se queda en ~62% del ancho para que las vecinas
  // asomen a los dos lados; por debajo de eso el efecto deja de leerse y es
  // preferible que la imagen mande.
  const activeWidth = Math.max(
    180,
    Math.round(containerWidth * (containerWidth < 640 ? 0.72 : 0.62)),
  );
  const activeHeight = Math.round(activeWidth / ratio);
  // Las láminas laterales conservan la proporción pero recortadas en ancho:
  // upstream usaba 200×270 (vertical) contra una activa apaisada, lo que
  // deformaba el recorte de cualquier foto horizontal.
  const restWidth = Math.max(56, Math.round(activeWidth * 0.22));
  const restHeight = Math.round(activeHeight * 0.78);
  const gap = Math.max(8, Math.round(containerWidth * 0.02));
  return { activeWidth, activeHeight, restWidth, restHeight, gap };
}

/* ── Mecánica de upstream, sin cambios ─────────────────────────────────── */

function relOf(index: number, pos: number, count: number): number {
  let rel = (((index - pos) % count) + count) % count;
  if (rel > count / 2) rel -= count;
  return rel;
}

function xForRel(rel: number, s: Sizing): number {
  const ar = Math.abs(rel);
  const c1 = s.activeWidth / 2 + s.gap + s.restWidth / 2;
  const pitch = s.restWidth + s.gap;
  const mag = ar <= 1 ? ar * c1 : c1 + (ar - 1) * pitch;
  return (rel < 0 ? -1 : 1) * mag;
}

function blendForRel(rel: number): number {
  return Math.min(Math.abs(rel), 1);
}

/* ── Tarjeta ───────────────────────────────────────────────────────────── */

function Card({
  slide,
  index,
  pos,
  count,
  range,
  sizing,
  onSelect,
}: {
  slide: CoverflowSlide;
  index: number;
  pos: MotionValue<number>;
  count: number;
  range: number;
  sizing: Sizing;
  onSelect: ((index: number) => void) | undefined;
}) {
  const x = useTransform(pos, (p: number) => xForRel(relOf(index, p, count), sizing));
  const opacity = useTransform(pos, (p: number) => {
    const ar = Math.abs(relOf(index, p, count));
    return ar <= range ? 1 : ar >= range + 1 ? 0 : 1 - (ar - range);
  });
  const zIndex = useTransform(pos, (p: number) =>
    Math.round(1000 - Math.abs(relOf(index, p, count)) * 100),
  );
  const width = useTransform(pos, (p: number) => {
    const a = blendForRel(relOf(index, p, count));
    return sizing.activeWidth + (sizing.restWidth - sizing.activeWidth) * a;
  });
  const height = useTransform(pos, (p: number) => {
    const a = blendForRel(relOf(index, p, count));
    return sizing.activeHeight + (sizing.restHeight - sizing.activeHeight) * a;
  });
  // Upstream calculaba la sombra con dos rgba() negros fijos. Los tokens ya
  // traen la elevación del tema, así que solo se decide CUÁL según si la
  // tarjeta es la activa.
  const boxShadow = useTransform(pos, (p: number) =>
    Math.abs(relOf(index, p, count)) < 0.5 ? "var(--shadow-xl)" : "var(--shadow-l)",
  );

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        x,
        zIndex,
        opacity,
        cursor: onSelect ? "pointer" : "default",
      }}
      onClick={onSelect ? () => onSelect(index) : undefined}
    >
      <motion.div
        style={{
          x: "-50%",
          y: "-50%",
          width,
          height,
          // `position: relative` no es decorativo: los slides se pintan con
          // `Media fill` (next/image en modo fill), que exige un ancestro
          // posicionado — sin esto la tarjeta sale vacía.
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-l)",
          background: "var(--neutral-alpha-weak)",
          boxShadow,
          // El borde interior blanco de upstream asumía fondo oscuro; el
          // token alpha funciona en los dos temas.
          outline: "1px solid var(--neutral-alpha-medium)",
          outlineOffset: "-1px",
        }}
      >
        {slide.content}
      </motion.div>
    </motion.div>
  );
}

/* ── Componente ────────────────────────────────────────────────────────── */

export function CoverflowCarousel({
  slides,
  aspectRatio: aspectRatioProp = "16 / 9",
  autoplay: autoplayProp = false,
  showArrows = true,
}: CoverflowCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  // Solo en la página de laboratorio: cada instancia lleva su propio estado de
  // preview y su propia barra de controles. En el visor publicado
  // `isPreview` es false y mandan las props, así que el componente se comporta
  // exactamente igual que antes.
  const isPreview = useIsCarouselPreview();
  const [previewRatio, setPreviewRatio] = useState<PreviewAspectRatio>("16 / 9");
  // Con controles el autoplay arranca encendido, para que el botón de pausa
  // tenga algo que detener y se pueda comparar el movimiento entre estilos.
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const aspectRatio = isPreview ? previewRatio : aspectRatioProp;
  const autoplay = isPreview ? previewPlaying : autoplayProp;

  const count = Math.max(1, slides.length);
  const ratio = useMemo(() => {
    const [w, h] = aspectRatio.split("/").map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : 16 / 9;
  }, [aspectRatio]);

  const sizing = useMemo(() => sizingFor(containerWidth, ratio), [containerWidth, ratio]);
  // La costura del bucle debe caer donde la opacidad ya es 0 (ver relOf).
  const range = Math.max(1, Math.min(RENDER_RANGE, Math.floor(count / 2) - 1));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Driver de un solo rAF (upstream). `pos` alimenta posición y tamaño, así
     que la tarjeta crece exactamente mientras se desliza. */
  const pos = useMotionValue(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const autoplayingRef = useRef(false);
  const dwellAccRef = useRef(0);
  const reducedRef = useRef(prefersReducedMotion);
  reducedRef.current = prefersReducedMotion;
  // Añadido: sin esto el rAF sigue corriendo con el carrusel fuera de
  // pantalla o la pestaña en segundo plano (punto 2 del checklist).
  const visibleRef = useRef(true);

  const tick = useCallback(
    (t: number) => {
      const last = lastTRef.current ?? t;
      const dt = Math.min((t - last) / 1000, 1 / 30);
      lastTRef.current = t;

      const cur = pos.get();
      const diff = targetRef.current - cur;
      const step = (1 / MOVE_DURATION) * dt;
      const arriving = reducedRef.current || Math.abs(diff) <= step;

      if (arriving) {
        pos.set(targetRef.current);
        if (autoplayingRef.current && visibleRef.current) {
          dwellAccRef.current += dt;
          if (dwellAccRef.current >= AUTOPLAY_DWELL) {
            dwellAccRef.current = 0;
            targetRef.current += 1;
          }
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        rafRef.current = null;
        lastTRef.current = null;
        return;
      }

      pos.set(cur + Math.sign(diff) * step);
      rafRef.current = requestAnimationFrame(tick);
    },
    [pos],
  );

  const ensureRunning = useCallback(() => {
    if (rafRef.current == null) {
      lastTRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const goNext = useCallback(() => {
    targetRef.current += 1;
    ensureRunning();
  }, [ensureRunning]);

  const goPrev = useCallback(() => {
    targetRef.current -= 1;
    ensureRunning();
  }, [ensureRunning]);

  const goTo = useCallback(
    (index: number) => {
      const cur = targetRef.current;
      let d = index - cur;
      d = ((d % count) + count) % count;
      if (d > count / 2) d -= count;
      targetRef.current = cur + d;
      ensureRunning();
    },
    [ensureRunning, count],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  // Autoplay: solo si se pidió, hay más de una foto y el usuario no pidió
  // reducir movimiento.
  useEffect(() => {
    const on = autoplay && count > 1 && !prefersReducedMotion;
    autoplayingRef.current = on;
    if (on) {
      dwellAccRef.current = 0;
      ensureRunning();
    }
    return () => {
      autoplayingRef.current = false;
    };
  }, [autoplay, count, prefersReducedMotion, ensureRunning]);

  // Añadido (checklist punto 2): pausa fuera del viewport y con la pestaña
  // oculta. Al volver a ser visible el rAF se reanuda desde donde quedó.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = (visible: boolean) => {
      visibleRef.current = visible && document.visibilityState === "visible";
      if (visibleRef.current && autoplayingRef.current) ensureRunning();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => sync(entry.isIntersecting), { threshold: 0 });
    observer?.observe(el);
    const onVisibility = () => sync(visibleRef.current);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ensureRunning]);

  // Teclado: solo cuando el carrusel tiene el foco o el puntero encima, para
  // no secuestrar las flechas de la página.
  const focusedRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!focusedRef.current) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  if (slides.length === 0) return null;

  const stageStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    // El escenario alto lo fija la tarjeta activa más un respiro para la
    // sombra; upstream lo dejaba a un minHeight fijo de 240px.
    height: sizing.activeHeight + 32,
    overflow: "hidden",
    userSelect: "none",
    touchAction: "pan-y",
    isolation: "isolate",
  };

  const carousel = (
    <Row
      ref={containerRef}
      fillWidth
      position="relative"
      tabIndex={0}
      onMouseEnter={() => {
        focusedRef.current = true;
      }}
      onMouseLeave={() => {
        focusedRef.current = false;
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
      }}
      style={{ outline: "none" }}
    >
      <div style={stageStyle}>
        {containerWidth > 0 &&
          slides.map((slide, i) => (
            <Card
              key={slide.key}
              slide={slide}
              index={i}
              pos={pos}
              count={count}
              range={range}
              sizing={sizing}
              onSelect={goTo}
            />
          ))}
      </div>
      {showArrows && count > 1 && (
        <>
          <Row position="absolute" left="8" top="0" fillHeight vertical="center" zIndex={2}>
            <IconButton
              icon="chevronLeft"
              variant="secondary"
              size="l"
              tooltip="Anterior"
              onClick={goPrev}
            />
          </Row>
          <Row position="absolute" right="8" top="0" fillHeight vertical="center" zIndex={2}>
            <IconButton
              icon="chevronRight"
              variant="secondary"
              size="l"
              tooltip="Siguiente"
              onClick={goNext}
            />
          </Row>
        </>
      )}
    </Row>
  );

  // En el laboratorio, cada instancia lleva su propia barra flotante dentro de
  // su zona (ver CarouselPreview.tsx). Sin proveedor no se le pasan
  // manejadores y `CarouselPreviewFrame` devuelve los hijos tal cual.
  return (
    <CarouselPreviewFrame
      aspectRatio={isPreview ? previewRatio : undefined}
      onAspectRatioChange={isPreview ? setPreviewRatio : undefined}
      playing={isPreview ? previewPlaying : undefined}
      onPlayingChange={isPreview ? setPreviewPlaying : undefined}
    >
      {carousel}
    </CarouselPreviewFrame>
  );
}

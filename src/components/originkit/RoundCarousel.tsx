"use client";

import { Row } from "@once-ui-system/core";
import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCarouselPreview } from "@/components/originkit/CarouselPreview";

/* ══════════════════════════════════════════════════════════════════════════
 * Round Carousel — adaptado de "Round Carousel" de Originkit.
 * https://www.originkit.dev/components/roundcarousel
 * Pedido al MCP el 2026-07-28 con stack: "nextjs", typescript: true.
 *
 * Un anillo 3D: las fotos se reparten sobre un cilindro que gira solo y se
 * puede arrastrar. Del original se conserva INTACTA la geometría, que es lo
 * que produce el efecto:
 *   · `angle`  = 360 / n, y cada cara va a `rotateY(i * angle) translateZ(r)`.
 *   · `radius` = (ancho * factor) / (2 * tan(PI / n)) — el radio exacto para
 *     que n caras de ese ancho cierren el cilindro sin solaparse.
 *   · el anillo se compensa con `translateZ(-radius)` para que la cara
 *     frontal quede en el plano de la pantalla.
 *   · dos caras por foto (`backfaceVisibility: hidden`) con la de atrás
 *     atenuada, que es lo que da la sensación de ver el interior del tubo.
 *   · el rAF con arrastre + inercia (`vel *= 0.94`) y giro libre al soltar.
 *
 * Lo VISUAL se reemplazó por el sistema de diseño:
 *   · `background: "#000000"` a pantalla completa → transparente, para que se
 *     vea el fondo del artículo en vez de un rectángulo negro.
 *   · `boxShadow: "0 10px 30px rgba(0,0,0,0.35)"` → `--shadow-l`.
 *   · `cornerRadius: 22` px → `--radius-l`.
 *   · `#222` / `#181818` de relleno cuando falta imagen → `--neutral-alpha-weak`.
 *   · `backgroundImage: url(...)` en un div → `Media` de Once UI dentro de cada
 *     cara, para conservar next/image y el srcSet (upstream perdía las dos).
 *
 * Añadido siguiendo el checklist de docs/originkit.md:
 *   · ancho de foto derivado del contenedor (ResizeObserver), no los 300px
 *     fijos de upstream — punto 4.
 *   · el rAF se detiene fuera del viewport y con la pestaña oculta — punto 2.
 *     Upstream lo deja girando siempre, y este componente recalcula el
 *     transform de n·2 caras en cada frame.
 *   · `prefers-reduced-motion` detiene el giro libre; el arrastre manual sigue
 *     disponible — punto 3.
 *
 * Nota: la ficha del MCP dice que requiere Tailwind v4. No es cierto — el
 * código entregado estila todo inline. Este componente además no trae ninguna
 * dependencia npm.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface RoundSlide {
  key: string;
  content: ReactNode;
}

interface RoundCarouselProps {
  slides: RoundSlide[];
  /** Grados por segundo del giro libre. */
  speed?: number;
  direction?: "left" | "right";
  /** Proporción de cada cara. Upstream solo hacía caras cuadradas. */
  aspectRatio?: string;
}

/** Separación entre caras: 1 + spacing * 0.15 sobre el ancho (upstream). */
const SPACING_FACTOR = 1 + 3 * 0.15;
/** Inclinación del cilindro y profundidad de la perspectiva (upstream). */
const TILT_DEG = -7;
const PERSPECTIVE_PX = 3000;
/** Brillo de la cara interior: upstream lo llama innerDim (3.5 / 10). */
const INNER_FACE_BRIGHTNESS = 0.35;
const DRAG_SENSITIVITY = 0.3 * 5;

/** Ancho de cada cara según el ancho disponible; la altura sale del aspectRatio. */
function faceWidthFor(containerWidth: number): number {
  if (containerWidth <= 0) return 0;
  return Math.round(Math.min(300, Math.max(150, containerWidth * 0.34)));
}

export function RoundCarousel({
  slides,
  speed = 7,
  direction = "right",
  aspectRatio: aspectRatioProp = "1 / 1",
}: RoundCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Ver la nota en CoverflowCarousel: solo existe en el laboratorio; en el
  // visor publicado esto es `null` y manda la prop.
  const preview = useCarouselPreview();
  const aspectRatio = preview?.aspectRatio ?? aspectRatioProp;
  const paused = preview ? !preview.playing : false;

  const count = Math.max(1, slides.length);
  const faceWidth = faceWidthFor(containerWidth);
  const faceRatio = useMemo(() => {
    const [w, h] = aspectRatio.split("/").map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : 1;
  }, [aspectRatio]);
  // La altura sale de la proporción; el ancho es el que fija el radio del
  // anillo, así que cambiar de 16:9 a 9:16 hace el cilindro más alto y
  // estrecho sin alterar su geometría.
  const faceHeight = Math.round(faceWidth / faceRatio);
  // Geometría de upstream, sin cambios.
  const angle = 360 / count;
  const radius = useMemo(
    () => (faceWidth * SPACING_FACTOR) / (2 * Math.tan(Math.PI / count)),
    [faceWidth, count],
  );
  const degPerSec = speed * 6 * (direction === "left" ? -1 : 1);

  const rafRef = useRef<number | null>(null);
  const rotYRef = useRef(0);
  const velRef = useRef(0);
  const lastRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0 });
  // Añadido: sin esto el anillo recalcula n·2 transforms por frame aunque esté
  // fuera de pantalla o la pestaña esté en segundo plano (checklist punto 2).
  const visibleRef = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

  const apply = useCallback(() => {
    const ring = ringRef.current;
    if (ring) ring.style.transform = `translateZ(${-radius}px) rotateY(${rotYRef.current}deg)`;
  }, [radius]);

  const draw = useCallback(
    (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      lastRef.current = now;
      const f = Math.min(dt, 0.1);
      const d = dragRef.current;
      if (!d.active) {
        if (Math.abs(velRef.current) > 0.01) {
          // Inercia tras soltar: se conserva aunque haya reduced-motion,
          // porque es respuesta directa a un gesto del usuario.
          rotYRef.current += velRef.current * f;
          velRef.current *= 0.94;
        } else if (!reducedMotion && !paused) {
          rotYRef.current += degPerSec * f;
        } else {
          // Quieto y sin giro libre (pausado o reduced-motion): no hay nada
          // que animar, así que el rAF se detiene en vez de seguir pintando
          // el mismo frame.
          apply();
          rafRef.current = null;
          lastRef.current = 0;
          return;
        }
      }
      apply();
      if (!visibleRef.current && !d.active) {
        rafRef.current = null;
        lastRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(draw);
    },
    [apply, degPerSec, reducedMotion, paused],
  );

  const ensureRunning = useCallback(() => {
    if (rafRef.current == null) {
      lastRef.current = 0;
      rafRef.current = requestAnimationFrame(draw);
    }
  }, [draw]);

  useEffect(() => {
    if (faceWidth <= 0) return;
    apply();
    ensureRunning();
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [faceWidth, apply, ensureRunning]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = (onScreen: boolean) => {
      visibleRef.current = onScreen && document.visibilityState === "visible";
      if (visibleRef.current) ensureRunning();
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

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { active: true, x: e.clientX };
    velRef.current = 0;
    ensureRunning();
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    rotYRef.current += dx * DRAG_SENSITIVITY;
    velRef.current = dx * DRAG_SENSITIVITY * 60;
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragRef.current.active = false;
  };

  if (slides.length === 0) return null;

  const faceBase: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "var(--radius-l)",
    overflow: "hidden",
    backfaceVisibility: "hidden",
    background: "var(--neutral-alpha-weak)",
  };

  return (
    <Row ref={containerRef} fillWidth horizontal="center">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: el arrastre es un
          realce opcional, no la única vía al contenido — el anillo gira solo
          sin que haga falta interactuar. */}
      <div
        style={{
          width: "100%",
          // Alto del escenario: la cara más el aire que pide la inclinación.
          height: faceHeight > 0 ? Math.round(faceHeight * 1.3) : 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          perspective: `${PERSPECTIVE_PX}px`,
          cursor: "grab",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={{ transformStyle: "preserve-3d", transform: `rotateX(${TILT_DEG}deg)` }}>
          <div
            ref={ringRef}
            style={{
              position: "relative",
              width: faceWidth,
              height: faceHeight,
              transformStyle: "preserve-3d",
            }}
          >
            {faceWidth > 0 &&
              slides.map((slide, i) => (
                <div
                  key={slide.key}
                  style={{
                    position: "absolute",
                    inset: 0,
                    transform: `rotateY(${i * angle}deg) translateZ(${radius}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div style={{ ...faceBase, boxShadow: "var(--shadow-l)" }}>{slide.content}</div>
                  {/* Cara interior: la misma foto atenuada. Es lo que hace que
                      al girar se lea como el interior de un cilindro y no como
                      caras sueltas flotando. */}
                  <div
                    style={{
                      ...faceBase,
                      transform: "rotateY(180deg)",
                      filter: `brightness(${INNER_FACE_BRIGHTNESS})`,
                    }}
                  >
                    {slide.content}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </Row>
  );
}

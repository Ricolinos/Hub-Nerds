"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { IconButton, Row } from "@once-ui-system/core";
import { DesignerFront, type Designer } from "@/components/explore/DesignerDirectory";
import type { TalentCard } from "@/components/onboarding/TalentPreview";

/* ══════════════════════════════════════════════════════════════════════════
 * Coverflow 3D de talento — adaptado de "Coverflow Gallery" de Originkit.
 *
 * Del original se conserva SOLO la mecánica: la transformación 3D por tarjeta
 * (translate + rotateY + rotateZ + scale sobre un contenedor con perspective y
 * preserve-3d) y el orden de pintado por profundidad.
 *
 * Todo lo visual se descartó a propósito, porque chocaba con el sistema de
 * diseño: traía tamaños fijos en píxeles, colores hardcodeados (#1a1a1a de
 * fondo, blanco de título, degradados negros), un <img> crudo y tipografía a
 * 28px. En su lugar cada diapositiva renderiza el DesignerFront REAL de
 * Explorar, así que la tarjeta sigue siendo la del sistema y este componente
 * es solo la forma de presentarla.
 *
 * Nota: la ficha del componente afirma que requiere Tailwind v4. No es cierto
 * para esta variante — el código entregado usa únicamente estilos inline, sin
 * una sola clase. No se instaló nada.
 *
 * Añadido sobre el original, siguiendo el checklist del proyecto:
 *   · tamaño derivado del contenedor (ResizeObserver), no píxeles fijos
 *   · respeta prefers-reduced-motion
 *   · el autoplay se pausa fuera del viewport y con la pestaña oculta
 * ══════════════════════════════════════════════════════════════════════════ */

/** Solo se pintan la tarjeta activa y sus vecinas inmediatas a cada lado. */
const MAX_VISIBLE = 2;
const SCALE_STEP = 0.16;
const PERSPECTIVE = 1600;
const TILT_Y = 12;
const TILT_Z = 6;
const AUTOPLAY_MS = 3200;
const MOVE_MS = 600;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Ancho de tarjeta según el ancho disponible. La altura sale del 3:4. */
function cardWidthFor(containerWidth: number): number {
  if (containerWidth <= 0) return 240;
  // En móvil la tarjeta manda y las vecinas apenas asoman; en pantallas
  // grandes se acota para que el conjunto no crezca sin límite en 4K.
  if (containerWidth < 520) return Math.min(containerWidth * 0.6, 220);
  if (containerWidth < 900) return 260;
  return 300;
}

export function TalentCoverflow({ talent }: { talent: TalentCard[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(true);
  const lockRef = useRef(false);

  const n = talent.length;

  // Tamaño derivado del contenedor: el original usaba píxeles fijos y se
  // desbordaba en móvil / se quedaba diminuto en 4K.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(width);
    });
    observer.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Pausa fuera del viewport: sin esto el intervalo sigue corriendo y
  // recalculando transformaciones 3D para algo que nadie está viendo.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const step = useCallback(
    (dir: number) => {
      if (lockRef.current || n < 2) return;
      lockRef.current = true;
      window.setTimeout(() => {
        lockRef.current = false;
      }, MOVE_MS);
      setActive((a) => (((a + dir) % n) + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (reducedMotion || !inView || n < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setActive((a) => (a + 1) % n);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, inView, n]);

  const cardWidth = cardWidthFor(containerWidth);
  const cardHeight = Math.round((cardWidth * 4) / 3);
  // Separación y profundidad proporcionales al tamaño de tarjeta, no
  // constantes: es lo que mantiene la composición igual en 390px y en 4K.
  const spacing = cardWidth * 0.62;
  const depth = cardWidth * 0.7;

  const transitionCss = reducedMotion
    ? "none"
    : `transform ${MOVE_MS}ms ${EASE}, opacity ${MOVE_MS}ms ${EASE}`;

  const designers = useMemo(
    () =>
      talent.map<Designer>((person) => ({
        id: person.id,
        name: person.name,
        username: person.username,
        specialty: person.primaryRole ?? "",
        role: person.primaryRole ?? "",
        avatar: person.avatar ?? "",
        projectHref: "",
        projectTitle: "",
        featuredImageUrl: person.featuredImageUrl,
        cardQuote: null,
        headline: person.headline ?? person.primaryRole ?? "",
        bio: null,
        primaryRole: person.primaryRole,
        secondaryRoles: [],
        profileBrand: null,
        profileAccent: null,
        profileNeutral: null,
        profileBorder: null,
      })),
    [talent],
  );

  if (n === 0) return null;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-roledescription="carrusel"
      aria-label="Talento de la plataforma"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
      }}
      style={{
        position: "relative",
        width: "100%",
        // Sin minWidth (el original traía 320px, que desbordaba en 390).
        height: cardHeight + 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: `${PERSPECTIVE}px`,
        overflow: "hidden",
        outline: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: cardWidth,
          height: cardHeight,
          transformStyle: "preserve-3d",
        }}
      >
        {designers.map((designer, i) => {
          let rel = i - active;
          if (rel > n / 2) rel -= n;
          if (rel < -n / 2) rel += n;

          const distance = Math.abs(rel);
          const visible = distance <= MAX_VISIBLE;
          const isActive = rel === 0;

          const cardStyle: CSSProperties = {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            transformStyle: "preserve-3d",
            transformOrigin: "center center",
            transform: [
              "translate(-50%, -50%)",
              `translateX(${rel * spacing}px)`,
              `translateZ(${-distance * depth}px)`,
              `rotateY(${-rel * TILT_Y}deg)`,
              `rotateZ(${rel * TILT_Z}deg)`,
              `scale(${Math.max(0.4, 1 - distance * SCALE_STEP)})`,
            ].join(" "),
            transition: transitionCss,
            opacity: visible ? 1 : 0,
            cursor: isActive ? "default" : "pointer",
            pointerEvents: visible ? "auto" : "none",
            borderRadius: "var(--radius-l)",
            overflow: "hidden",
          };

          return (
            <div
              key={designer.id}
              style={cardStyle}
              aria-hidden={!visible}
              onClick={() => !isActive && setActive(i)}
            >
              <DesignerFront designer={designer} seed={designer.id.length} />
              {/* Atenuación de las tarjetas laterales con un token de la
                  paleta, no con negro fijo como en el original. */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--page-background)",
                  opacity: isActive ? 0 : 0.45,
                  transition: reducedMotion ? "none" : `opacity ${MOVE_MS}ms ${EASE}`,
                  pointerEvents: "none",
                }}
              />
            </div>
          );
        })}
      </div>

      {n > 1 && (
        <Row
          position="absolute"
          fillWidth
          horizontal="between"
          vertical="center"
          paddingX="8"
          style={{ left: 0, right: 0, pointerEvents: "none" }}
        >
          <span style={{ pointerEvents: "auto" }}>
            <IconButton
              icon="arrowLeft"
              variant="secondary"
              size="s"
              tooltip="Anterior"
              onClick={() => step(-1)}
            />
          </span>
          <span style={{ pointerEvents: "auto" }}>
            <IconButton
              icon="arrowRight"
              variant="secondary"
              size="s"
              tooltip="Siguiente"
              onClick={() => step(1)}
            />
          </span>
        </Row>
      )}
    </div>
  );
}

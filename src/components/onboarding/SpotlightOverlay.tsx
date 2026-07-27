"use client";

import { useEffect, useState } from "react";

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Sigue al elemento apuntado por `selector` y devuelve su rectángulo en
 * coordenadas de viewport, o null si no existe en esta página.
 *
 * Se re-mide en scroll, resize y ante cambios del DOM: el header es fijo pero
 * el resto se mueve, y una medición única dejaría el recorte desalineado en
 * cuanto el usuario hace scroll.
 */
export function useSpotlightRect(selector: string | undefined, active: boolean) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return;
    }

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = document.querySelector(selector);
        if (!el) {
          setRect(null);
          return;
        }
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          setRect(null);
          return;
        }
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      });
    };

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [selector, active]);

  return rect;
}

const PAD = 8;

/* Capa que oscurece la pantalla dejando "libre" el rectángulo señalado.
 *
 * No se usa un solo div con box-shadow gigante porque ese truco no permite
 * que el clic PASE por el hueco. Aquí se dibujan cuatro paneles (arriba,
 * abajo, izquierda, derecha) alrededor del objetivo: cada uno oscurece y
 * captura clics, y el hueco entre ellos queda literalmente descubierto, así
 * que el usuario solo puede interactuar con el elemento resaltado.
 *
 * Sin objetivo (`rect` null) oscurece la pantalla completa: sirve para las
 * paradas que solo informan, y como degradado elegante cuando el selector no
 * existe en la página actual. */
export function SpotlightOverlay({
  rect,
  onBlockedClick,
}: {
  rect: SpotlightRect | null;
  /** Se dispara al hacer clic en la zona oscurecida (para dar feedback). */
  onBlockedClick?: () => void;
}) {
  const shade: React.CSSProperties = {
    position: "fixed",
    background: "rgba(4, 8, 14, 0.72)",
    zIndex: 8,
    transition: "all 0.25s ease",
  };

  if (!rect) {
    return (
      <div
        aria-hidden
        onClick={onBlockedClick}
        style={{ ...shade, inset: 0 }}
      />
    );
  }

  const top = Math.max(0, rect.top - PAD);
  const left = Math.max(0, rect.left - PAD);
  const right = rect.left + rect.width + PAD;
  const bottom = rect.top + rect.height + PAD;

  return (
    <>
      <div aria-hidden onClick={onBlockedClick} style={{ ...shade, top: 0, left: 0, right: 0, height: top }} />
      <div aria-hidden onClick={onBlockedClick} style={{ ...shade, top: bottom, left: 0, right: 0, bottom: 0 }} />
      <div aria-hidden onClick={onBlockedClick} style={{ ...shade, top, left: 0, width: left, height: bottom - top }} />
      <div aria-hidden onClick={onBlockedClick} style={{ ...shade, top, left: right, right: 0, height: bottom - top }} />
      {/* Marco del hueco. pointerEvents none para no robar el clic al elemento
          real que hay debajo, que es justo lo que el usuario debe pulsar. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          top,
          left,
          width: right - left,
          height: bottom - top,
          borderRadius: 12,
          boxShadow: "0 0 0 2px var(--brand-solid-strong), 0 0 24px 4px rgba(0,0,0,0.35)",
          pointerEvents: "none",
          zIndex: 9,
          transition: "all 0.25s ease",
        }}
      />
    </>
  );
}

"use client";

import { Column, Row, Slider, Text } from "@once-ui-system/core";
import { useEffect, useRef, useState } from "react";

/* ══ Encuadre arrastrable con zoom (compartido) ═════════════════════════
   Extraído de la duplicación entre AvatarCropper (ClientProfileEditDialogs,
   cuadrado/circular) y FeaturedImageCropper (FreelancerProfileEditDialogs,
   vertical 3:4): mismo mecanismo de arrastre + zoom + export a canvas,
   parametrizado por el tamaño del viewport/salida y la máscara de guía.
   También usado por ProjectLogoEditDialog (logotipo del proyecto). ═══════ */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

const JPEG_QUALITIES = [0.82, 0.7, 0.55, 0.4];

export function loadImageFromUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    // Error real en lugar del Event crudo: sin esto un rechazo no capturado
    // aparece en consola como "[object Event]"
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

// Comprime el canvas a JPEG bajando la calidad hasta caber en el límite.
export function canvasToDataUrl(canvas: HTMLCanvasElement, maxChars: number): string {
  for (const quality of JPEG_QUALITIES) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxChars) return dataUrl;
  }
  throw new Error("La imagen es demasiado pesada incluso comprimida.");
}

export interface ImageCropperProps {
  file: File;
  // Se llama con la data URL final (o null si algo falla al exportar).
  exportRef: React.MutableRefObject<(() => Promise<string | null>) | null>;
  // Lado (cuadrado) o ancho/alto del viewport en pantalla y de la salida.
  viewWidth: number;
  viewHeight: number;
  outputWidth: number;
  outputHeight: number;
  maxDataUrlChars: number;
  // "circle" dibuja una guía circular (avatar/logo); "none" deja el recorte
  // rectangular tal cual (imagen destacada 3:4).
  maskShape?: "circle" | "none";
  ariaLabel?: string;
  helperText?: string;
}

export function ImageCropper({
  file,
  exportRef,
  viewWidth,
  viewHeight,
  outputWidth,
  outputHeight,
  maxDataUrlChars,
  maskShape = "none",
  ariaLabel = "Arrastra la imagen para reencuadrarla",
  helperText = "Arrastra la imagen para centrarla o reencuadrarla",
}: ImageCropperProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    let cancelled = false;
    setUrl(objectUrl);
    setOffset({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setDims(null);
    loadImageFromUrl(objectUrl)
      .then((img) => {
        if (!cancelled) setDims({ w: img.naturalWidth, h: img.naturalHeight });
      })
      // El cleanup revoca la URL con la carga en vuelo (StrictMode monta el
      // efecto dos veces en dev): ese onerror es esperado, no un fallo real.
      .catch(() => undefined);
    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const baseScale = dims ? Math.max(viewWidth / dims.w, viewHeight / dims.h) : 1;
  const scale = baseScale * zoom;
  const maxX = dims ? Math.max(0, (dims.w * scale - viewWidth) / 2) : 0;
  const maxY = dims ? Math.max(0, (dims.h * scale - viewHeight) / 2) : 0;
  const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

  // Al bajar el zoom los límites se encogen: re-encajar el offset para que
  // nunca queden bordes vacíos dentro del viewport.
  const handleZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    if (!dims) return;
    const nextScale = baseScale * nextZoom;
    const nextMaxX = Math.max(0, (dims.w * nextScale - viewWidth) / 2);
    const nextMaxY = Math.max(0, (dims.h * nextScale - viewHeight) / 2);
    setOffset((current) => ({
      x: clamp(current.x, nextMaxX),
      y: clamp(current.y, nextMaxY),
    }));
  };

  useEffect(() => {
    exportRef.current = async () => {
      if (!url || !dims) return null;
      const img = await loadImageFromUrl(url);
      const srcW = viewWidth / scale;
      const srcH = viewHeight / scale;
      const srcX = (dims.w - srcW) / 2 - offset.x / scale;
      const srcY = (dims.h - srcH) / 2 - offset.y / scale;
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputWidth, outputHeight);
      return canvasToDataUrl(canvas, maxDataUrlChars);
    };
    return () => {
      exportRef.current = null;
    };
  }, [
    url,
    dims,
    offset,
    scale,
    exportRef,
    viewWidth,
    viewHeight,
    outputWidth,
    outputHeight,
    maxDataUrlChars,
  ]);

  return (
    <Column gap="8" horizontal="center" fillWidth>
      <div
        role="application"
        aria-label={ariaLabel}
        style={{
          width: viewWidth,
          height: viewHeight,
          position: "relative",
          overflow: "hidden",
          borderRadius: "var(--radius-l)",
          touchAction: "none",
          cursor: dragRef.current ? "grabbing" : "grab",
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          setOffset({
            x: clamp(drag.ox + (e.clientX - drag.startX), maxX),
            y: clamp(drag.oy + (e.clientY - drag.startY), maxY),
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        {url && dims && (
          // eslint-disable-next-line @next/next/no-img-element -- objectURL local, sin optimización posible
          // biome-ignore lint/performance/noImgElement: objectURL local, sin optimización posible
          <img
            src={url}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: dims.w * scale,
              height: dims.h * scale,
              maxWidth: "none",
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
        {maskShape === "circle" && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.45)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <Row gap="12" vertical="center" style={{ width: viewWidth }}>
        <Text variant="label-default-s" onBackground="neutral-weak">
          Zoom
        </Text>
        <Slider
          aria-label="Zoom de la imagen"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={zoom}
          onChange={handleZoom}
          disabled={!dims}
        />
      </Row>
      <Text variant="label-default-s" onBackground="neutral-weak">
        {helperText}
      </Text>
    </Column>
  );
}

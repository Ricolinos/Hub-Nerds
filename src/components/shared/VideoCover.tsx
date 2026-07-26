"use client";

import { Column, type Colors } from "@once-ui-system/core";
import type { CSSProperties } from "react";
import { youtubeEmbedLoopUrl } from "@/lib/coverMedia";

/* ══ Portada de video con reproducción real (compartido) ═════════════════
   Extraído del cover de video duplicado en HomeShowcase/ExploreFeed/
   ProfileView: antes mostraba una miniatura ESTÁTICA + badge de "play" que
   no reproducía nada; ahora reproduce de verdad, silencioso y en loop.

   - Archivo .mp4/data URL: <video autoPlay muted loop playsInline>, cover
     normal vía objectFit.
   - YouTube: la miniatura estática no se puede reproducir, así que se
     reemplaza por un iframe de embed (`youtubeEmbedLoopUrl`) sin controles
     ni interacción (pointerEvents none, sin tabIndex) — el click debe caer
     en la card/SmartLink que envuelve el cover, no en el iframe.

   TRADE-OFF del "cover" en YouTube: el player de YouTube solo sabe pintar
   su contenido 16:9 con letterbox (franjas negras) si el iframe mismo no es
   16:9. Para lograr un cover real sin franjas, el iframe se dimensiona
   SIEMPRE en 16:9 (su aspect ratio nativo) sobredimensionado respecto al
   contenedor y se recorta con `overflow: hidden` del wrapper, centrado. Si
   el contenedor es más angosto que 16:9 (ej. 4:3, como en Home/perfil) se
   recortan los lados; si fuera más ancho se recortarían arriba/abajo (no
   ocurre hoy: los únicos aspect ratios en uso son 4:3 y 16:9). ══════════ */

const YOUTUBE_ASPECT = 16 / 9;

function parseAspectRatio(aspectRatio: string): number {
  const [w, h] = aspectRatio.split("/").map((part) => Number.parseFloat(part.trim()));
  return w && h ? w / h : YOUTUBE_ASPECT;
}

interface VideoCoverProps {
  /** id de YouTube si la portada es un link de YouTube, null si es archivo/data URL */
  youtubeId: string | null;
  /** src resuelto (coverSrc) para el <video> nativo, usado solo cuando youtubeId es null */
  src: string;
  alt: string;
  /** aspect ratio del contenedor, formato CSS "4 / 3". Con `fill` solo se usa
   *  para decidir el eje de recorte del overscan de YouTube (ver abajo), no
   *  para dimensionar la Column exterior. */
  aspectRatio: string;
  background?: Colors;
  /** El padre ya controla ambas dimensiones en píxeles (p.ej. una celda de
   *  grid con alto explícito, como los paneles del hero): usa `fill`
   *  (width/height 100%) en vez de derivar el alto del ancho vía CSS
   *  `aspect-ratio`, que dejaría la Column más corta o más alta que la
   *  celda real si su proporción no coincide EXACTO con `aspectRatio`. */
  fill?: boolean;
}

export function VideoCover({
  youtubeId,
  src,
  alt,
  aspectRatio,
  background = "neutral-alpha-medium",
  fill = false,
}: VideoCoverProps) {
  const containerRatio = parseAspectRatio(aspectRatio);
  // Contenedor más angosto (o igual) que 16:9 → llenar por alto, recortar
  // los lados. Contenedor más ancho que 16:9 → llenar por ancho, recortar
  // arriba/abajo.
  const overscanStyle: CSSProperties =
    containerRatio <= YOUTUBE_ASPECT
      ? {
          position: "absolute",
          top: 0,
          left: "50%",
          height: "100%",
          width: "auto",
          aspectRatio: "16 / 9",
          transform: "translateX(-50%)",
        }
      : {
          position: "absolute",
          top: "50%",
          left: 0,
          width: "100%",
          height: "auto",
          aspectRatio: "16 / 9",
          transform: "translateY(-50%)",
        };

  return (
    <Column
      fillWidth={!fill}
      fill={fill}
      radius="m"
      overflow="hidden"
      background={background}
      style={fill ? undefined : { aspectRatio }}
    >
      {youtubeId ? (
        <iframe
          src={youtubeEmbedLoopUrl(youtubeId)}
          title={alt}
          aria-hidden="true"
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          frameBorder={0}
          style={{ ...overscanStyle, border: "none", pointerEvents: "none" }}
        />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- autoplay muted decorativo, no hay audio que subtitular.
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
    </Column>
  );
}

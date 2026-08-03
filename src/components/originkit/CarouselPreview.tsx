"use client";

import { IconButton, Row, SegmentedControl, Text } from "@once-ui-system/core";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import styles from "./CarouselPreview.module.scss";

/* Controles de PREVISUALIZACIÓN de los carousels, uno POR INSTANCIA.
 *
 * Dos modos de proveedor, mismo componente (`CarouselPreviewMode`, prop
 * `mode`, default `"lab"`):
 *   · `"lab"` — la página de laboratorio (/ejercicios/markdown-showcase):
 *     todos los controles que aplique cada estilo, para comparar. El editor
 *     del bloque Carousel (ContentBlocks.tsx) también monta su preview en
 *     este modo, para que el autor vea justo lo que verá el espectador.
 *   · `"viewer"` — el visor público de un caso de estudio
 *     (app/[username]/proyecto/[slug]/page.tsx): SOLO Proporción y
 *     Play/Pausa (donde el carousel ya anima algo); Indicador y Velocidad
 *     quedan exclusivos del laboratorio. Los estados de este modo arrancan
 *     del valor GUARDADO por el autor (prop serializada), no de una
 *     constante — el espectador no debe ver "16:9" un instante antes de que
 *     salte a la proporción real elegida en el editor.
 * Sin proveedor (`useCarouselPreviewMode()` devuelve `null`,
 * `useIsCarouselPreview()` false), un carousel renderiza exactamente igual
 * que siempre, sin controles.
 *
 * Decisiones de la auditoría de cómo mostrarlos:
 *
 * · Barra flotante DENTRO de la zona del carousel, no una barra global fija.
 *   Con tres carousels en la página, una sola barra obligaba a recordar cuál
 *   estaba tocando y ocupaba alto de forma permanente. Anclada a su carousel,
 *   la relación entre control y efecto es inmediata.
 *
 * · Aparece al pasar el ratón y se desvanece al salir, para no competir con la
 *   imagen mientras se mira. Con tres salvedades que la hacen usable de
 *   verdad, todas en el .module.scss:
 *     - `:focus-within` además de `:hover`, o sería inalcanzable por teclado.
 *     - `pointer-events: none` mientras está oculta, o robaría clics al
 *       carousel (el anillo se arrastra sobre toda su superficie).
 *     - siempre visible en punteros táctiles (`@media (hover: none)`), donde
 *       el hover no existe.
 *
 * · Cada control se dibuja solo si su carousel lo necesita: se pasa el
 *   manejador o no. El carousel clásico de Once UI no anima nada, así que no
 *   recibe play/pausa; solo el anillo recibe velocidad.
 *
 * · Indicador (línea/miniaturas) SOLO en el carousel clásico —coverflow y
 *   anillo no tienen indicador propio (ver `MdxCarousel` en mdx-carousel.tsx,
 *   que solo se lo pasa a `ClassicCarousel`)— y SOLO en modo "lab": es la
 *   elección editorial real, así que quien la fija es el `Select`
 *   "Indicador" del editor del bloque (ContentBlocks.tsx), no el espectador.
 *   La barra de laboratorio la trae para comparar en vivo (y el editor monta
 *   su propio preview en modo "lab" para que el autor vea el mismo control
 *   dos veces, una editorial y otra de comparación); la prop `indicator`
 *   serializada en el markdown (ver blockToMarkdown case "mediaCarousel")
 *   es siempre el valor real fuera de ese modo.
 *
 * · Velocidad con "−/+" y lectura numérica, no barra deslizable. Once UI trae
 *   un `Slider`, pero (a) solo se exporta desde el subpath `/components`, no
 *   del índice, y (b) el anillo captura el arrastre en toda su superficie, así
 *   que una barra deslizable dentro de esa zona compite con ese gesto. Dos
 *   botones son objetivos grandes, funcionan igual con dedo y con teclado, y
 *   no tienen ese conflicto. */

export type PreviewMode = "lab" | "viewer";

const PreviewModeContext = createContext<PreviewMode | null>(null);

export function CarouselPreviewMode({
  children,
  mode = "lab",
}: {
  children: ReactNode;
  /** Default "lab": no rompe la showcase ni ningún llamador existente. */
  mode?: PreviewMode;
}) {
  return <PreviewModeContext.Provider value={mode}>{children}</PreviewModeContext.Provider>;
}

export function useCarouselPreviewMode(): PreviewMode | null {
  return useContext(PreviewModeContext);
}

/** Derivado de `useCarouselPreviewMode()`: true en "lab" o "viewer". */
export function useIsCarouselPreview(): boolean {
  return useCarouselPreviewMode() !== null;
}

export const PREVIEW_ASPECT_RATIOS = ["1 / 1", "9 / 16", "16 / 9", "4 / 5"] as const;

export type PreviewAspectRatio = (typeof PREVIEW_ASPECT_RATIOS)[number];

/** Guarda de tipo: ¿el valor serializado por el autor es una de las cuatro
 * proporciones que ofrece la barra? El editor no restringe `aspectRatio` a
 * ese conjunto (ver CAROUSEL_ASPECT_RATIO_OPTIONS en ContentBlocks.tsx, que
 * hoy además ofrece "4 / 3"), así que el estado inicial del control en modo
 * "viewer" necesita esta comprobación antes de usar el valor guardado. */
export function isPreviewAspectRatio(value: unknown): value is PreviewAspectRatio {
  return (
    typeof value === "string" && (PREVIEW_ASPECT_RATIOS as readonly string[]).includes(value)
  );
}

// Etiquetas con ":" sobre valores en la sintaxis de CSS que ya usan
// `aspectRatio` de Once UI y el markdown del editor.
const RATIO_LABELS: Record<PreviewAspectRatio, string> = {
  "1 / 1": "1:1",
  "9 / 16": "9:16",
  "16 / 9": "16:9",
  "4 / 5": "4:5",
};

export type PreviewIndicator = "line" | "thumbnail";

const INDICATOR_OPTIONS: { value: PreviewIndicator; label: string }[] = [
  { value: "line", label: "Línea" },
  { value: "thumbnail", label: "Miniaturas" },
];

/* Velocidad del anillo, en GRADOS POR SEGUNDO reales — que es lo que muestra
 * la lectura. Ojo: no coincide con la prop `speed` de upstream, que es un
 * número sin unidad que el componente multiplica por 6 para obtener los grados
 * por segundo; RoundCarousel hace esa conversión al conectar el control. Con
 * la escala equivocada la lectura decía "7°/s" mientras el anillo giraba a 42. */
export const SPEED_MIN = 6;
export const SPEED_MAX = 120;
export const SPEED_STEP = 12;

interface CarouselPreviewFrameProps {
  children: ReactNode;
  /** Proporción actual y su manejador. Sin manejador, no se dibuja. */
  aspectRatio?: PreviewAspectRatio;
  onAspectRatioChange?: (value: PreviewAspectRatio) => void;
  /** Animación. Sin manejador, no se dibuja (carousel clásico). */
  playing?: boolean;
  onPlayingChange?: (value: boolean) => void;
  /** Velocidad en grados por segundo reales. Sin manejador, no se dibuja. */
  speed?: number;
  onSpeedChange?: (value: number) => void;
  /** Indicador (línea/miniaturas). Sin manejador, no se dibuja (coverflow/anillo no tienen). */
  indicator?: PreviewIndicator;
  onIndicatorChange?: (value: PreviewIndicator) => void;
}

export function CarouselPreviewFrame({
  children,
  aspectRatio,
  onAspectRatioChange,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
  indicator,
  onIndicatorChange,
}: CarouselPreviewFrameProps) {
  const showRatio = onAspectRatioChange !== undefined && aspectRatio !== undefined;
  const showPlaying = onPlayingChange !== undefined && playing !== undefined;
  const showSpeed = onSpeedChange !== undefined && speed !== undefined;
  const showIndicator = onIndicatorChange !== undefined && indicator !== undefined;

  if (!showRatio && !showPlaying && !showSpeed && !showIndicator) return <>{children}</>;

  return (
    <div className={styles.zone}>
      {children}
      <Row
        className={styles.bar}
        gap="12"
        vertical="center"
        wrap
        horizontal="center"
        padding="8"
        radius="l"
        background="surface"
        border="neutral-alpha-medium"
        shadow="l"
      >
        {showRatio && (
          <SegmentedControl
            fillWidth={false}
            selected={aspectRatio}
            onToggle={(next) => onAspectRatioChange(next as PreviewAspectRatio)}
            buttons={PREVIEW_ASPECT_RATIOS.map((ratio) => ({
              value: ratio,
              label: RATIO_LABELS[ratio],
            }))}
          />
        )}
        {showIndicator && (
          <SegmentedControl
            fillWidth={false}
            selected={indicator}
            onToggle={(next) => onIndicatorChange(next as PreviewIndicator)}
            buttons={INDICATOR_OPTIONS}
          />
        )}
        {showPlaying && (
          <IconButton
            icon={playing ? "pause" : "play"}
            variant="secondary"
            size="m"
            tooltip={playing ? "Detener animación" : "Reanudar animación"}
            onClick={() => onPlayingChange(!playing)}
          />
        )}
        {showSpeed && (
          <Row gap="4" vertical="center">
            <IconButton
              icon="minus"
              variant="secondary"
              size="m"
              tooltip="Más lento"
              disabled={speed <= SPEED_MIN}
              onClick={() => onSpeedChange(Math.max(SPEED_MIN, speed - SPEED_STEP))}
            />
            {/* Ancho mínimo fijo: sin él, pasar de "54°/s" a "66°/s" (o a
                tres cifras) empuja el botón "+" y el puntero deja de estar
                encima justo al pulsarlo repetidamente. */}
            <Text
              variant="label-default-s"
              onBackground="neutral-weak"
              align="center"
              style={{ minWidth: "3.5rem" }}
            >
              {speed}°/s
            </Text>
            <IconButton
              icon="plus"
              variant="secondary"
              size="m"
              tooltip="Más rápido"
              disabled={speed >= SPEED_MAX}
              onClick={() => onSpeedChange(Math.min(SPEED_MAX, speed + SPEED_STEP))}
            />
          </Row>
        )}
      </Row>
    </div>
  );
}

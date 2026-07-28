"use client";

import { IconButton, Row, SegmentedControl, Text } from "@once-ui-system/core";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import styles from "./CarouselPreview.module.scss";

/* Controles de PREVISUALIZACIÓN de los carousels, uno POR INSTANCIA.
 *
 * Viven solo en la página de laboratorio (/ejercicios/markdown-showcase): son
 * para comparar estilos, no parte del visor publicado. `useIsCarouselPreview()`
 * devuelve false cuando no hay proveedor, así que un caso de estudio real
 * renderiza exactamente igual que antes, sin controles.
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
 * · Velocidad con "−/+" y lectura numérica, no barra deslizable. Once UI trae
 *   un `Slider`, pero (a) solo se exporta desde el subpath `/components`, no
 *   del índice, y (b) el anillo captura el arrastre en toda su superficie, así
 *   que una barra deslizable dentro de esa zona compite con ese gesto. Dos
 *   botones son objetivos grandes, funcionan igual con dedo y con teclado, y
 *   no tienen ese conflicto. */

const PreviewModeContext = createContext(false);

export function CarouselPreviewMode({ children }: { children: ReactNode }) {
  return <PreviewModeContext.Provider value={true}>{children}</PreviewModeContext.Provider>;
}

export function useIsCarouselPreview(): boolean {
  return useContext(PreviewModeContext);
}

export const PREVIEW_ASPECT_RATIOS = ["1 / 1", "9 / 16", "16 / 9", "4 / 5"] as const;

export type PreviewAspectRatio = (typeof PREVIEW_ASPECT_RATIOS)[number];

// Etiquetas con ":" sobre valores en la sintaxis de CSS que ya usan
// `aspectRatio` de Once UI y el markdown del editor.
const RATIO_LABELS: Record<PreviewAspectRatio, string> = {
  "1 / 1": "1:1",
  "9 / 16": "9:16",
  "16 / 9": "16:9",
  "4 / 5": "4:5",
};

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
}

export function CarouselPreviewFrame({
  children,
  aspectRatio,
  onAspectRatioChange,
  playing,
  onPlayingChange,
  speed,
  onSpeedChange,
}: CarouselPreviewFrameProps) {
  const showRatio = onAspectRatioChange !== undefined && aspectRatio !== undefined;
  const showPlaying = onPlayingChange !== undefined && playing !== undefined;
  const showSpeed = onSpeedChange !== undefined && speed !== undefined;

  if (!showRatio && !showPlaying && !showSpeed) return <>{children}</>;

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

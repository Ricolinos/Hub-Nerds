"use client";

import { Column, Row, SegmentedControl, Text } from "@once-ui-system/core";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

/* Controles de PREVISUALIZACIÓN de los carousels de Originkit.
 *
 * Viven solo en la página de laboratorio (/ejercicios/markdown-showcase): son
 * para comparar estilos, no parte del visor publicado. Por eso el estado viaja
 * por contexto y `useCarouselPreview()` devuelve `null` cuando no hay
 * proveedor — un caso de estudio real renderiza exactamente igual que antes,
 * sin controles y con los valores que traiga su propio markdown.
 *
 * El proveedor es un componente de cliente que recibe como `children` el árbol
 * YA renderizado en servidor por CustomMDX. Funciona porque en el cliente todo
 * termina siendo un solo árbol de React: los carousels ("use client") quedan
 * dentro del subárbol del proveedor y ven su contexto, aunque el MDX que los
 * contiene se haya compilado en el servidor. */

export const PREVIEW_ASPECT_RATIOS = ["1 / 1", "9 / 16", "16 / 9", "4 / 5"] as const;

export type PreviewAspectRatio = (typeof PREVIEW_ASPECT_RATIOS)[number];

interface CarouselPreviewState {
  aspectRatio: PreviewAspectRatio;
  /** false = la animación libre está detenida (giro del anillo, autoplay). */
  playing: boolean;
}

const CarouselPreviewContext = createContext<CarouselPreviewState | null>(null);

export function useCarouselPreview(): CarouselPreviewState | null {
  return useContext(CarouselPreviewContext);
}

// Etiquetas con ":" (como las pidió la tarea) sobre valores en la sintaxis de
// CSS que ya usan `aspectRatio` de Once UI y el markdown del editor.
const RATIO_LABELS: Record<PreviewAspectRatio, string> = {
  "1 / 1": "1:1",
  "9 / 16": "9:16",
  "16 / 9": "16:9",
  "4 / 5": "4:5",
};

export function CarouselPreviewControls({ children }: { children: ReactNode }) {
  const [aspectRatio, setAspectRatio] = useState<PreviewAspectRatio>("16 / 9");
  const [playing, setPlaying] = useState(true);

  const value = useMemo<CarouselPreviewState>(
    () => ({ aspectRatio, playing }),
    [aspectRatio, playing],
  );

  return (
    <CarouselPreviewContext.Provider value={value}>
      {/* `position: sticky` para que los controles sigan a mano mientras se
          recorre la página comparando los tres estilos, que están separados
          por varias pantallas de contenido.
          El desplazamiento de 80px NO es decorativo: la cabecera del sitio es
          fija y mide 48px en escritorio y 60px en móvil (medido en pantalla),
          así que con un `top` menor la barra se pega DEBAJO de ella y queda
          tapada a media altura. */}
      <Column
        fillWidth
        horizontal="center"
        position="sticky"
        top="80"
        zIndex={3}
        paddingBottom="24"
      >
        <Row
          gap="16"
          vertical="center"
          wrap
          horizontal="center"
          padding="12"
          radius="l"
          background="surface"
          border="neutral-alpha-medium"
          shadow="l"
        >
          <Row gap="8" vertical="center">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Proporción
            </Text>
            <SegmentedControl
              fillWidth={false}
              selected={aspectRatio}
              onToggle={(next) => setAspectRatio(next as PreviewAspectRatio)}
              buttons={PREVIEW_ASPECT_RATIOS.map((ratio) => ({
                value: ratio,
                label: RATIO_LABELS[ratio],
              }))}
            />
          </Row>
          <Row gap="8" vertical="center">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Animación
            </Text>
            <SegmentedControl
              fillWidth={false}
              selected={playing ? "play" : "pause"}
              onToggle={(next) => setPlaying(next === "play")}
              buttons={[
                { value: "play", label: "Activa", prefixIcon: "play" },
                { value: "pause", label: "Detenida", prefixIcon: "pause" },
              ]}
            />
          </Row>
        </Row>
      </Column>
      {children}
    </CarouselPreviewContext.Provider>
  );
}

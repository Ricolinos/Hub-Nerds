"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Column, Flex } from "@once-ui-system/core";
import { isFocusRoute } from "@/lib/onboarding";

// Rutas full-bleed: ocupan todo el ancho/alto disponible entre el Header y el
// fondo del viewport, sin el padding/centrado ni el Footer de página normal.
// /mensajes = layout tipo Messenger (scroll interno por panel, no del body).
const FULL_BLEED_ROUTES = ["/mensajes"];

// Rutas edge-to-edge: a diferencia de FULL_BLEED_ROUTES, SÍ conservan el
// Footer normal de página (el scroll sigue siendo el del body, no interno).
// Existe para el hero del home: necesita que su foto de fondo llegue a los
// bordes del viewport, cosa que el padding="l" + Flex centrado de abajo se lo
// impide. Match exacto (no startsWith) porque solo aplica a "/" — cualquier
// subruta futura bajo "/" debe seguir usando el layout centrado normal.
const EDGE_TO_EDGE_ROUTES = ["/"];

export function LayoutShell({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isFullBleed = FULL_BLEED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isEdgeToEdge = EDGE_TO_EDGE_ROUTES.some((route) => pathname === route);

  // Rutas enfocadas (bienvenida guiada): sin Footer y sin el padding/centrado
  // de página. El Header y la burbuja de chat se ocultan solos (ver
  // isFocusRoute en src/lib/onboarding.ts).
  if (isFocusRoute(pathname)) {
    return (
      <Column zIndex={0} fillWidth flex={1}>
        {children}
      </Column>
    );
  }

  if (isFullBleed) {
    // Sin padding ni horizontal="center": el contenido llena el ancho.
    // minHeight: 0 anula el min-height:auto por defecto de los flex items,
    // así este contenedor se acota al espacio restante del body (flex column,
    // minHeight 100dvh) en vez de crecer con el contenido — los paneles
    // internos (MessengerView) scrollean solos, el body no.
    return (
      <Flex zIndex={0} fillWidth flex={1} overflow="hidden" style={{ minHeight: 0 }}>
        {children}
      </Flex>
    );
  }

  if (isEdgeToEdge) {
    // `Column`, no `Flex`: el default de Flex es direction="row", que
    // pondría al hero y al resto del contenido lado a lado en vez de uno
    // debajo del otro (bug real, detectado en captura de verificación).
    return (
      <>
        <Column zIndex={0} fillWidth flex={1}>
          {children}
        </Column>
        {footer}
      </>
    );
  }

  return (
    <>
      <Flex zIndex={0} fillWidth padding="l" horizontal="center" flex={1}>
        <Flex horizontal="center" fillWidth>
          {children}
        </Flex>
      </Flex>
      {footer}
    </>
  );
}

import "@once-ui-system/core/css/styles.css";
import "@once-ui-system/core/css/tokens.css";
import "@/resources/custom.css";

import classNames from "classnames";
import type { Viewport } from "next";
import Script from "next/script";

import {
  Background,
  Column,
  Flex,
  Meta,
  Opacity,
  RevealFx,
  SpacingToken,
} from "@once-ui-system/core";
import { FloatingChatBubble, Footer, Header, LayoutShell, RouteGuard, Providers } from "@/components";
import { TourHost } from "@/components/onboarding/TourHost";
import { LIBRARY_FONT_VARIABLES } from "@/lib/fontLibrary";
import { baseURL, effects, fonts, style, dataStyle, home } from "@/resources";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata() {
  const metadata = Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
  return {
    ...metadata,
    // Patrón de Next.js: rutas sin generateMetadata propio (o que devuelven
    // un title de texto plano vía Meta.generate) heredan "Hub-Nerds" como
    // default, y las que sí definen su propio título ganan el sufijo " · Hub-Nerds"
    // automáticamente (Next solo aplica el template cuando el segmento hijo
    // resuelve un title string, no cuando define su propio objeto title).
    title: {
      default: "Hub-Nerds",
      template: "%s · Hub-Nerds",
    },
    // Favicon fijo en la variante `dark`, SIN condicionarlo a
    // prefers-color-scheme: antes se declaraban las dos variantes y el
    // navegador elegía según la preferencia del SO, así que en un equipo en
    // modo claro salía la versión light. Ahora que el sitio quedó fijo en
    // tema oscuro (once-ui.config.ts -> style.theme), la marca debe ser
    // consistente en la pestaña sin importar el SO del visitante.
    // A propósito NO existe src/app/icon.svg (convención de archivo): Next
    // le da precedencia sobre lo declarado aquí y pisaría esta declaración.
    // favicon.ico (convención de archivo) sigue de fallback para navegadores
    // sin soporte de SVG en <link rel="icon">.
    icons: {
      icon: [
        {
          url: "/trademark/favicon-dark.svg",
          type: "image/svg+xml",
        },
      ],
    },
  };
}

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <Flex
      suppressHydrationWarning
      as="html"
      lang="en"
      fillWidth
      data-brand={style.brand}
      data-accent={style.accent}
      data-neutral={style.neutral}
      data-solid={style.solid}
      data-solid-style={style.solidStyle}
      data-border={style.border}
      data-surface={style.surface}
      data-transition={style.transition}
      data-scaling={style.scaling}
      data-viz-style={dataStyle.variant}
      className={classNames(
        fonts.heading.variable,
        fonts.body.variable,
        fonts.label.variable,
        fonts.code.variable,
        // Biblioteca de fuentes del bloque "text" del editor de piezas (ver
        // src/lib/fontLibrary.ts) — SOLO expone las CSS variables
        // `--font-lib-*` para que `var(--font-lib-roboto)` etc. resuelvan en
        // cualquier parte del sitio; no altera fonts.heading/body/label/code
        // (fuentes del TEMA, sin tocar).
        ...LIBRARY_FONT_VARIABLES,
      )}
    >
      <head>
        {/* Defaults van como data-* en el propio <html> (SSR, sin FOUC).
            El script solo resuelve overrides en localStorage antes de hydration.
            src= en vez de dangerouslySetInnerHTML: React 19 emite
            "Encountered a script tag while rendering React component" para
            cualquier <script> con contenido inline, incluso vía next/script. */}
        <Script id="theme-init" src="/theme-init.js" strategy="beforeInteractive" />
      </head>
      <Providers>
        <Column
          as="body"
          background="page"
          fillWidth
          style={{ minHeight: "100dvh" }}
          margin="0"
          padding="0"
          horizontal="center"
          suppressHydrationWarning
        >
          <RevealFx fill position="absolute">
            <Background
              mask={{
                x: effects.mask.x,
                y: effects.mask.y,
                radius: effects.mask.radius,
                cursor: effects.mask.cursor,
              }}
              gradient={{
                display: effects.gradient.display,
                opacity: effects.gradient.opacity as Opacity,
                x: effects.gradient.x,
                y: effects.gradient.y,
                width: effects.gradient.width,
                height: effects.gradient.height,
                tilt: effects.gradient.tilt,
                colorStart: effects.gradient.colorStart,
                colorEnd: effects.gradient.colorEnd,
              }}
              dots={{
                display: effects.dots.display,
                opacity: effects.dots.opacity as Opacity,
                size: effects.dots.size as SpacingToken,
                color: effects.dots.color,
              }}
              grid={{
                display: effects.grid.display,
                opacity: effects.grid.opacity as Opacity,
                color: effects.grid.color,
                width: effects.grid.width,
                height: effects.grid.height,
              }}
              lines={{
                display: effects.lines.display,
                opacity: effects.lines.opacity as Opacity,
                size: effects.lines.size as SpacingToken,
                thickness: effects.lines.thickness,
                angle: effects.lines.angle,
                color: effects.lines.color,
              }}
            />
          </RevealFx>
          <Header />
          {/* Mobile: compensa el header fixed (48px) sacado del flujo.
              minHeight="48" → var(--static-space-48) = 3rem = 48px (prop nativo Once UI) */}
          <Flex s={{ hide: false }} fillWidth minHeight="48" />
          <LayoutShell footer={<Footer />}>
            <RouteGuard>{children}</RouteGuard>
          </LayoutShell>
          <FloatingChatBubble />
          {/* Tour de bienvenida: montado en el layout raíz a propósito, para que
              sobreviva a la navegación entre paradas (ver TourHost). */}
          <TourHost />
          {modal}
        </Column>
      </Providers>
    </Flex>
  );
}

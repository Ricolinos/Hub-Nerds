"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Button, Column, Fade, Heading, RevealFx, Row, SmartLink, Text } from "@once-ui-system/core";
import { HeroSpotlightReveal } from "./HeroSpotlightReveal";

// Buffer (px) debajo del borde inferior medido del header, para que el
// titular nunca quede pegado a la barra sólida/degradado del header.
const HEADER_CLEARANCE = 40;

export function HomeHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  // marginTop (negativo, px) que compensa el hueco por encima del Hero en el
  // flujo normal: el alto del header en escritorio (sticky, reserva espacio
  // en el flujo) MÁS el padding="l" superior que LayoutShell aplica a toda
  // página no full-bleed (ver src/components/LayoutShell.tsx) — ese padding
  // también deja un hueco que el breakout horizontal (width:100vw de abajo)
  // no cubre, porque ese truco solo cancela el padding izquierdo/derecho.
  // En vez de adivinar esos dos valores por separado, se mide el hueco real
  // ("natural", sin el margin ya aplicado) y se cancela con un margin-top
  // negativo exactamente de ese tamaño.
  const [marginTop, setMarginTop] = useState(0);
  // paddingTop del contenido interno: solo necesita despejar el alto del
  // header (que en móvil es fixed y sigue flotando encima pase lo que pase
  // con el margin-top de arriba), no el padding de LayoutShell.
  const [contentPaddingTop, setContentPaddingTop] = useState(104);

  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const container = containerRef.current;
    if (!header || !container) return;

    const recalc = () => {
      const rect = container.getBoundingClientRect();
      // rect.top ya refleja el marginTop actualmente aplicado (negativo):
      // el hueco "natural" (sin compensar) es rect.top menos ese margin.
      setMarginTop((prevMargin) => -Math.max(0, rect.top - prevMargin));
      setContentPaddingTop(header.getBoundingClientRect().height + HEADER_CLEARANCE);
    };

    recalc();
    // El header cambia de alto según breakpoint (sticky en escritorio, fixed
    // en móvil) y según estado (chip de usuario compacto, Clerk cargando).
    const observer = new ResizeObserver(recalc);
    observer.observe(header);
    window.addEventListener("resize", recalc);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  return (
    <Column
      ref={containerRef}
      position="relative"
      fillWidth
      overflow="hidden"
      style={{
        minHeight: "100dvh",
        marginTop: `${marginTop}px`,
        // Rompe el padding="l" que LayoutShell aplica a toda página no
        // full-bleed (ver src/components/LayoutShell.tsx): sin esto el hero
        // queda encajado con márgenes en vez de ir de borde a borde.
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
      }}
    >
      <HeroSpotlightReveal baseSrc="/images/BG_IMAGE_1.png" revealSrc="/images/BG_IMAGE_2.png">
        {/* Dentro del mismo contenedor que trackea el cursor (no un
            hermano posicionado aparte): ver comentario en
            HeroSpotlightReveal sobre por qué el mousemove necesita
            burbujear desde este contenido. */}
        <Column
          zIndex={1}
          fillWidth
          fillHeight
          vertical="between"
          paddingBottom="64"
          paddingX="40"
          gap="40"
          style={{ paddingTop: `${contentPaddingTop}px` }}
        >
          <RevealFx fillWidth horizontal="center" translateY="16">
            <Column gap="4" horizontal="center">
              <Heading variant="display-strong-xl" align="center" wrap="balance" onSolid="neutral-strong">
                El talento
              </Heading>
              <Heading variant="display-strong-xl" align="center" wrap="balance" onSolid="neutral-strong">
                se revela aquí
              </Heading>
            </Column>
          </RevealFx>

          <Row fillWidth horizontal="between" wrap gap="40" s={{ direction: "column" }}>
            <RevealFx delay={0.15} translateY="12" maxWidth={26}>
              <Text variant="body-default-m" onSolid="neutral-weak" wrap="balance">
                Cada perfil en Hub-Nerds guarda años de oficio: ilustración, motion, branding y
                diseño, listos para el proyecto correcto.
              </Text>
            </RevealFx>

            <RevealFx delay={0.25} translateY="12" maxWidth={26}>
              <Column gap="16" horizontal="start">
                <Text variant="body-default-m" onSolid="neutral-weak" wrap="balance">
                  Explora portafolios reales y encuentra al creativo — o el proyecto — que estabas
                  buscando.
                </Text>
                <Row gap="16" vertical="center" wrap>
                  <Button href="/explorar" size="m">
                    Explorar trabajos
                  </Button>
                  <SmartLink
                    href="#como-funciona"
                    unstyled
                    style={{ display: "flex", alignItems: "center" }}
                  >
                    <Text variant="label-default-m" onSolid="neutral-strong">
                      Cómo funciona
                    </Text>
                  </SmartLink>
                </Row>
              </Column>
            </RevealFx>
          </Row>
        </Column>
      </HeroSpotlightReveal>

      {/* Degradado estático hacia el fondo de página: disuelve el borde
          inferior del hero en vez de cortar de golpe contra "Qué es
          Hub-Nerds". Independiente del fundido por scroll (ese vive en
          HeroSpotlightReveal, atado a la posición del scroll); este es fijo. */}
      <Fade position="absolute" bottom="0" left="0" fillWidth to="top" base="page" height="64" />
    </Column>
  );
}

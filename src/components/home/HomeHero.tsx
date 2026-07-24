"use client";

import { Button, Column, Heading, RevealFx, Row, SmartLink, Text } from "@once-ui-system/core";
import { HeroSpotlightReveal } from "./HeroSpotlightReveal";

export function HomeHero() {
  return (
    <Column
      fillWidth
      overflow="hidden"
      style={{
        minHeight: "100dvh",
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
          paddingTop="104"
          paddingBottom="64"
          paddingX="40"
          gap="40"
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
    </Column>
  );
}

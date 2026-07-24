"use client";

import { Button, Column, Heading, Icon, LetterFx, RevealFx, Row, SmartLink, Text } from "@once-ui-system/core";
import { home } from "@/resources";

// El video de fondo tiene tramos claros (destellos) donde brightness/saturate
// del filtro global no basta para leer el texto blanco; una sombra suave
// (no un token de color) resuelve el contraste sin oscurecer el video entero.
const TEXT_SHADOW = "0 2px 16px rgba(0, 0, 0, 0.55), 0 1px 4px rgba(0, 0, 0, 0.5)";

export function HomeHero() {
  return (
    <Row
      fillWidth
      horizontal="between"
      wrap
      gap="40"
      paddingTop="80"
      paddingBottom="80"
      paddingX="40"
      style={{ minHeight: "80vh" }}
      s={{ direction: "column" }}
    >
      <RevealFx translateY="12" maxWidth={30}>
        <Column gap="16" horizontal="start" style={{ textShadow: TEXT_SHADOW }}>
          <Row gap="8" vertical="center">
            <Icon name="sparkle" onSolid="neutral-strong" size="s" />
            <Text variant="label-default-s" onSolid="neutral-strong">
              Hub-Nerds
            </Text>
          </Row>
          <Heading variant="display-strong-l" align="start" wrap="balance" onSolid="neutral-strong">
            Donde el talento creativo{" "}
            <LetterFx trigger="instant" speed="medium">
              se encuentra con quien lo necesita
            </LetterFx>
          </Heading>
        </Column>
      </RevealFx>

      <RevealFx delay={0.15} translateY="12" maxWidth={22}>
        <Column gap="20" horizontal="start" paddingTop="8" style={{ textShadow: TEXT_SHADOW }}>
          <Text variant="body-default-m" onSolid="neutral-weak" wrap="balance">
            {home.description}
          </Text>
          <Row gap="12" wrap>
            <Button href="/explorar" size="m">
              Explorar trabajos
            </Button>
            <SmartLink href="/servicios" unstyled style={{ display: "flex", alignItems: "center" }}>
              <Text variant="label-default-m" onSolid="neutral-strong">
                Cómo funciona
              </Text>
            </SmartLink>
          </Row>
        </Column>
      </RevealFx>
    </Row>
  );
}

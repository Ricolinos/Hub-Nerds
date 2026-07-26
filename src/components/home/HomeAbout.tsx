"use client";

import { Button, Column, Heading, Icon, Line, RevealFx, Row, Text } from "@once-ui-system/core";

export function HomeAbout() {
  return (
    <Column
      fillWidth
      background="surface"
      border="neutral-alpha-weak"
      radius="xl"
      paddingY="64"
      paddingX="24"
      gap="40"
      marginTop="32"
      marginBottom="32"
    >
      <RevealFx translateY="12" fillWidth horizontal="center">
        <Column maxWidth={36} horizontal="center" align="center" gap="24">
          <Text variant="body-default-l" onBackground="neutral-weak" align="center" wrap="balance">
            Creemos que el trabajo creativo se defiende solo. Por eso construimos un lugar donde
            el portafolio habla por ti, las convocatorias pagan por participar, y la colaboración
            no se pierde en hilos de WhatsApp.
          </Text>
          {/* El hero (arriba) ya es el CTA principal con estos mismos dos
              botones — repetirlos aquí era redundante. En su lugar, un
              único enlace secundario hacia el FAQ de HomeFeatures. */}
          <Button href="#home-faq" variant="tertiary" rounded prefixIcon="chat">
            Preguntas frecuentes
          </Button>
        </Column>
      </RevealFx>

      <Line fillWidth />

      <Row fillWidth s={{ direction: "column" }} gap="24" vertical="center">
        <Row gap="12" vertical="center" style={{ flex: "0 0 auto" }}>
          <Icon name="sparkles" size="l" onBackground="brand-medium" />
          <Column gap="0">
            <Text
              variant="label-default-s"
              onBackground="neutral-weak"
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              Talento
            </Text>
            <Text
              variant="label-default-s"
              onBackground="neutral-weak"
              style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              Amplificado
            </Text>
          </Column>
        </Row>
        <Heading variant="display-strong-xs" wrap="balance">
          Hacemos que el trabajo creativo se encuentre con quien lo necesita. Construimos las
          herramientas para que portafolio, cotización y colaboración vivan en un solo lugar —
          sin spec-work, sin fricción.
        </Heading>
      </Row>
    </Column>
  );
}

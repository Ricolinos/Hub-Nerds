"use client";

import { Background, Column, Heading, LetterFx, RevealFx, Text } from "@once-ui-system/core";

export function HomeHero() {
  return (
    <Column
      fillWidth
      overflow="hidden"
      radius="xl"
      border="neutral-alpha-weak"
      background="surface"
      horizontal="center"
      align="center"
      paddingY="64"
      paddingX="24"
      gap="16"
    >
      <Background
        top="0"
        position="absolute"
        mask={{ x: 50, y: 0, radius: 75, cursor: false }}
        gradient={{
          display: true,
          opacity: 90,
          x: 50,
          y: 0,
          width: 100,
          height: 60,
          tilt: 0,
          colorStart: "accent-background-strong",
          colorEnd: "static-transparent",
        }}
        dots={{
          display: true,
          opacity: 30,
          size: "4",
          color: "brand-background-strong",
        }}
      />
      <RevealFx translateY="12" fillWidth horizontal="center">
        <Column maxWidth={36} horizontal="center" align="center" gap="16">
          <Heading variant="display-strong-l" align="center" wrap="balance" style={{ maxWidth: "40rem" }}>
            Bienvenido a{" "}
            <LetterFx trigger="instant" speed="medium">
              Hub-Nerds
            </LetterFx>
          </Heading>
          <Text
            variant="body-default-l"
            onBackground="neutral-weak"
            align="center"
            wrap="balance"
            style={{ maxWidth: "34rem" }}
          >
            La plataforma pensada para conectar el trabajo creativo con los proyectos que lo
            necesitan, y así multiplicar su alcance.
          </Text>
        </Column>
      </RevealFx>
    </Column>
  );
}

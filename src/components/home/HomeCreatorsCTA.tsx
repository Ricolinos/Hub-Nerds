"use client";

import { useState } from "react";
import { Column, Heading, HoloFx, RevealFx, Text } from "@once-ui-system/core";

export function HomeCreatorsCTA() {
  const [expanded, setExpanded] = useState(false);

  return (
    <HoloFx fillWidth radius="l" marginTop="32" marginBottom="32">
      <Column
        fillWidth
        background="page"
        border="neutral-alpha-weak"
        radius="l"
        padding="32"
        gap="12"
        horizontal="center"
        align="center"
      >
        <Heading variant="heading-strong-l" align="center" wrap="balance" style={{ maxWidth: "36rem" }}>
          Únete a nuestro equipo de creativos y colabora con{" "}
          <Text as="span" size="xl" weight="strong" onBackground="brand-strong">
            NUESTRA
          </Text>{" "}
          plataforma
        </Heading>
        <Text
          variant="body-default-m"
          onBackground="neutral-weak"
          align="center"
          wrap="balance"
          style={{ maxWidth: "32rem" }}
        >
          ¡Sí! ¡También es tuya!{" "}
          {!expanded && (
            <Text
              as="span"
              onBackground="brand-strong"
              weight="strong"
              style={{ cursor: "pointer" }}
              onClick={() => setExpanded(true)}
            >
              …leer más
            </Text>
          )}
        </Text>
        {expanded && (
          <RevealFx translateY="8" fillWidth horizontal="center">
            <Text
              variant="body-default-m"
              onBackground="neutral-weak"
              align="center"
              wrap="balance"
              style={{ maxWidth: "32rem" }}
            >
              Hub-Nerds es un espacio pensado solo para diseñadores: sube tu trabajo, gana
              visibilidad frente a marcas y estudios que buscan talento, y ayuda a construir la
              plataforma con cada pieza que compartes. No es un catálogo cerrado — crece contigo y
              con cada creativo que se une.
            </Text>
          </RevealFx>
        )}
      </Column>
    </HoloFx>
  );
}

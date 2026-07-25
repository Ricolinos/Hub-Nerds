"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Column, Heading, Icon, RevealFx, Row, Text, useInViewport } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: "gallery",
    title: "Un portafolio que trabaja por ti",
    description:
      "Tarjetas Designerd con efecto holográfico y descubrimiento en /explorar — tu trabajo se ve, sin perseguir clientes uno por uno.",
  },
  {
    icon: "sparkles",
    title: "Convocatorias sin spec-work",
    description:
      "El Brief-hub paga a la Terna de finalistas antes de pedir una propuesta nueva: nunca trabajas gratis para competir por un proyecto.",
  },
  {
    icon: "chat",
    title: "Todo en un solo lugar",
    description:
      "Mensajería, tareas, cotización y activos compartidos viven dentro del mismo proyecto — sin perder el hilo en WhatsApp o correo.",
  },
];

function FeatureCard({
  feature,
  index,
  onActive,
}: {
  feature: Feature;
  index: number;
  onActive: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inViewport = useInViewport(ref, { threshold: 0.5 });

  useEffect(() => {
    if (inViewport) onActive(index);
  }, [inViewport, index, onActive]);

  return (
    <RevealFx trigger={inViewport} translateY="16" fillWidth>
      <Column
        ref={ref}
        id={`home-feature-${index}`}
        fillWidth
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="32"
        gap="16"
      >
        <Row center width={10} height={10} radius="m" background="brand-alpha-weak" border="brand-alpha-medium">
          <Icon name={feature.icon} size="s" onBackground="brand-medium" />
        </Row>
        <Heading variant="heading-strong-m">{feature.title}</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          {feature.description}
        </Text>
      </Column>
    </RevealFx>
  );
}

export function HomeFeatures() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <Row fillWidth gap="40" marginTop="32" marginBottom="32" s={{ direction: "column" }}>
      <Column
        maxWidth={22}
        gap="24"
        paddingY="8"
        style={{ position: "sticky", top: "2rem", alignSelf: "flex-start" }}
      >
        <Heading variant="display-strong-xs" wrap="balance">
          Software que crece con el trabajo creativo, no en su contra
        </Heading>
        <Column gap="8">
          {FEATURES.map((feature, index) => (
            <Button
              key={feature.title}
              variant={index === activeIndex ? "primary" : "tertiary"}
              size="s"
              fillWidth
              horizontal="start"
              onClick={() =>
                document
                  .getElementById(`home-feature-${index}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            >
              {feature.title}
            </Button>
          ))}
        </Column>
      </Column>
      <Column fillWidth gap="24">
        {FEATURES.map((feature, index) => (
          <FeatureCard key={feature.title} feature={feature} index={index} onActive={setActiveIndex} />
        ))}
      </Column>
    </Row>
  );
}

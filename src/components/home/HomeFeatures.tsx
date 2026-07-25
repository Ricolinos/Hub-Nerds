"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccordionGroup,
  Button,
  Column,
  Heading,
  HoloFx,
  Icon,
  RevealFx,
  Row,
  SegmentedControl,
  Text,
  TiltFx,
  useInViewport,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

const AUDIENCES = ["Freelancers", "Clientes"] as const;
type Audience = (typeof AUDIENCES)[number];

const FREELANCER_FEATURES: Feature[] = [
  {
    icon: "gallery",
    title: "Publica tu portafolio",
    description:
      "Tarjetas de Freelancer con efecto holográfico y descubrimiento en /explorar — tu trabajo se ve, sin perseguir clientes uno por uno.",
  },
  {
    icon: "sparkles",
    title: "Postúlate sin spec-work",
    description:
      "El Brief-hub paga a la Terna de finalistas antes de pedir una propuesta nueva: nunca trabajas gratis para competir por un proyecto.",
  },
  {
    icon: "chat",
    title: "Colabora y cobra",
    description:
      "Mensajería, tareas y cotización viven dentro del mismo proyecto — sin perder el hilo en WhatsApp o correo.",
  },
];

const CLIENT_FEATURES: Feature[] = [
  {
    icon: "search",
    title: "Descubre talento real",
    description:
      "Explora portafolios de diseñadores, animadores e ilustradores por categoría, sin intermediarios.",
  },
  {
    icon: "sparkles",
    title: "Publica una convocatoria",
    description:
      "El Brief-hub arma una Terna pagada de finalistas antes de que nadie te entregue una propuesta — spec-work cero.",
  },
  {
    icon: "briefcase",
    title: "Gestiona todo en un lugar",
    description:
      "Cotización, tareas, activos y mensajería de tu proyecto conjunto, sin salir de la plataforma.",
  },
];

const FAQ_ITEMS = [
  {
    title: "¿Qué es Hub-Nerds?",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Una plataforma que conecta talento creativo con clientes: portafolio, cotizador,
        convocatorias, colaboración y mensajería en un solo lugar.
      </Text>
    ),
  },
  {
    title: "¿Cómo funcionan las Convocatorias (Brief-hub)?",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        En dos fases: te postulas con portafolio ya existente + un pitch, sin propuesta nueva. Si
        entras a la Terna de finalistas, te pagan un fee garantizado por producir la propuesta
        real — ganes o no el proyecto.
      </Text>
    ),
  },
  {
    title: "¿Necesito ser diseñador para usar la plataforma?",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        No. Hay dos roles: Freelancer (sube portafolio, se postula, colabora) y Client (descubre
        talento, cotiza, publica convocatorias).
      </Text>
    ),
  },
  {
    title: "¿Dónde hablo con la otra parte de un proyecto?",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Todo vive en /mensajes: mensajería directa, canales por proyecto, y las tareas se pueden
        crear directo desde un mensaje.
      </Text>
    ),
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
      {/* `id` vive en TiltFx (fuera de HoloFx): HoloFx renderiza `children`
          3 veces internamente (capa base + overlays de burn/shine), así que
          un id puesto en el Column de adentro terminaba triplicado en el DOM
          (HTML inválido, confirmado con document.querySelectorAll). */}
      <TiltFx id={`home-feature-${index}`} fillWidth radius="l" intensity={2}>
        <HoloFx fillWidth radius="l">
          <Column
            ref={ref}
            fillWidth
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="32"
            gap="16"
          >
            <Row fillWidth horizontal="between" vertical="center">
              <Row center width={10} height={10} radius="m" background="brand-alpha-weak" border="brand-alpha-medium">
                <Icon name={feature.icon} size="s" onBackground="brand-medium" />
              </Row>
              <Row
                center
                width={8}
                height={8}
                radius="full"
                background="neutral-alpha-weak"
                border="neutral-alpha-medium"
              >
                <Text variant="label-strong-s" onBackground="neutral-strong">
                  {index + 1}
                </Text>
              </Row>
            </Row>
            <Heading variant="heading-strong-m">{feature.title}</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              {feature.description}
            </Text>
          </Column>
        </HoloFx>
      </TiltFx>
    </RevealFx>
  );
}

export function HomeFeatures() {
  const [audience, setAudience] = useState<Audience>("Freelancers");
  const [activeIndex, setActiveIndex] = useState(0);
  const features = audience === "Freelancers" ? FREELANCER_FEATURES : CLIENT_FEATURES;

  // Cambiar de audiencia reemplaza el set de tarjetas: reinicia el resaltado
  // del nav lateral para que no apunte a un índice de la lista anterior.
  useEffect(() => {
    setActiveIndex(0);
  }, [audience]);

  return (
    <Column fillWidth gap="40" marginTop="32" marginBottom="32">
      <Row fillWidth gap="40" s={{ direction: "column" }}>
        <Column
          maxWidth={22}
          gap="24"
          paddingY="8"
          style={{ position: "sticky", top: "2rem", alignSelf: "flex-start" }}
        >
          <Heading variant="display-strong-xs" wrap="balance">
            Software que crece con el trabajo creativo, no en su contra
          </Heading>
          <SegmentedControl
            selected={audience}
            onToggle={(value) => setAudience(value as Audience)}
            buttons={AUDIENCES.map((label) => ({ value: label, label }))}
          />
          <Column gap="8">
            {features.map((feature, index) => (
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
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} onActive={setActiveIndex} />
          ))}
        </Column>
      </Row>
      <Column id="home-faq" fillWidth maxWidth={40} gap="16">
        <Heading variant="display-strong-xs" wrap="balance">
          Preguntas frecuentes
        </Heading>
        <AccordionGroup items={FAQ_ITEMS} />
      </Column>
    </Column>
  );
}

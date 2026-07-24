import { Column, Grid, Heading, Icon, Row, Text } from "@once-ui-system/core";
import type { IconName } from "@once-ui-system/core";
import { home } from "@/resources";

const FEATURES: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "gallery",
    title: "Portafolios reales",
    description: "Perfiles con trabajo verificado, no plantillas genéricas.",
  },
  {
    icon: "briefcase",
    title: "Convocatorias pagadas",
    description: "Participa en ternas remuneradas, no trabajo especulativo gratis.",
  },
  {
    icon: "chat",
    title: "Colaboración directa",
    description: "Mensajería y seguimiento de proyecto en un solo lugar.",
  },
];

export function HomeValueProps() {
  return (
    <Column fillWidth gap="40" paddingY="64">
      <Column gap="12" maxWidth={32}>
        <Text variant="label-default-s" onBackground="brand-medium">
          Qué es Hub-Nerds
        </Text>
        <Heading variant="display-strong-xs" wrap="balance">
          La plataforma donde el talento creativo se vuelve visible
        </Heading>
        <Text variant="body-default-m" onBackground="neutral-weak" wrap="balance">
          {home.description}
        </Text>
      </Column>

      <Grid columns="3" gap="24" m={{ columns: 2 }} s={{ columns: 1 }}>
        {FEATURES.map((feature) => (
          <Column
            key={feature.title}
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="24"
            gap="16"
          >
            <Row
              center
              width={10}
              height={10}
              radius="m"
              background="brand-alpha-weak"
              border="brand-alpha-medium"
            >
              <Icon name={feature.icon} size="s" onBackground="brand-medium" />
            </Row>
            <Heading as="h3" variant="heading-strong-s">
              {feature.title}
            </Heading>
            <Text variant="body-default-s" onBackground="neutral-weak">
              {feature.description}
            </Text>
          </Column>
        ))}
      </Grid>
    </Column>
  );
}

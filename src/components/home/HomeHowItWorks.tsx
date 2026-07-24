import { Column, Grid, Heading, Icon, Row, Text } from "@once-ui-system/core";
import type { IconName } from "@once-ui-system/core";

const STEPS: { icon: IconName; title: string }[] = [
  { icon: "edit", title: "Crea tu perfil y sube tu portafolio." },
  { icon: "search", title: "Explora proyectos o publica una convocatoria." },
  { icon: "userGroup", title: "Conecta y colabora en el proyecto." },
  { icon: "chat", title: "Coordina todo desde el Centro de Mensajes." },
];

export function HomeHowItWorks() {
  return (
    <Column id="como-funciona" fillWidth gap="40" paddingY="64">
      <Column gap="12" maxWidth={32}>
        <Text variant="label-default-s" onBackground="brand-medium">
          Cómo funciona
        </Text>
        <Heading variant="display-strong-xs" wrap="balance">
          De tu perfil al proyecto, en cuatro pasos
        </Heading>
      </Column>

      <Grid columns="4" gap="24" m={{ columns: 2 }} s={{ columns: 1 }}>
        {STEPS.map((step, index) => (
          <Column key={step.title} gap="16">
            <Row gap="12" vertical="center">
              <Row
                center
                width={10}
                height={10}
                radius="m"
                background="brand-alpha-weak"
                border="brand-alpha-medium"
              >
                <Icon name={step.icon} size="s" onBackground="brand-medium" />
              </Row>
              <Text variant="label-default-s" onBackground="neutral-weak">
                {String(index + 1).padStart(2, "0")}
              </Text>
            </Row>
            <Text variant="body-default-m" onBackground="neutral-strong" wrap="balance">
              {step.title}
            </Text>
          </Column>
        ))}
      </Grid>
    </Column>
  );
}

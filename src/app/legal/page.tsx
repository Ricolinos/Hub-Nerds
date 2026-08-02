import { Card, Column, Heading, Text } from "@once-ui-system/core";
import { LEGAL_DOCS, LEGAL_UPDATED_LABEL } from "@/resources";

export const metadata = {
  title: "Legal",
  description: "Términos y Condiciones y Política de Privacidad de Hub-Nerds.",
};

export default function LegalIndexPage() {
  return (
    <Column fillWidth gap="32">
      <Column gap="8">
        <Heading variant="display-strong-s">Documentos legales</Heading>
        <Text onBackground="neutral-weak" variant="body-default-m">
          Términos y Condiciones y Política de Privacidad de Hub-Nerds.
        </Text>
      </Column>

      <Column gap="16" fillWidth>
        {Object.values(LEGAL_DOCS).map((doc) => (
          <Card
            key={doc.href}
            href={doc.href}
            fillWidth
            direction="column"
            gap="8"
            padding="24"
            radius="l"
            border="neutral-alpha-weak"
            background="surface"
          >
            <Text variant="heading-strong-s" onBackground="neutral-strong">
              {doc.title}
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              {doc.description}
            </Text>
            <Text variant="label-default-s" onBackground="neutral-weak" marginTop="8">
              Última actualización: {LEGAL_UPDATED_LABEL}
            </Text>
          </Card>
        ))}
      </Column>
    </Column>
  );
}

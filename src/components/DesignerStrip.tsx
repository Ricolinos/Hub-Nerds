import { Avatar, Column, Row, Scroller, Tag, Text } from "@once-ui-system/core";

// Datos ilustrativos: aún no existe un directorio real de diseñadores registrados en la plataforma.
const MOCK_DESIGNERS = [
  "AR", "MC", "JL", "DP", "SG", "KT", "NV", "FB", "LH", "RQ",
];

export function DesignerStrip() {
  return (
    <Column fillWidth gap="16">
      <Row gap="8" vertical="center">
        <Text variant="label-strong-s" onBackground="neutral-weak">
          Diseñadores en la plataforma
        </Text>
        <Tag size="s" label="Próximamente" scheme="brand" />
      </Row>
      <Scroller fillWidth gap="16">
        {MOCK_DESIGNERS.map((initials) => (
          <Avatar key={initials} value={initials} size="l" />
        ))}
      </Scroller>
    </Column>
  );
}

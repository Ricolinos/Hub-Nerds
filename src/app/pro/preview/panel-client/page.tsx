import { Button, Column, Icon, Row, Text } from "@once-ui-system/core";
import type { Metadata } from "next";
import { ClientProPanelPreview } from "@/components/pro/ClientProPanelPreview";
import { MOCK_CLIENT_PANEL } from "@/lib/mockClientPanel";

export const metadata: Metadata = {
  title: "Vista previa · Panel Client Pro",
  description:
    "Así se vería tu panel para gestionar varios proyectos y freelancers con Client Pro — maqueta con datos de ejemplo.",
};

// Página pública (sin login) que deja ver cómo luciría el "Panel Client Pro"
// antes de conectarlo a datos reales: banner de aviso + la maqueta completa
// con contenido mock (ver src/lib/mockClientPanel.ts).
export default function ClientPanelPreviewPage() {
  return (
    <Column as="main" fillWidth horizontal="center" gap="24" paddingBottom="104" minWidth={0}>
      <Row
        fillWidth
        horizontal="center"
        vertical="center"
        gap="12"
        wrap
        paddingX="24"
        paddingY="12"
        background="brand-alpha-weak"
        borderBottom="brand-alpha-medium"
        minWidth={0}
      >
        <Row gap="8" vertical="center" wrap horizontal="center" minWidth={0}>
          <Icon name="sparkles" size="s" onBackground="brand-medium" />
          <Text
            variant="label-default-s"
            onBackground="brand-strong"
            align="center"
            style={{ overflowWrap: "break-word" }}
          >
            Vista previa · Así se vería tu panel con Client Pro
          </Text>
        </Row>
        <Button href="/pro" size="s" variant="secondary" arrowIcon>
          Conocer Client Pro
        </Button>
      </Row>

      <ClientProPanelPreview panel={MOCK_CLIENT_PANEL} />
    </Column>
  );
}

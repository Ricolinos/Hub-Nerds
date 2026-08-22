import { Button, Column, Icon, Row, Text } from "@once-ui-system/core";
import type { Metadata } from "next";
import { ClientBrandPageView } from "@/components/pro/ClientBrandPageView";
import { MOCK_BRAND_PAGE } from "@/lib/mockBrandPage";

export const metadata: Metadata = {
  title: "Vista previa · Página de empresa",
  description:
    "Así se vería la página pública de tu empresa con Client Pro — maqueta con datos de ejemplo.",
};

// Página pública (sin login) que deja ver cómo luciría la "brand page" de
// Client Pro antes de conectarla a datos reales: banner de aviso + la
// maqueta completa con contenido mock (ver src/lib/mockBrandPage.ts).
export default function BrandPagePreviewPage() {
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
            Vista previa · Así se vería tu página de empresa con Client Pro
          </Text>
        </Row>
        <Button href="/pro" size="s" variant="secondary" arrowIcon>
          Conocer Client Pro
        </Button>
      </Row>

      <ClientBrandPageView brand={MOCK_BRAND_PAGE} />
    </Column>
  );
}

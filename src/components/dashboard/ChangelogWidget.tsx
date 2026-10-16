import { Column, Heading, Line, Row, Tag, Text } from "@once-ui-system/core";
import { CHANGELOG_ENTRIES, type ChangelogTag } from "@/lib/changelog";

/* ══ Novedades de la plataforma (Fase 6b), común a ambos dashboards ══════
   Lista cronológica de src/lib/changelog.ts. Presentacional puro. ═══════ */

const TAG_VARIANTS: Record<ChangelogTag, "brand" | "success" | "info" | "warning" | "neutral"> = {
  Mensajería: "info",
  Colaboración: "brand",
  Perfil: "success",
  Cotizador: "warning",
  Tareas: "neutral",
};

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function ChangelogWidget() {
  return (
    <Column gap="16" fillWidth>
      <Heading variant="heading-strong-m">Novedades</Heading>
      <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
        {CHANGELOG_ENTRIES.map((entry, index) => (
          <Column key={entry.title} fillWidth>
            {index > 0 && <Line background="neutral-alpha-weak" />}
            <Column fillWidth gap="4" paddingX="20" paddingY="16">
              <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
                <Row gap="8" vertical="center">
                  <Tag size="s" scheme={TAG_VARIANTS[entry.tag]} label={entry.tag} />
                  <Text variant="label-strong-s" onBackground="neutral-strong">
                    {entry.title}
                  </Text>
                </Row>
                <Text variant="label-default-s" onBackground="neutral-weak">
                  {formatEntryDate(entry.date)}
                </Text>
              </Row>
              <Text
                variant="body-default-s"
                onBackground="neutral-weak"
                style={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {entry.description}
              </Text>
            </Column>
          </Column>
        ))}
      </Column>
    </Column>
  );
}

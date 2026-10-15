import { Column, Grid, Row, Skeleton } from "@once-ui-system/core";

const METRIC_KEYS = ["metric-1", "metric-2", "metric-3"];
const PROJECT_ROW_KEYS = ["row-1", "row-2", "row-3"];
const PROJECT_SECTION_KEYS = ["current", "finished"];
const LIST_ROW_KEYS = ["row-1", "row-2", "row-3"];

// Replica ClientDashboardPage: mismo Column raíz (paddingY 80, paddingX 24,
// gap 24, maxWidth l) que la page real, luego DashboardHero (card con
// gradiente), DashboardMetrics (grid de 3, s: 2), fila de 2 botones,
// dos ProjectListWidget (heading + lista bordeada con filas divididas) y,
// al fondo, el Grid 2 col de NotificationsWidget/ChangelogWidget.
export default function ClientDashboardLoading() {
  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">
      {/* DashboardHero: Column radius xl border surface paddingY 40 paddingX 32 */}
      <Column
        fillWidth
        radius="xl"
        border="neutral-alpha-weak"
        background="surface"
        paddingY="40"
        paddingX="32"
        gap="8"
      >
        <Skeleton shape="line" width="25%" size="xs" />
        <Skeleton shape="line" width="50%" size="l" />
        <Skeleton shape="line" width="75%" size="xs" />
      </Column>

      {/* DashboardMetrics: Grid columns=3 s={{columns:2}} gap 16, cada item es
          un Column surface/border/radius l/padding 20/gap 12 (icono+label+valor). */}
      <Grid columns="3" s={{ columns: 2 }} fillWidth gap="16">
        {METRIC_KEYS.map((key) => (
          <Column
            key={key}
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="20"
            gap="12"
            fillWidth
          >
            <Row gap="8" vertical="center">
              <Skeleton shape="circle" size="xs" />
              <Skeleton shape="line" width="33%" size="xs" />
            </Row>
            <Skeleton shape="line" width="25%" size="l" />
          </Column>
        ))}
      </Grid>

      {/* Row de 2 botones size m ("Crear nuevo proyecto" / "Mis recursos") */}
      <Row gap="12" wrap>
        <Column width="160" height="40">
          <Skeleton shape="block" fillWidth />
        </Column>
        <Column width="160" height="40">
          <Skeleton shape="block" fillWidth />
        </Column>
      </Row>

      {/* ProjectListWidget x2: Heading + Column bordeada con filas divididas
          (avatar s + título + tag) igual que el componente real. */}
      {PROJECT_SECTION_KEYS.map((section) => (
        <Column key={section} gap="16" fillWidth>
          <Skeleton shape="line" width="25%" size="m" />
          <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
            {PROJECT_ROW_KEYS.map((row, index) => (
              <Row
                key={`${section}-${row}`}
                fillWidth
                paddingX="20"
                paddingY="16"
                horizontal="between"
                vertical="center"
                gap="16"
                borderTop={index > 0 ? "neutral-alpha-weak" : undefined}
              >
                <Row gap="12" vertical="center">
                  <Skeleton shape="circle" size="s" />
                  <Skeleton shape="line" width="50%" size="xs" />
                </Row>
                <Skeleton shape="line" width="25%" size="xs" />
              </Row>
            ))}
          </Column>
        </Column>
      ))}

      {/* NotificationsWidget / ChangelogWidget: Grid columns=2 s={{columns:1}} gap 24 */}
      <Grid columns="2" s={{ columns: 1 }} fillWidth gap="24">
        {["notifications", "changelog"].map((widget) => (
          <Column key={widget} gap="16" fillWidth>
            <Skeleton shape="line" width="33%" size="m" />
            <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
              {LIST_ROW_KEYS.map((row, index) => (
                <Row
                  key={`${widget}-${row}`}
                  fillWidth
                  paddingX="20"
                  paddingY="12"
                  gap="12"
                  vertical="center"
                  borderTop={index > 0 ? "neutral-alpha-weak" : undefined}
                >
                  <Skeleton shape="circle" size="xs" />
                  <Column gap="4" fillWidth>
                    <Skeleton shape="line" width="75%" size="xs" />
                    <Skeleton shape="line" width="33%" size="xs" />
                  </Column>
                </Row>
              ))}
            </Column>
          </Column>
        ))}
      </Grid>
    </Column>
  );
}

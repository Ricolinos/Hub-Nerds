import { Column, Grid, Row, Skeleton } from "@once-ui-system/core";

const METRIC_KEYS = ["metric-1", "metric-2", "metric-3", "metric-4"];
const PROJECT_ROW_KEYS = ["row-1", "row-2", "row-3"];
const PROJECT_SECTION_KEYS = ["current", "finished"];
const REQUEST_ROW_KEYS = ["row-1", "row-2"];
const LIST_ROW_KEYS = ["row-1", "row-2", "row-3"];

// Replica FreelancerDashboardPage: mismo Column raíz que la page real,
// DashboardHero, DashboardMetrics (grid de 4, s: 2), 1 botón ("Agregar
// proyecto"), PendingRequestsWidget (fila avatar + 2 botones), dos
// ProjectListWidget y el Grid 2 col de NotificationsWidget/ChangelogWidget.
export default function FreelancerDashboardLoading() {
  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">
      {/* DashboardHero */}
      <Column
        fillWidth
        radius="xl"
        border="neutral-alpha-weak"
        background="surface"
        paddingY="40"
        paddingX="32"
        gap="8"
      >
        <Skeleton shape="line" width="xs" height="xs" />
        <Skeleton shape="line" width="m" height="l" />
        <Skeleton shape="line" width="l" height="xs" />
      </Column>

      {/* DashboardMetrics: Grid columns=4 s={{columns:2}} gap 16 */}
      <Grid columns="4" s={{ columns: 2 }} fillWidth gap="16">
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
              <Skeleton shape="circle" width="xs" />
              <Skeleton shape="line" width="s" height="xs" />
            </Row>
            <Skeleton shape="line" width="xs" height="l" />
          </Column>
        ))}
      </Grid>

      {/* Row de 1 botón size m ("Agregar proyecto") */}
      <Row gap="12" wrap>
        <Column width="160" height="40">
          <Skeleton shape="block" fillWidth />
        </Column>
      </Row>

      {/* PendingRequestsWidget: Heading + lista bordeada, fila avatar + 2 botones */}
      <Column gap="16" fillWidth>
        <Skeleton shape="line" width="s" height="m" />
        <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
          {REQUEST_ROW_KEYS.map((row, index) => (
            <Row
              key={row}
              fillWidth
              paddingX="20"
              paddingY="16"
              horizontal="between"
              vertical="center"
              gap="16"
              borderTop={index > 0 ? "neutral-alpha-weak" : undefined}
            >
              <Row gap="12" vertical="center">
                <Skeleton shape="circle" width="s" />
                <Skeleton shape="line" width="m" height="xs" />
              </Row>
              <Row gap="8">
                <Column width="80" height="32">
                  <Skeleton shape="block" fillWidth />
                </Column>
                <Column width="80" height="32">
                  <Skeleton shape="block" fillWidth />
                </Column>
              </Row>
            </Row>
          ))}
        </Column>
      </Column>

      {/* ProjectListWidget x2 */}
      {PROJECT_SECTION_KEYS.map((section) => (
        <Column key={section} gap="16" fillWidth>
          <Skeleton shape="line" width="xs" height="m" />
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
                  <Skeleton shape="circle" width="s" />
                  <Skeleton shape="line" width="m" height="xs" />
                </Row>
                <Skeleton shape="line" width="xs" height="xs" />
              </Row>
            ))}
          </Column>
        </Column>
      ))}

      {/* NotificationsWidget / ChangelogWidget */}
      <Grid columns="2" s={{ columns: 1 }} fillWidth gap="24">
        {["notifications", "changelog"].map((widget) => (
          <Column key={widget} gap="16" fillWidth>
            <Skeleton shape="line" width="s" height="m" />
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
                  <Skeleton shape="circle" width="xs" />
                  <Column gap="4" fillWidth>
                    <Skeleton shape="line" width="l" height="xs" />
                    <Skeleton shape="line" width="s" height="xs" />
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

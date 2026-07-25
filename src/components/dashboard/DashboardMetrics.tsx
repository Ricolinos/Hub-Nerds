import { Column, Grid, Heading, Icon, Row, Text } from "@once-ui-system/core";
import type { GridSize } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

export interface DashboardMetric {
  label: string;
  value: number;
  icon: IconName;
}

interface DashboardMetricsProps {
  metrics: DashboardMetric[];
}

// Resumen de métricas en tarjetas, reutilizado en /dashboard/client y
// /dashboard/freelancer.
export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  return (
    <Grid columns={String(metrics.length) as GridSize} s={{ columns: 2 }} fillWidth gap="16">
      {metrics.map(({ label, value, icon }) => (
        <Column
          key={label}
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="20"
          gap="12"
          fillWidth
        >
          <Row gap="8" vertical="center">
            <Icon name={icon} size="s" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {label}
            </Text>
          </Row>
          <Heading variant="display-strong-m">{value}</Heading>
        </Column>
      ))}
    </Grid>
  );
}

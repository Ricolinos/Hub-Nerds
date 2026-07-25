import { Column, Grid, Line, Row, Skeleton } from "@once-ui-system/core";

// Skeletons diferenciados por rol para src/app/[username]/page.tsx: cada uno
// calca los contenedores/paddings/grids reales de su vista (ver ProfileView.tsx
// y ClientProfileView.tsx) para que el fallback de Suspense no "salte" al
// llegar el contenido real. No son pixel-perfect (algunos detalles como el
// grid-column: span de ProfileView.module.scss se aproximan con Row/Column
// responsivos en vez de replicar esa media query), pero sí la estructura.

const PIECE_KEYS = ["piece-1", "piece-2", "piece-3", "piece-4", "piece-5", "piece-6"];
const METRIC_KEYS = ["metric-1", "metric-2", "metric-3"];

// Calca ProfileView.tsx (estilo Behance): tarjeta Designerd 3:4 + avatar
// circular superpuesto, nombre/username/badges, panel de métricas a la
// izquierda; a la derecha la barra de filtro/orden y el grid de piezas
// (columns=3 m=2 s=1, bloques 4:3 con título y meta debajo).
export function FreelancerProfileSkeleton() {
  return (
    <Column fillWidth maxWidth="l" horizontal="center" paddingBottom="80">
      <Column fillWidth paddingX="32" paddingTop="24" gap="24">
        <Row fillWidth gap="20" s={{ direction: "column" }}>
          {/* Columna izquierda: identidad, contacto y métricas */}
          <Column gap="24" fillWidth minWidth={0} style={{ maxWidth: 320 }}>
            <Column gap="0" fillWidth>
              <Column fillWidth radius="l" style={{ aspectRatio: "3 / 4" }}>
                <Skeleton shape="block" fillWidth fillHeight radius="l" />
              </Column>
              <Row fillWidth horizontal="center" style={{ marginTop: "-48px" }}>
                <Skeleton shape="circle" width="xl" />
              </Row>
            </Column>

            <Column gap="8" fillWidth horizontal="center">
              <Skeleton shape="line" width="m" height="m" />
              <Row gap="8" horizontal="center" vertical="center">
                <Skeleton shape="line" width="xs" height="s" />
                <Skeleton shape="line" width="s" height="xs" />
              </Row>
            </Column>

            <Skeleton shape="block" fillWidth height="l" radius="m" />

            <Column
              background="neutral-alpha-weak"
              border="neutral-alpha-weak"
              padding="16"
              radius="m"
              gap="12"
              fillWidth
            >
              {METRIC_KEYS.map((key) => (
                <Row key={key} fillWidth horizontal="between">
                  <Skeleton shape="line" width="s" height="xs" />
                  <Skeleton shape="line" width="xs" height="xs" />
                </Row>
              ))}
            </Column>
          </Column>

          {/* Columna derecha: showcase de piezas reales */}
          <Column gap="24" fillWidth minWidth={0}>
            <Row fillWidth horizontal="between" vertical="center" gap="12">
              <Skeleton shape="line" width="m" height="s" />
              <Skeleton shape="line" width="s" height="s" />
            </Row>

            <Grid columns={3} m={{ columns: 2 }} s={{ columns: 1 }} gap="20" fillWidth>
              {PIECE_KEYS.map((key) => (
                <Column key={key} fillWidth gap="8">
                  <Column fillWidth radius="m" style={{ aspectRatio: "4 / 3" }}>
                    <Skeleton shape="block" fillWidth fillHeight radius="m" />
                  </Column>
                  <Skeleton shape="line" width="m" height="xs" />
                  <Skeleton shape="line" width="s" height="xs" />
                </Column>
              ))}
            </Grid>
          </Column>
        </Row>
      </Column>
    </Column>
  );
}

const STAT_KEYS = ["stat-1", "stat-2", "stat-3"];
const PROJECT_ROW_KEYS = ["project-1", "project-2", "project-3"];
const RESOURCE_ROW_KEYS = ["resource-1", "resource-2"];
const DESIGNER_ROW_KEYS = ["designer-1", "designer-2"];

// Calca ClientProfileView.tsx (estilo Monday): card de cabecera (avatar +
// nombre), fila de tags de resumen, tarjeta de acción "Nuevo proyecto",
// tablero de "Mis proyectos"/"Mis recursos" como filas de tabla y los
// paneles laterales (diseñadores + recursos compartidos).
export function ClientProfileSkeleton() {
  return (
    <Column fillWidth maxWidth="l" horizontal="center" paddingBottom="80">
      <Column fillWidth paddingX="32" paddingTop="40" gap="24">
        {/* Cabecera del panel */}
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="24"
          gap="16"
        >
          <Row gap="20" vertical="center" wrap>
            <Skeleton shape="circle" width="l" />
            <Column gap="8" fillWidth minWidth={0}>
              <Skeleton shape="line" width="m" height="m" />
              <Skeleton shape="line" width="s" height="xs" />
            </Column>
          </Row>
        </Column>

        {/* Resumen de actividad: tags a la derecha */}
        <Row fillWidth horizontal="end" vertical="center" gap="8" wrap>
          {STAT_KEYS.map((key) => (
            <Skeleton key={key} shape="line" width="xs" height="s" />
          ))}
        </Row>

        {/* Tarjeta de acción "Nuevo proyecto" */}
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="20"
          gap="12"
        >
          <Row fillWidth horizontal="between" vertical="center">
            <Skeleton shape="block" width="s" height="s" radius="s" />
            <Skeleton shape="block" width="xs" height="xs" radius="s" />
          </Row>
          <Skeleton shape="line" width="m" height="s" />
          <Skeleton shape="line" width="l" height="xs" />
        </Column>

        {/* Tablero de proyectos + paneles laterales */}
        <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
          <Column gap="40" fillWidth minWidth={0}>
            {/* Mis proyectos */}
            <Column gap="16" fillWidth>
              <Skeleton shape="line" width="m" height="s" />
              <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
                {PROJECT_ROW_KEYS.map((key, index) => (
                  <Column key={key} fillWidth>
                    {index > 0 && <Line background="neutral-alpha-weak" />}
                    <Row
                      fillWidth
                      paddingX="20"
                      paddingY="12"
                      horizontal="between"
                      vertical="center"
                      gap="16"
                    >
                      <Row gap="12" vertical="center" minWidth={0}>
                        <Skeleton shape="circle" width="xs" />
                        <Skeleton shape="line" width="m" height="xs" />
                      </Row>
                      <Skeleton shape="line" width="xs" height="s" />
                    </Row>
                  </Column>
                ))}
              </Column>
            </Column>

            {/* Mis recursos */}
            <Column gap="16" fillWidth>
              <Row fillWidth horizontal="between" vertical="center">
                <Skeleton shape="line" width="m" height="s" />
                <Skeleton shape="line" width="s" height="s" />
              </Row>
              <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
                {RESOURCE_ROW_KEYS.map((key, index) => (
                  <Column key={key} fillWidth>
                    {index > 0 && <Line background="neutral-alpha-weak" />}
                    <Row
                      fillWidth
                      paddingX="20"
                      paddingY="12"
                      horizontal="between"
                      vertical="center"
                      gap="16"
                    >
                      <Skeleton shape="line" width="m" height="xs" />
                      <Skeleton shape="line" width="xs" height="xs" />
                    </Row>
                  </Column>
                ))}
              </Column>
            </Column>
          </Column>

          {/* Paneles laterales */}
          <Column gap="16" fillWidth style={{ maxWidth: 320 }}>
            <Column
              background="neutral-alpha-weak"
              border="neutral-alpha-weak"
              padding="16"
              radius="m"
              gap="12"
            >
              <Skeleton shape="line" width="m" height="s" />
              {DESIGNER_ROW_KEYS.map((key) => (
                <Row key={key} fillWidth horizontal="between" vertical="center" gap="8">
                  <Row gap="12" vertical="center" minWidth={0}>
                    <Skeleton shape="circle" width="xs" />
                    <Skeleton shape="line" width="s" height="xs" />
                  </Row>
                </Row>
              ))}
            </Column>

            <Column
              background="neutral-alpha-weak"
              border="neutral-alpha-weak"
              padding="16"
              radius="m"
              gap="12"
            >
              <Skeleton shape="line" width="m" height="s" />
              <Skeleton shape="line" width="l" height="xs" />
            </Column>
          </Column>
        </Row>
      </Column>
    </Column>
  );
}

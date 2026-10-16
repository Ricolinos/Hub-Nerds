import { Column, Line, Row, Skeleton } from "@once-ui-system/core";

const COLLABORATOR_KEYS = ["collaborator-1", "collaborator-2"];
const TASK_KEYS = ["task-1", "task-2", "task-3"];
const ASSET_KEYS = ["asset-1", "asset-2"];

// Replica CollabProjectView: mismo Column raíz (maxWidth l, horizontal
// center, paddingX 32, paddingTop 40, paddingBottom 80, gap 24). Cabecera en
// card (logo xl + título + tag + descripción + fila de colaboradores),
// bloque "Tareas del proyecto" (lista bordeada dividida) y "Activos del
// proyecto" (cards individuales), que son las secciones above-the-fold.
export default function CollabProjectLoading() {
  return (
    <Column
      fillWidth
      maxWidth="l"
      horizontal="center"
      paddingX="32"
      paddingTop="40"
      paddingBottom="80"
      gap="24"
    >
      {/* Cabecera */}
      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="24"
        gap="16"
        fillWidth
      >
        <Row fillWidth gap="16" horizontal="between" vertical="start" wrap>
          <Row gap="16" vertical="start">
            <Skeleton shape="circle" size="xl" />
            <Column gap="12">
              <Row gap="8" vertical="center">
                <Skeleton shape="line" width="50%" size="l" />
                <Skeleton shape="line" width="25%" size="xs" />
              </Row>
              <Skeleton shape="line" width="75%" size="xs" />
              <Row gap="12" vertical="center">
                <Skeleton shape="circle" size="s" />
                <Skeleton shape="line" width="33%" size="xs" />
              </Row>
            </Column>
          </Row>
          <Skeleton shape="circle" size="s" />
        </Row>

        <Line background="neutral-alpha-weak" />

        <Column gap="8" fillWidth>
          <Skeleton shape="line" width="25%" size="xs" />
          <Row gap="12" vertical="center" wrap>
            {COLLABORATOR_KEYS.map((key) => (
              <Row
                key={key}
                gap="8"
                vertical="center"
                paddingX="12"
                paddingY="8"
                radius="full"
                background="neutral-alpha-weak"
              >
                <Skeleton shape="circle" size="xs" />
                <Skeleton shape="line" width="25%" size="xs" />
              </Row>
            ))}
          </Row>
        </Column>
      </Column>

      {/* Tareas del proyecto */}
      <Column gap="16" fillWidth>
        <Skeleton shape="line" width="33%" size="m" />
        <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
          {TASK_KEYS.map((key, index) => (
            <Column key={key} fillWidth>
              {index > 0 && <Line background="neutral-alpha-weak" />}
              <Column fillWidth gap="8" paddingX="16" paddingY="12">
                <Row fillWidth horizontal="between" vertical="center" gap="12">
                  <Skeleton shape="line" width="75%" size="xs" />
                  <Skeleton shape="line" width="25%" size="xs" />
                </Row>
                <Skeleton shape="line" width="50%" size="xs" />
              </Column>
            </Column>
          ))}
        </Column>
      </Column>

      {/* Activos del proyecto */}
      <Column gap="16" fillWidth>
        <Row fillWidth horizontal="between" vertical="center">
          <Skeleton shape="line" width="33%" size="m" />
          <Skeleton shape="line" width="25%" size="xs" />
        </Row>
        <Column gap="12" fillWidth>
          {ASSET_KEYS.map((key) => (
            <Column
              key={key}
              fillWidth
              border="neutral-alpha-medium"
              radius="l"
              padding="16"
              gap="12"
            >
              <Row fillWidth horizontal="between" vertical="center">
                <Skeleton shape="line" width="50%" size="s" />
                <Skeleton shape="line" width="25%" size="xs" />
              </Row>
              <Column height="40" fillWidth>
                <Skeleton shape="block" fillWidth />
              </Column>
            </Column>
          ))}
        </Column>
      </Column>
    </Column>
  );
}

import { Column, Line, Row, Skeleton } from "@once-ui-system/core";

const USER_AVATAR_KEYS = ["rail-user-1", "rail-user-2"];
const PROJECT_AVATAR_KEYS = ["rail-project-1", "rail-project-2"];
const THREAD_KEYS = ["thread-1", "thread-2", "thread-3", "thread-4", "thread-5", "thread-6"];

// Replica los 3 paneles reales de MessengerView: mismo Row raíz (gap 8,
// padding 8). ProjectRail (64px) con sus DOS secciones — icono de sección +
// avatares + botón "+" en Usuarios, separador, icono de sección + avatares
// en Proyectos —, ConversationList (320px fijo, header contextual con
// avatar+nombre + buscador + SegmentedControl + filas) y ConversationPanel
// (flex restante). DetailsPanel se omite: no está montado por defecto (solo
// aparece si el usuario abre "info").
export default function MensajesLoading() {
  return (
    <Row fillWidth fillHeight gap="8" padding="8" style={{ minWidth: 0 }}>
      {/* ProjectRail */}
      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        gap="8"
        paddingY="12"
        horizontal="center"
        style={{ width: 64, minWidth: 0, flexShrink: 0 }}
      >
        <Skeleton shape="circle" size="xs" />
        {USER_AVATAR_KEYS.map((key) => (
          <Skeleton key={key} shape="circle" size="s" />
        ))}
        <Skeleton shape="circle" size="xs" />

        <Line background="neutral-alpha-weak" style={{ width: 32 }} />

        <Skeleton shape="circle" size="xs" />
        {PROJECT_AVATAR_KEYS.map((key) => (
          <Skeleton key={key} shape="circle" size="s" />
        ))}
      </Column>

      {/* ConversationList */}
      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        gap="12"
        padding="16"
        fillHeight
        style={{ width: 320, minWidth: 0, flexShrink: 0 }}
      >
        <Row
          fillWidth
          horizontal="between"
          vertical="center"
          paddingBottom="16"
          borderBottom="neutral-alpha-weak"
        >
          <Row gap="8" vertical="center">
            <Skeleton shape="circle" size="xs" />
            <Skeleton shape="line" width="33%" size="m" />
          </Row>
          <Row gap="4">
            <Skeleton shape="circle" size="xs" />
            <Skeleton shape="circle" size="xs" />
          </Row>
        </Row>
        <Column height="40" fillWidth>
          <Skeleton shape="block" fillWidth />
        </Column>
        <Column height="32" fillWidth>
          <Skeleton shape="block" fillWidth />
        </Column>
        <Column gap="12" fillWidth style={{ flex: 1, minHeight: 0 }}>
          {THREAD_KEYS.map((key) => (
            <Row key={key} gap="12" vertical="center">
              <Skeleton shape="circle" size="m" />
              <Column gap="4" fillWidth>
                <Skeleton shape="line" width="75%" size="xs" />
                <Skeleton shape="line" width="50%" size="xs" />
              </Column>
            </Row>
          ))}
        </Column>
      </Column>

      {/* ConversationPanel */}
      <Column
        flex={1}
        fillWidth
        fillHeight
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="12"
      >
        <Skeleton shape="block" fillWidth fillHeight />
      </Column>
    </Row>
  );
}

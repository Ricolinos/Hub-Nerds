import { Column, Heading, Icon, Row, Text } from "@once-ui-system/core";

import { OrbitingCircles } from "@/components/magic";

export const metadata = {
  title: "Lab — componentes portados",
  robots: { index: false, follow: false },
};

/*
 * Banco de pruebas para componentes traídos de librerías externas y traducidos
 * al sistema de Once UI. No está enlazado desde ningún menú.
 */
export default function LabPage() {
  return (
    <Column as="main" fillWidth horizontal="center" paddingY="64">
      <Column maxWidth="l" fillWidth gap="40" horizontal="center">
        <Column gap="8" horizontal="center">
          <Text variant="label-default-s" onBackground="brand-medium">
            Lab
          </Text>
          <Heading variant="display-strong-s">OrbitingCircles</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak" align="center">
            Port de Magic UI sin Tailwind: geometría en CSS Modules, color por
            tokens de Once UI.
          </Text>
        </Column>

        {/*
          El contenedor debe ser `relative` y tener alto propio: OrbitingCircles
          se pinta como capa absoluta para poder apilar varios anillos.
        */}
        <Column
          fillWidth
          horizontal="center"
          vertical="center"
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          style={{
            position: "relative",
            height: "min(460px, 92vw)",
            overflow: "hidden",
          }}
        >
          <Icon name="sparkles" size="l" onBackground="brand-medium" />

          {/*
            Radios responsivos: en desktop mandan los px; por debajo de ~450px
            de ancho manda el vw, así el anillo exterior nunca se recorta.
          */}
          <OrbitingCircles
            radius="min(90px, 20vw)"
            duration={18}
            iconSize={36}
            pathColor="brand-alpha-weak"
          >
            <Icon name="edit" size="s" onBackground="neutral-medium" />
            <Icon name="folder" size="s" onBackground="neutral-medium" />
            <Icon name="shapes" size="s" onBackground="neutral-medium" />
          </OrbitingCircles>

          {/* Anillo exterior, girando en sentido contrario */}
          <OrbitingCircles
            radius="min(170px, 38vw)"
            duration={26}
            iconSize={40}
            reverse
            pathColor="neutral-alpha-weak"
          >
            <Icon name="person" size="s" onBackground="neutral-medium" />
            <Icon name="search" size="s" onBackground="neutral-medium" />
            <Icon name="calendar" size="s" onBackground="neutral-medium" />
            <Icon name="userGroup" size="s" onBackground="neutral-medium" />
          </OrbitingCircles>
        </Column>

        <Row fillWidth gap="16" s={{ direction: "column" }}>
          <Column
            fillWidth
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="24"
            gap="8"
          >
            <Text variant="label-default-s" onBackground="neutral-weak">
              Antes (Magic UI)
            </Text>
            <Text variant="body-default-s" onBackground="neutral-medium">
              stroke-black/10 dark:stroke-white/10
            </Text>
          </Column>
          <Column
            fillWidth
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="24"
            gap="8"
          >
            <Text variant="label-default-s" onBackground="brand-medium">
              Después (Once UI)
            </Text>
            <Text variant="body-default-s" onBackground="neutral-medium">
              pathColor=&quot;neutral-alpha-medium&quot;
            </Text>
          </Column>
        </Row>
      </Column>
    </Column>
  );
}

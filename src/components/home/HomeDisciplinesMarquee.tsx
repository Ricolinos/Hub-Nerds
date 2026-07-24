import { AutoScroll, Icon, Row, Text } from "@once-ui-system/core";

// Disciplinas reales del proyecto: coinciden con las categorías de
// /explorar (ver src/components/explore/categories.ts) y con los sugeridos
// de búsqueda del Showcase (SUGGESTED_SEARCHES en HomeShowcase.tsx) — no se
// inventan servicios ni marcas.
const DISCIPLINES = ["Diseño Gráfico", "Branding", "Ilustración", "Animación"];

export function HomeDisciplinesMarquee() {
  return (
    <Row
      fillWidth
      paddingY="24"
      borderTop="neutral-alpha-weak"
      borderBottom="neutral-alpha-weak"
      // min-width:0: red de seguridad para que este Row (flex item de la
      // Column de la página) pueda encogerse por debajo del ancho
      // intrínseco de AutoScroll en vez de heredar min-width:auto (gotcha
      // de flexbox ya documentado en este proyecto para overflow móvil).
      style={{ minWidth: 0 }}
    >
      <AutoScroll speed="slow" hover="pause" scrollGap="48" vertical="center">
        <Row gap="48" vertical="center">
          {DISCIPLINES.map((discipline) => (
            <Row key={discipline} gap="12" vertical="center">
              <Text variant="heading-strong-s" onBackground="neutral-strong">
                {discipline}
              </Text>
              <Icon name="sparkle" size="s" onBackground="brand-medium" />
            </Row>
          ))}
        </Row>
      </AutoScroll>
    </Row>
  );
}

"use client";

import { useState } from "react";
import { Button, Column, Heading, Icon, Line, Row, Text } from "@once-ui-system/core";
import { LinearGauge } from "@once-ui-system/core/modules";
import type { ProfileStrength, ProfileStrengthItem } from "@/lib/profileStrength";

interface ProfileStrengthWidgetProps {
  strength: ProfileStrength;
  /** Necesario para construir el deep-link a /[username]. */
  username: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Widget de fuerza de perfil del dashboard del Freelancer.
 *
 * Es puramente aditivo: no captura ningún dato por sí mismo, solo mide y
 * enlaza a los modales que ya viven en /[username] (ProfileView) vía el
 * parámetro `?editar=`. Cero UI de edición duplicada.
 *
 * A diferencia del patrón de Fiverr que inspiró esto, no bloquea nada ni
 * muestra candados: se enseña UNA sugerencia a la vez (la de mayor impacto)
 * y el resto queda colapsado, para que la lista no se lea como una deuda.
 * ══════════════════════════════════════════════════════════════════════════ */
export function ProfileStrengthWidget({ strength, username }: ProfileStrengthWidgetProps) {
  const [showAll, setShowAll] = useState(false);
  const { nextItem, pendingItems, completed, total, percent, isComplete } = strength;

  // El primer pendiente ya se muestra destacado arriba; "ver los restantes"
  // solo tiene sentido para los demás.
  const restItems = pendingItems.slice(1);

  const hrefFor = (item: ProfileStrengthItem) =>
    `/${username}?editar=${item.target}`;

  return (
    <Column
      fillWidth
      gap="16"
      padding="20"
      border="neutral-alpha-medium"
      radius="l"
      background="surface"
    >
      <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
        <Heading variant="heading-strong-s">Tu perfil</Heading>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {completed} de {total}
        </Text>
      </Row>

      <Column fillWidth height="24">
        {/* `hue` es un rango de tono HSL que LinearGauge interpola sobre las
            marcas: [200, 120] va del cyan de la marca al verde. Deliberado:
            el preset "neutral" es en realidad [30, 60] (ámbar) y pintaría de
            color de advertencia un perfil a medio llenar, que es justo la
            lectura de regaño que este widget evita. */}
        <LinearGauge value={percent} hue={[200, 120]} line={{ count: 32, length: 16 }} />
      </Column>

      {isComplete ? (
        <Row gap="8" vertical="center">
          <Icon name="check" size="s" onBackground="success-weak" />
          <Text variant="body-default-s" onBackground="neutral-weak">
            Tu perfil está completo. Puedes seguir sumando proyectos cuando quieras.
          </Text>
        </Row>
      ) : (
        nextItem && (
          <Column
            fillWidth
            gap="12"
            padding="16"
            border="neutral-alpha-weak"
            radius="m"
            background="neutral-alpha-weak"
          >
            <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
              <Icon name={nextItem.icon} size="s" onBackground="brand-weak" />
              <Text
                variant="label-default-m"
                onBackground="neutral-strong"
                style={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {nextItem.label}
              </Text>
            </Row>
            <Text
              variant="body-default-s"
              onBackground="neutral-weak"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {nextItem.benefit}
            </Text>
            <Row>
              <Button variant="primary" size="s" href={hrefFor(nextItem)}>
                {nextItem.cta}
              </Button>
            </Row>
          </Column>
        )
      )}

      {restItems.length > 0 && (
        <Column fillWidth gap="12">
          <Row>
            <Button
              variant="tertiary"
              size="s"
              suffixIcon={showAll ? "chevronUp" : "chevronDown"}
              onClick={() => setShowAll((open) => !open)}
            >
              {showAll ? "Ocultar" : `Ver los ${restItems.length} restantes`}
            </Button>
          </Row>

          {showAll && (
            <Column fillWidth border="neutral-alpha-medium" radius="m" overflow="hidden">
              {restItems.map((item, index) => (
                <Column key={item.id} fillWidth>
                  {index > 0 && <Line background="neutral-alpha-weak" />}
                  <Row
                    fillWidth
                    paddingX="16"
                    paddingY="12"
                    horizontal="between"
                    vertical="center"
                    gap="12"
                    wrap
                  >
                    <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                      <Icon name={item.icon} size="xs" onBackground="neutral-weak" />
                      <Text
                        variant="body-default-s"
                        onBackground="neutral-strong"
                        style={{ minWidth: 0, overflowWrap: "anywhere" }}
                      >
                        {item.label}
                      </Text>
                    </Row>
                    <Button variant="secondary" size="s" href={hrefFor(item)}>
                      {item.cta}
                    </Button>
                  </Row>
                </Column>
              ))}
            </Column>
          )}
        </Column>
      )}
    </Column>
  );
}

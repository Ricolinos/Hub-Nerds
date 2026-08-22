import type { IconName } from "@once-ui-system/core";
import { Card, Column, Heading, Icon, RevealFx, Row, SmartLink, Tag, Text } from "@once-ui-system/core";

export const metadata = {
  title: "Nuestros Servicios",
  description: "Diseño estratégico adaptado a tus necesidades.",
};

const SERVICE_CARDS: { icon: IconName; label: string; href: string; badge?: string }[] = [
  { icon: "rocket", label: "Cotiza tu proyecto", href: "/servicios/cotizador", badge: "Miembros" },
  { icon: "infoCircle", label: "Información", href: "/servicios/informacion" },
  { icon: "creditCard", label: "Facturación", href: "/servicios/facturacion" },
];

export default function ServiciosPage() {
  return (
    <Column fillWidth maxWidth="l" paddingY="80" paddingX="24" gap="48" horizontal="center">
      <RevealFx fillWidth translateY="8" horizontal="center">
        <Column fillWidth gap="16" horizontal="center" align="center" maxWidth="s">
          <Heading variant="display-strong-l" align="center">
            Nuestros Servicios
          </Heading>
          <Text onBackground="neutral-weak" variant="body-default-l" align="center">
            Diseño estratégico adaptado a tus necesidades.
          </Text>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.1}>
        <Card fillWidth padding="48">
          <Column fillWidth gap="32" horizontal="center" align="center">
            <Row gap="24" wrap horizontal="center">
              {SERVICE_CARDS.map(({ icon, label, href, badge }) => (
                <SmartLink key={label} href={href} unstyled>
                  <Column
                    gap="12"
                    horizontal="center"
                    align="center"
                    padding="24"
                    minWidth={10}
                    cursor="pointer"
                  >
                    <Icon
                      name={icon}
                      size="l"
                      padding="16"
                      radius="l"
                      background="neutral-alpha-weak"
                      border="neutral-alpha-weak"
                    />
                    <Text variant="label-strong-m" onBackground="neutral-strong" align="center">
                      {label}
                    </Text>
                    {badge && (
                      <Tag variant="neutral" size="s">
                        {badge}
                      </Tag>
                    )}
                  </Column>
                </SmartLink>
              ))}
            </Row>
            <Column maxWidth="xs" horizontal="center">
              <Text onBackground="neutral-weak" variant="body-default-s" align="center">
                Explora nuestros servicios de diseño y cotiza tu proyecto desde el menú.
              </Text>
            </Column>
          </Column>
        </Card>
      </RevealFx>
    </Column>
  );
}

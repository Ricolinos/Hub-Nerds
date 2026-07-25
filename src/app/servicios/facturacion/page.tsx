import type { IconName } from "@once-ui-system/core";
import { Column, Heading, Icon, RevealFx, Row, Text } from "@once-ui-system/core";

export const metadata = {
  title: "Facturación",
  description: "Pagos por proyecto en MXN, anticipo, liquidación y facturación CFDI.",
};

const BILLING_ITEMS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "creditCard",
    title: "Pagos por proyecto, en MXN",
    description: "Cada cotización se paga en pesos mexicanos; sin tarifas por hora ni sorpresas.",
  },
  {
    icon: "refreshCw",
    title: "Anticipo y liquidación",
    description:
      "El proyecto arranca con un anticipo; el saldo se liquida al momento de la entrega.",
  },
  {
    icon: "document",
    title: "Facturación CFDI",
    description: "Disponible para clients en México que la requieran para su contabilidad.",
  },
  {
    icon: "briefcase",
    title: "Métodos de pago",
    description: "Transferencia bancaria como método disponible.",
  },
];

export default function FacturacionPage() {
  return (
    <Column fillWidth maxWidth="l" paddingY="80" paddingX="24" gap="48" horizontal="center">
      <RevealFx fillWidth translateY="8" horizontal="center">
        <Column fillWidth gap="16" horizontal="center" align="center" maxWidth="s">
          <Heading variant="display-strong-l" align="center">
            Facturación
          </Heading>
          <Text onBackground="neutral-weak" variant="body-default-l" align="center">
            Cómo se paga y se factura cada proyecto, sin tablas ni letras chiquitas.
          </Text>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.1}>
        <Column fillWidth gap="16">
          {BILLING_ITEMS.map((item) => (
            <Row
              key={item.title}
              fillWidth
              gap="16"
              vertical="center"
              padding="24"
              background="surface"
              border="neutral-alpha-weak"
              radius="l"
            >
              <Icon
                name={item.icon}
                size="l"
                padding="16"
                radius="l"
                background="neutral-alpha-weak"
                border="neutral-alpha-weak"
              />
              <Column gap="4">
                <Text variant="label-strong-m" onBackground="neutral-strong">
                  {item.title}
                </Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {item.description}
                </Text>
              </Column>
            </Row>
          ))}
        </Column>
      </RevealFx>
    </Column>
  );
}

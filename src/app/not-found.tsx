import { Button, Column, Heading, Text } from "@once-ui-system/core";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <Column as="section" fill center paddingBottom="160" gap="l">
      <Text marginBottom="s" variant="display-strong-xl">
        404
      </Text>
      <Heading marginBottom="l" variant="display-default-xs">
        Esta página no existe
      </Heading>
      <Text onBackground="neutral-weak" marginBottom="l">
        No encontramos lo que buscabas. Puede que el enlace esté roto o la página se haya movido.
      </Text>
      <Button href="/" label="Volver al inicio" variant="secondary" />
    </Column>
  );
}

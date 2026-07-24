import { BlockQuote, Column } from "@once-ui-system/core";

// Frase editorial de la plataforma, no un testimonial: sin `author` (no se
// fabrica una cita atribuida a un cliente/partner inexistente). Tamaño
// contenido a propósito (heading-strong, no display-*): el catálogo de
// Once-UI marca "keep smaller than section headings" para BlockQuote.
export function HomeManifestoQuote() {
  return (
    <Column fillWidth paddingY="32" horizontal="center">
      <BlockQuote maxWidth={32}>
        Cada proyecto empieza con un talento dispuesto a mostrarse.
      </BlockQuote>
    </Column>
  );
}

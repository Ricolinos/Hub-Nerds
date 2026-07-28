// Proyecto de prueba del visor de casos de estudio: renderiza el fixture con
// TODOS los elementos disponibles en markdown por el MISMO camino que la ruta
// real (`CustomMDX` con el mapa de componentes de mdx.tsx), dentro del mismo
// `Column as="article" maxWidth="xs"` que usa
// app/[username]/proyecto/[slug]/page.tsx — así el ancho de línea y los
// márgenes son los de producción, no los de una página de laboratorio.
import { Column, Heading, Text } from "@once-ui-system/core";
import { CustomMDX } from "@/components";
import { MARKDOWN_SHOWCASE, SHOWCASE_ATTACHMENTS } from "./fixture";

export const metadata = {
  title: "Showcase de markdown · Hub-Nerds",
  robots: { index: false, follow: false },
};

export default function MarkdownShowcasePage() {
  return (
    <Column fillWidth paddingY="64" horizontal="center">
      <Column maxWidth="xs" fillWidth gap="8" paddingBottom="32">
        <Heading variant="display-strong-s">Showcase de markdown</Heading>
        <Text onBackground="neutral-weak" variant="body-default-m">
          Todos los elementos que hoy se pueden ver en un caso de estudio, renderizados por el mismo
          pipeline que la ruta pública. El primer carousel usa el estilo coverflow nuevo; el segundo,
          el clásico de Once UI, para poder compararlos.
        </Text>
      </Column>
      <Column style={{ margin: "auto" }} as="article" maxWidth="xs" gap="16">
        <CustomMDX source={MARKDOWN_SHOWCASE} attachments={SHOWCASE_ATTACHMENTS} />
      </Column>
    </Column>
  );
}

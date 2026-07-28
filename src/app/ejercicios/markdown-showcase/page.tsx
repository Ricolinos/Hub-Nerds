// Proyecto de prueba del visor de casos de estudio: renderiza el fixture con
// TODOS los elementos disponibles en markdown por el MISMO camino que la ruta
// real (`CustomMDX` con el mapa de componentes de mdx.tsx), dentro del mismo
// `Column as="article" maxWidth="xs"` que usa
// app/[username]/proyecto/[slug]/page.tsx — así el ancho de línea y los
// márgenes son los de producción, no los de una página de laboratorio.
import { Column, Heading, Text } from "@once-ui-system/core";
import { CustomMDX } from "@/components";
import { MARKDOWN_SHOWCASE, SHOWCASE_ATTACHMENTS } from "./fixture";

// PÁGINA NO LISTADA (accesible solo por enlace directo). Las cuatro vías por
// las que alguien podría llegar sin conocer la URL están cerradas:
//   1. `robots: noindex, nofollow` de abajo — los buscadores no la indexan ni
//      siguen sus enlaces.
//   2. `Disallow` explícito en app/robots.ts — los rastreadores ni la piden.
//   3. sitemap.ts solo publica las claves de `routes` de once-ui.config.ts
//      (rutas de primer nivel), así que una subruta como esta nunca entra.
//   4. el índice /ejercicios se arma desde la tabla `markdownExercise` y
//      enlaza a /ejercicios/[slug]; esta ruta es estática y no vive en esa
//      tabla, así que no aparece en el listado.
// Sigue siendo una URL pública para quien la tenga: no hay autenticación, es
// contenido de prueba sin datos reales.
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
          pipeline que la ruta pública. Los tres primeros carousels muestran los estilos disponibles
          —coverflow, anillo 3D y el clásico de Once UI— para poder compararlos.
        </Text>
        <Text onBackground="neutral-weak" variant="body-default-s">
          Página no listada: no se indexa, no está en el sitemap y nada del sitio enlaza a ella.
        </Text>
      </Column>
      <Column style={{ margin: "auto" }} as="article" maxWidth="xs" gap="16">
        <CustomMDX source={MARKDOWN_SHOWCASE} attachments={SHOWCASE_ATTACHMENTS} />
      </Column>
    </Column>
  );
}

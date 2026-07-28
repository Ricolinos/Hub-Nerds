import React from "react";
import {
  type CollaboratorPillPerson,
  CollaboratorPills,
} from "@/components/originkit/CollaboratorPills";

// Bloque "Freelancers" del editor (ver ContentBlocks.tsx, type "avatarGroup"):
// mismo patrón children→array que `MdxCarousel` (ver mdx-carousel.tsx).
// `CollaboratorPills.people` es un array-prop, imposible de serializar
// directo como `people={[...]}` — blockJS de next-mdx-remote/rsc elimina
// cualquier prop con llaves (ver el GOTCHA extenso junto a `escapeAttr` en
// ContentBlocks.tsx). Cada persona sobrevive como un hijo
// `<CollaboratorPerson>` con props STRING planas; `Collaborators` las
// reconstruye en runtime a partir de `children`.
//
// Solo los colaboradores de la PLATAFORMA (con `username`, encontrados por el
// buscador de ContentBlocks.tsx) pasan por aquí. Los avatares manuales
// (URL/iniciales sueltas) de bloques guardados ANTES de esta tarea —cuando
// el bloque sí permitía añadirlos a mano— siguen su propio camino: la fila
// de `Avatar` sueltos de siempre (ver blockToMarkdown case "avatarGroup" en
// ContentBlocks.tsx). No se puede reconstruir un `CollaboratorPillPerson`
// razonable para esos avatares (sin nombre real ni forma confiable de
// distinguir "sin headline" de "headline vacío"), así que en vez de forzar
// una migración se conserva el camino legado intacto.

export interface CollaboratorPersonProps {
  name: string;
  username?: string;
  avatarUrl?: string;
  headline?: string;
}

// Nodo puramente de datos: `Collaborators` lee sus props vía
// `React.Children`, nunca se monta solo (ni en el editor ni en el visor
// publicado). Devuelve `null` a propósito, mismo criterio que cualquier
// "descriptor" de datos sin representación visual propia (ver `RoundSlide`/
// `CoverflowSlide`, que ni siquiera son componentes).
export function CollaboratorPerson(_props: CollaboratorPersonProps) {
  return null;
}

interface CollaboratorsProps {
  children?: React.ReactNode;
}

export function Collaborators({ children }: CollaboratorsProps) {
  const people: CollaboratorPillPerson[] = React.Children.toArray(children)
    .filter(
      (child): child is React.ReactElement<CollaboratorPersonProps> =>
        React.isValidElement(child) && child.type === CollaboratorPerson,
    )
    .map((child, index) => {
      const { name, username, avatarUrl, headline } = child.props;
      return {
        id: username || `collaborator-${index}`,
        name,
        username,
        avatarUrl,
        headline,
      };
    });

  return <CollaboratorPills people={people} />;
}

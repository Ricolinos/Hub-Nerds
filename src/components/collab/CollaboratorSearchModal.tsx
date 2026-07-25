"use client";

import { Kbar, Text } from "@once-ui-system/core";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

export interface CollaboratorSearchPerson {
  id: string;
  name: string | null;
  username: string | null;
  headline?: string | null;
}

interface CollaboratorSearchModalProps {
  people: CollaboratorSearchPerson[];
  onSelect: (personId: string) => void;
  // Botón/trigger que abre el buscador; Kbar lo recibe como children y le
  // agrega el onClick. Si `people` está vacío se clona deshabilitado.
  trigger: ReactNode;
  // Mensaje mostrado bajo el trigger cuando no hay nadie que buscar.
  emptyHint?: string;
}

// Command-palette (Kbar) para buscar entre una lista de personas, agrupadas
// visualmente por su puesto (headline). Compartido por el gestor de
// proyectos (agregar colaborador a un CollabProject, src/components/collab/
// CollabProjectView.tsx) y el panel de client (buscar nuevo talento para
// conectar, src/components/profile/ClientProfileView.tsx) — misma UX, dos
// fuentes de datos y dos acciones distintas al seleccionar.
export function CollaboratorSearchModal({
  people,
  onSelect,
  trigger,
  emptyHint,
}: CollaboratorSearchModalProps) {
  if (people.length === 0) {
    const disabledTrigger = isValidElement(trigger)
      ? cloneElement(trigger as ReactElement<{ disabled?: boolean }>, { disabled: true })
      : trigger;
    return (
      <>
        {disabledTrigger}
        {emptyHint && (
          <Text variant="label-default-s" onBackground="neutral-weak">
            {emptyHint}
          </Text>
        )}
      </>
    );
  }

  const items = people.map((person) => ({
    id: person.id,
    name: person.name ?? person.username ?? "Sin nombre",
    section: person.headline ?? "Sin puesto",
    shortcut: [] as string[],
    keywords: [person.username, person.headline].filter(Boolean).join(" "),
    icon: "person",
    perform: () => onSelect(person.id),
  }));

  return (
    <Kbar items={items} inputSize="s">
      {trigger}
    </Kbar>
  );
}

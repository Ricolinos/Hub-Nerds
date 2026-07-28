"use client";

import { Button, Column } from "@once-ui-system/core";
// Banco de pruebas del editor: abre CreateProjectModal sin pasar por Clerk,
// para poder auditarlo en navegador (el modal real vive tras el login).
//
// PÁGINA NO LISTADA, igual que /ejercicios/markdown-showcase: nada del sitio
// enlaza aquí, el sitemap solo publica rutas de primer nivel y hay un
// `Disallow` explícito en app/robots.ts. OJO: al ser un componente de cliente
// no puede exportar `metadata`, así que —a diferencia del showcase— NO lleva
// `noindex`; la protección es solo el robots.txt.
import { useState } from "react";
import { CreateProjectModal } from "@/components/profile/CreateProjectModal";

export default function EditorAuditPage() {
  const [open, setOpen] = useState(false);
  return (
    <Column fillWidth padding="64" horizontal="center">
      <Button id="open-editor" onClick={() => setOpen(true)}>
        Publicar proyecto
      </Button>
      <CreateProjectModal
        isOpen={open}
        onClose={() => setOpen(false)}
        owner={{
          id: "owner-stub",
          username: "owner-stub",
          name: "Dueña del Proyecto",
          imageUrl: "/images/gallery/img-01.jpg",
          headline: "Directora de arte",
          primaryRole: "Diseño",
        }}
      />
    </Column>
  );
}

"use client";

// SCRATCH: página temporal solo para auditar visualmente CreateProjectModal.
// No se commitea.
import { useState } from "react";
import { Button, Column } from "@once-ui-system/core";
import { CreateProjectModal } from "@/components/profile/CreateProjectModal";

export default function EditorAuditPage() {
  const [open, setOpen] = useState(false);
  return (
    <Column fillWidth padding="64" horizontal="center">
      <Button id="open-editor" onClick={() => setOpen(true)}>
        Publicar proyecto
      </Button>
      <CreateProjectModal isOpen={open} onClose={() => setOpen(false)} />
    </Column>
  );
}

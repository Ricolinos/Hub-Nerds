"use client";

import { Button, Column, Dialog, Feedback, Row, Text, useToast } from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitEntry } from "@/app/actions/contests";
import type { Prisma } from "@/generated/prisma/client";
import { type ContestBlock, toContestBlocks } from "@/lib/contestBrief";
import { daysUntil } from "@/lib/contestPhaseUi";
import { ContestBlockEditor } from "./ContestBlockEditor";

/* ══ Formulario de entrega del finalista (fase "production") ═════════════
   Sin input de coverUrl: DESVIACIÓN DOCUMENTADA (ver informe de la tarea)
   — el único patrón existente para portada (CreateProjectModal.tsx) trae un
   uploader/dropzone completo, no reutilizable aquí sin salirse del alcance
   de este formulario de texto estructurado; submitEntry acepta coverUrl
   opcional y ya funciona sin él (null). ═════════════════════════════════ */

export function ContestEntrySubmitForm({
  applicationId,
  submitDeadline,
  initialContentBlocks,
}: {
  applicationId: string;
  submitDeadline: string;
  initialContentBlocks: unknown;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [blocks, setBlocks] = useState<ContestBlock[]>(toContestBlocks(initialContentBlocks));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const days = daysUntil(submitDeadline);
  const deadlineLabel =
    days < 0 ? "Cierre de entrega pasado" : days === 0 ? "Entrega hoy" : days === 1 ? "Entrega mañana" : `Entrega en ${days} días`;
  const hasContent = blocks.some(
    (block) => (block.type === "paragraph" && block.content.trim()) || (block.type === "section" && block.title.trim()),
  );

  const handleSubmit = async () => {
    setSending(true);
    const result = await submitEntry(applicationId, blocks as unknown as Prisma.InputJsonValue);
    setSending(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Entrega enviada." });
    setConfirmOpen(false);
    router.refresh();
  };

  return (
    <Column fillWidth gap="16" background="surface" border="neutral-alpha-weak" radius="l" padding="24">
      <Row fillWidth horizontal="between" vertical="center" wrap gap="12">
        <Text variant="heading-strong-s" onBackground="neutral-strong">
          Tu entrega
        </Text>
        <Text variant="body-default-s" onBackground={days <= 2 ? "danger-strong" : "neutral-weak"}>
          {deadlineLabel}
        </Text>
      </Row>

      <ContestBlockEditor
        value={blocks}
        onChange={setBlocks}
        emptyHint="Escribe tu propuesta: concepto, desarrollo y entregables."
      />

      <Row fillWidth horizontal="end">
        <Button variant="primary" size="m" onClick={() => setConfirmOpen(true)} disabled={!hasContent}>
          Enviar entrega
        </Button>
      </Row>

      <Dialog
        open={confirmOpen}
        onClose={() => !sending && setConfirmOpen(false)}
        title="¿Enviar tu entrega?"
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={() => setConfirmOpen(false)} disabled={sending}>
              Seguir editando
            </Button>
            <Button variant="primary" size="m" onClick={handleSubmit} loading={sending}>
              Sí, enviar
            </Button>
          </Row>
        }
      >
        <Feedback
          variant="warning"
          description="Tras enviarla queda sellada con la fecha y hora actuales; ya no podrás editarla."
        />
      </Dialog>
    </Column>
  );
}

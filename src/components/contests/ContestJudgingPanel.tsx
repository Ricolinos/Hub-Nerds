"use client";

import { Button, Checkbox, Column, Dialog, Feedback, RadioButton, Row, Text, useToast } from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { awardContest } from "@/app/actions/contests";

/* ══ Panel de fallo del client dueño ══════════════════════════════════════
   El contenido de cada entrega (CustomMDX) se renderiza en el Server
   Component (page.tsx, vía ContestEntryView) y llega aquí ya compuesto en
   `entryNodes` — este Client Component solo añade la interacción de
   selección (radio de ganador + checkboxes de runner-up) alrededor de ese
   contenido ya renderizado. Mismo motivo de boundary que ContestEntryView.
   ══════════════════════════════════════════════════════════════════════ */

interface JudgingApplication {
  id: string;
  freelancerName: string;
}

export function ContestJudgingPanel({
  contestId,
  applications,
  entryNodes,
}: {
  contestId: string;
  applications: JudgingApplication[];
  entryNodes: Record<string, ReactNode>;
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [finalistIds, setFinalistIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const toggleFinalist = (id: string) => {
    setFinalistIds((current) => (current.includes(id) ? current.filter((appId) => appId !== id) : [...current, id]));
  };

  const selectWinner = (id: string) => {
    setWinnerId(id);
    setFinalistIds((current) => current.filter((appId) => appId !== id));
  };

  const handlePublish = async () => {
    if (!winnerId) return;
    setPublishing(true);
    const result = await awardContest(contestId, winnerId, finalistIds);
    setPublishing(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Fallo publicado." });
    setConfirmOpen(false);
    router.refresh();
  };

  return (
    <Column fillWidth gap="16">
      <Row fillWidth horizontal="between" vertical="center" wrap gap="12">
        <Text variant="heading-strong-s" onBackground="neutral-strong">
          Panel de fallo
        </Text>
        <Button variant="primary" size="s" onClick={() => setConfirmOpen(true)} disabled={!winnerId}>
          Publicar fallo
        </Button>
      </Row>
      <Text variant="body-default-s" onBackground="neutral-weak">
        Elige un ganador y, opcionalmente, marca runner-ups como finalistas destacados. El resto de la Terna queda
        como participante.
      </Text>

      <Column fillWidth gap="16">
        {applications.map((application) => (
          <Column key={application.id} fillWidth gap="8">
            <Row gap="16" vertical="center" wrap>
              <RadioButton
                name="contest-winner"
                isChecked={winnerId === application.id}
                onToggle={() => selectWinner(application.id)}
                label={`Ganador (${application.freelancerName})`}
              />
              <Checkbox
                isChecked={finalistIds.includes(application.id)}
                onToggle={() => toggleFinalist(application.id)}
                disabled={winnerId === application.id}
                label="Runner-up destacado"
              />
            </Row>
            {entryNodes[application.id]}
          </Column>
        ))}
      </Column>

      <Dialog
        isOpen={confirmOpen}
        onClose={() => !publishing && setConfirmOpen(false)}
        title="¿Publicar el fallo?"
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={() => setConfirmOpen(false)} disabled={publishing}>
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handlePublish} loading={publishing}>
              Sí, publicar
            </Button>
          </Row>
        }
      >
        <Feedback
          variant="warning"
          description="Esta acción es irreversible y pública: se creará el proyecto de colaboración con el ganador y el resultado quedará visible para todos."
        />
      </Dialog>
    </Column>
  );
}

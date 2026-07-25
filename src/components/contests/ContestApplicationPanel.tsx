"use client";

import { Button, Column, Dialog, Feedback, Row, Tag, Text, useToast } from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { withdrawApplication } from "@/app/actions/contests";
import type { ContestApplicationStatus } from "@/generated/prisma/client";
import { contestApplicationStatusTag } from "@/lib/contestPhaseUi";
import { ContestApplyDialog } from "./ContestApplyDialog";

/* ══ Panel de acción del detalle de convocatoria ══════════════════════════
   Server component (page.tsx) resuelve viewer/ownership/postulación previa
   y le pasa el resultado YA calculado — este componente solo decide qué
   botón mostrar, mismo criterio que canApplyToContest (src/lib/contests.ts)
   pero sin repetir esa lógica de negocio en el cliente. ═══════════════════ */

interface Props {
  contestId: string;
  canApply: boolean;
  cannotApplyReason: string | null;
  isOwner: boolean;
  applicationCount: number;
  viewerApplication: { id: string; status: ContestApplicationStatus; pitch: string } | null;
  isLoggedOut: boolean;
}

export function ContestApplicationPanel({
  contestId,
  canApply,
  cannotApplyReason,
  isOwner,
  applicationCount,
  viewerApplication,
  isLoggedOut,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    if (!viewerApplication) return;
    setWithdrawing(true);
    const result = await withdrawApplication(viewerApplication.id);
    setWithdrawing(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Postulación retirada." });
    setWithdrawOpen(false);
    router.refresh();
  };

  if (isOwner) {
    return (
      <Row gap="12" vertical="center" wrap>
        <Tag size="m" variant="brand" label="Tu convocatoria" />
        <Text variant="body-default-s" onBackground="neutral-weak">
          {applicationCount} postulación{applicationCount === 1 ? "" : "es"} recibida
          {applicationCount === 1 ? "" : "s"}
        </Text>
      </Row>
    );
  }

  if (viewerApplication) {
    const status = contestApplicationStatusTag(viewerApplication.status);
    return (
      <Column gap="12" fillWidth>
        <Row gap="12" vertical="center" wrap>
          <Tag size="m" variant={status.variant} label={status.label} />
          {viewerApplication.status === "SUBMITTED" && (
            <Button variant="secondary" size="s" onClick={() => setWithdrawOpen(true)}>
              Retirar postulación
            </Button>
          )}
        </Row>

        <Dialog
          isOpen={withdrawOpen}
          onClose={() => !withdrawing && setWithdrawOpen(false)}
          title="¿Retirar tu postulación?"
          footer={
            <Row fillWidth gap="8" horizontal="end">
              <Button
                variant="secondary"
                size="m"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
              >
                Cancelar
              </Button>
              <Button variant="danger" size="m" onClick={handleWithdraw} loading={withdrawing}>
                Sí, retirar
              </Button>
            </Row>
          }
        >
          <Feedback
            variant="warning"
            description="Podrás volver a explorar la convocatoria, pero perderás tu lugar en esta postulación."
          />
        </Dialog>
      </Column>
    );
  }

  if (isLoggedOut) {
    return (
      <Row gap="8" vertical="center" wrap>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Inicia sesión como Freelancer para postularte.
        </Text>
        <Button variant="secondary" size="s" href="/sign-in">
          Iniciar sesión
        </Button>
      </Row>
    );
  }

  if (!canApply) {
    return cannotApplyReason ? (
      <Text variant="body-default-s" onBackground="neutral-weak">
        {cannotApplyReason}
      </Text>
    ) : null;
  }

  return (
    <>
      <Button variant="primary" size="m" onClick={() => setApplyOpen(true)}>
        Postularme
      </Button>
      <ContestApplyDialog isOpen={applyOpen} onClose={() => setApplyOpen(false)} contestId={contestId} />
    </>
  );
}

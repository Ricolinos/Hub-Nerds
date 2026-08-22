"use client";

import { Button, Column, DateInput, Dialog, Feedback, Row, Text } from "@once-ui-system/core";
import { useState, useTransition } from "react";
import { extendContestDeadline } from "@/app/actions/contests";
import type { ContestManagementItem } from "@/lib/contests";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";

const CONTEST_EXTEND_UPSELL_BENEFITS = [
  "Prórrogas de fecha hasta 2 veces por convocatoria",
  "Convocatorias activas sin límite",
  "Publicaciones destacadas en el listado",
];

/* ══ Prórroga de fechas (panel de gestión, solo Pro) ══════════════════════
   Mismo patrón de Dialog+footer que ContestApplyDialog/ContestOwnerApplica-
   tionsPanel; la única fecha condicional es applyDeadline (solo editable
   mientras la fase derivada actual siga "applications", igual que valida
   extendContestDeadline en el server). No duplica la validación de negocio
   del server action (fechas solo hacia adelante, orden apply<submit<results):
   se llama tal cual y sus errores se muestran sin reinterpretarlos, salvo los
   dos casos con UI dedicada (PRO_REQUIRED → upsell, EXTENSION_LIMIT → aviso
   danger explícito). ════════════════════════════════════════════════════ */

export function ContestExtendDialog({
  contest,
  isOpen,
  onClose,
  onExtended,
}: {
  contest: ContestManagementItem;
  isOpen: boolean;
  onClose: () => void;
  onExtended: () => void;
}) {
  const [applyDeadline, setApplyDeadline] = useState(() => new Date(contest.applyDeadline));
  const [submitDeadline, setSubmitDeadline] = useState(() => new Date(contest.submitDeadline));
  const [resultsDate, setResultsDate] = useState(() => new Date(contest.resultsDate));
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canExtendApply = contest.phase === "applications";

  const handleClose = () => {
    if (pending) return;
    onClose();
  };

  const handleExtend = () => {
    setError(null);
    setLimitReached(false);

    const input: { applyDeadline?: string; submitDeadline?: string; resultsDate?: string } = {};
    if (canExtendApply && applyDeadline.getTime() !== new Date(contest.applyDeadline).getTime()) {
      input.applyDeadline = applyDeadline.toISOString();
    }
    if (submitDeadline.getTime() !== new Date(contest.submitDeadline).getTime()) {
      input.submitDeadline = submitDeadline.toISOString();
    }
    if (resultsDate.getTime() !== new Date(contest.resultsDate).getTime()) {
      input.resultsDate = resultsDate.toISOString();
    }
    if (Object.keys(input).length === 0) {
      setError("Mueve al menos una fecha para prorrogar.");
      return;
    }

    startTransition(async () => {
      const result = await extendContestDeadline(contest.id, input);
      if (!result.ok) {
        if (result.error === "PRO_REQUIRED") {
          setUpsellOpen(true);
          return;
        }
        if (result.error === "EXTENSION_LIMIT") {
          setLimitReached(true);
          return;
        }
        setError(result.error);
        return;
      }
      onExtended();
    });
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title="Prorrogar convocatoria"
        maxWidth={28}
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={handleClose} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleExtend} loading={pending}>
              Prorrogar
            </Button>
          </Row>
        }
      >
        <Column gap="16" fillWidth paddingTop="12">
          <Feedback
            variant="warning"
            description={`Las fechas solo pueden moverse hacia adelante. Máximo 2 prórrogas por convocatoria (llevas ${contest.extensionsCount}/2). Se notificará a todos los aplicantes.`}
          />

          {canExtendApply ? (
            <DateInput
              id="extend-apply-deadline"
              label="Cierre de postulaciones"
              value={applyDeadline}
              onChange={setApplyDeadline}
              minDate={new Date(contest.applyDeadline)}
            />
          ) : (
            <Text variant="body-default-s" onBackground="neutral-weak">
              El cierre de postulaciones ya no es prorrogable en esta fase.
            </Text>
          )}
          <DateInput
            id="extend-submit-deadline"
            label="Cierre de entrega (Terna)"
            value={submitDeadline}
            onChange={setSubmitDeadline}
            minDate={new Date(contest.submitDeadline)}
          />
          <DateInput
            id="extend-results-date"
            label="Fecha de resultados"
            value={resultsDate}
            onChange={setResultsDate}
            minDate={new Date(contest.resultsDate)}
          />

          {error && <Feedback variant="danger" description={error} />}
          {limitReached && (
            <Feedback variant="danger" description="Ya usaste las 2 prórrogas de esta convocatoria." />
          )}
        </Column>
      </Dialog>

      <ProUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        title="Prorroga tus fechas"
        message="Las prórrogas son una ventaja de Client Pro"
        benefits={CONTEST_EXTEND_UPSELL_BENEFITS}
      />
    </>
  );
}

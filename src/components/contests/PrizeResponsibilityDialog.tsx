"use client";

import { Button, Checkbox, Column, Dialog, Feedback, Row, Text, useToast } from "@once-ui-system/core";
import { useState, useTransition } from "react";
import { acceptPrizeResponsibility } from "@/app/actions/contests";
import { RESPONSIBILITY_LETTER, RESPONSIBILITY_VERSION, type InKindPrizeType } from "@/lib/prizeResponsibility";

/* ══ Carta de responsabilidad del premio en especie (Términos §3.5) ═══════
   Requiere un contestId ya persistido: el caller (ContestWizardForm) guarda
   el borrador ANTES de abrir este Dialog (ver su handleOpenResponsibility),
   así este componente puede asumir que contestId siempre es válido mientras
   isOpen. Firmar = acceptPrizeResponsibility (server action, valida
   ownership/plan/DRAFT/in-kind de nuevo); onAccepted informa al wizard el
   momento local de la firma para pintar el badge sin esperar un refresh de
   la página completa. `showRequiredNotice` se enciende cuando publishContest
   devolvió RESPONSIBILITY_REQUIRED, para explicar por qué se abrió solo. ══ */

export function PrizeResponsibilityDialog({
  isOpen,
  onClose,
  contestId,
  prizeType,
  showRequiredNotice = false,
  onAccepted,
}: {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
  prizeType: InKindPrizeType;
  showRequiredNotice?: boolean;
  onAccepted: (acceptedAt: string) => void;
}) {
  const { addToast } = useToast();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const letter = RESPONSIBILITY_LETTER[prizeType];

  const handleClose = () => {
    if (pending) return;
    setChecked(false);
    setError(null);
    onClose();
  };

  const handleSign = () => {
    setError(null);
    startTransition(async () => {
      const result = await acceptPrizeResponsibility(contestId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      addToast({ variant: "success", message: "Carta de responsabilidad firmada." });
      setChecked(false);
      onAccepted(new Date().toISOString());
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={letter.title}
      maxWidth={32}
      footer={
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={pending}>
            Cerrar
          </Button>
          <Button variant="primary" size="m" onClick={handleSign} disabled={!checked} loading={pending}>
            Firmar y aceptar
          </Button>
        </Row>
      }
    >
      <Column gap="16" fillWidth paddingTop="12">
        {showRequiredNotice && (
          <Feedback
            variant="warning"
            description="Firma la carta de responsabilidad antes de publicar esta convocatoria."
          />
        )}
        <Column gap="12" fillWidth paddingRight="8" style={{ maxHeight: 320, overflowY: "auto" }}>
          {letter.body.map((paragraph, index) => (
            <Text key={`${prizeType}-${index}`} variant="body-default-s" onBackground="neutral-weak">
              {paragraph}
            </Text>
          ))}
        </Column>
        <Checkbox
          isChecked={checked}
          onToggle={() => setChecked((current) => !current)}
          label={`He leído y acepto los términos de esta carta de responsabilidad (versión ${RESPONSIBILITY_VERSION})`}
        />
        {error && <Feedback variant="danger" description={error} />}
      </Column>
    </Dialog>
  );
}

"use client";

import { Avatar, Button, Checkbox, Column, Dialog, Feedback, Media, Row, SmartLink, Tag, Text, useToast } from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { selectShortlist } from "@/app/actions/contests";
import type { ContestApplicationDetail, ContestPhase } from "@/lib/contests";
import { contestApplicationStatusTag, formatContestMoney } from "@/lib/contestPhaseUi";
import { resolveCoverSrc } from "@/lib/coverMedia";

/* ══ Panel de postulaciones del client dueño ══════════════════════════════
   Dos modos: selección de Terna (fase "applicationsClosed", checkboxes hasta
   shortlistSize + confirmación irreversible vía Dialog → selectShortlist) o
   lectura (cualquier otra fase, con el Tag de estado de cada postulación).
   ══════════════════════════════════════════════════════════════════════ */

function ApplicationRow({
  application,
  right,
}: {
  application: ContestApplicationDetail;
  right: React.ReactNode;
}) {
  const authorName = application.freelancer.name ?? application.freelancer.username ?? "Freelancer";

  return (
    <Column fillWidth gap="12" background="surface" border="neutral-alpha-weak" radius="l" padding="20">
      <Row fillWidth horizontal="between" vertical="start" gap="12" s={{ direction: "column" }}>
        <Row gap="12" minWidth={0} flex={1}>
          <Avatar
            size="m"
            {...(application.freelancer.imageUrl
              ? { src: application.freelancer.imageUrl }
              : { value: authorName[0]?.toUpperCase() ?? "P" })}
          />
          <Column gap="2" minWidth={0} fillWidth>
            {application.freelancer.username ? (
              <SmartLink href={`/${application.freelancer.username}`} unstyled>
                <Text variant="label-strong-m" onBackground="neutral-strong" truncate>
                  {authorName}
                </Text>
              </SmartLink>
            ) : (
              <Text variant="label-strong-m" onBackground="neutral-strong" truncate>
                {authorName}
              </Text>
            )}
            {application.freelancer.headline && (
              <Text variant="body-default-s" onBackground="neutral-weak" truncate>
                {application.freelancer.headline}
              </Text>
            )}
          </Column>
        </Row>
        {right}
      </Row>

      <Text variant="body-default-s" onBackground="neutral-strong" style={{ whiteSpace: "pre-wrap" }}>
        {application.pitch}
      </Text>

      {application.portfolioPieces.length > 0 && (
        <Row gap="8" wrap>
          {application.portfolioPieces.map((piece) =>
            piece.coverUrl ? (
              <Media
                key={piece.id}
                src={resolveCoverSrc(piece.coverUrl)}
                alt={piece.title}
                radius="s"
                style={{ width: 64, height: 44, objectFit: "cover" }}
              />
            ) : (
              <Column
                key={piece.id}
                radius="s"
                background="neutral-alpha-weak"
                style={{ width: 64, height: 44, flexShrink: 0 }}
              />
            ),
          )}
        </Row>
      )}
    </Column>
  );
}

export function ContestOwnerApplicationsPanel({
  contestId,
  phase,
  shortlistSize,
  shortlistFee,
  currency,
  applications,
}: {
  contestId: string;
  phase: ContestPhase;
  shortlistSize: number;
  shortlistFee: number;
  currency: string;
  applications: ContestApplicationDetail[];
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectable = phase === "applicationsClosed";

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((appId) => appId !== id);
      if (current.length >= shortlistSize) return current;
      return [...current, id];
    });
  };

  const handleConfirm = async () => {
    setConfirming(true);
    const result = await selectShortlist(contestId, selectedIds);
    setConfirming(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Terna confirmada." });
    setConfirmOpen(false);
    router.refresh();
  };

  if (applications.length === 0) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Todavía no hay postulaciones.
      </Text>
    );
  }

  return (
    <Column fillWidth gap="16">
      <Row fillWidth horizontal="between" vertical="center" wrap gap="12">
        <Text variant="heading-strong-s" onBackground="neutral-strong">
          Postulaciones ({applications.length})
        </Text>
        {selectable && (
          <Row gap="12" vertical="center">
            <Text variant="body-default-s" onBackground="neutral-weak">
              {selectedIds.length} de {shortlistSize} seleccionados
            </Text>
            <Button
              variant="primary"
              size="s"
              onClick={() => setConfirmOpen(true)}
              disabled={selectedIds.length === 0}
            >
              Confirmar Terna
            </Button>
          </Row>
        )}
      </Row>

      {selectable && (
        <Feedback
          variant="info"
          description={`Compromiso total de fee si confirmas ahora: ${formatContestMoney(shortlistFee * selectedIds.length, currency)} (${formatContestMoney(shortlistFee, currency)} por finalista).`}
        />
      )}

      <Column fillWidth gap="12">
        {applications.map((application) => {
          if (selectable && application.status === "SUBMITTED") {
            return (
              <ApplicationRow
                key={application.id}
                application={application}
                right={
                  <Checkbox
                    isChecked={selectedIds.includes(application.id)}
                    onToggle={() => toggle(application.id)}
                    label="Seleccionar para la Terna"
                    disabled={!selectedIds.includes(application.id) && selectedIds.length >= shortlistSize}
                  />
                }
              />
            );
          }
          const status = contestApplicationStatusTag(application.status);
          return (
            <ApplicationRow
              key={application.id}
              application={application}
              right={<Tag size="s" variant={status.variant} label={status.label} />}
            />
          );
        })}
      </Column>

      <Dialog
        isOpen={confirmOpen}
        onClose={() => !confirming && setConfirmOpen(false)}
        title="¿Confirmar la Terna?"
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={() => setConfirmOpen(false)} disabled={confirming}>
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleConfirm} loading={confirming}>
              Sí, confirmar
            </Button>
          </Row>
        }
      >
        <Feedback
          variant="warning"
          description={`Esta acción es irreversible: te comprometes a pagar ${formatContestMoney(shortlistFee * selectedIds.length, currency)} en fees de Terna (${selectedIds.length} finalista${selectedIds.length === 1 ? "" : "s"}), sin importar el fallo final.`}
        />
      </Dialog>
    </Column>
  );
}

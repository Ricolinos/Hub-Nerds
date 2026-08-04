"use client";

import {
  Button,
  Column,
  Dialog,
  Feedback,
  HoverCard,
  Icon,
  Row,
  Tag,
  Text,
  Tooltip,
  useToast,
} from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelContest,
  publishContest,
  type PaymentRequiredResult,
  type QuotaReachedResult,
} from "@/app/actions/contests";
import { createContestPaymentCheckout, refreshContestPayments } from "@/app/actions/contestPayments";
import type {
  ContestManagementData,
  ContestManagementItem,
  ContestManagementPayment,
} from "@/lib/contests";
import { contestPhaseTag, formatContestMoney } from "@/lib/contestPhaseUi";
import { isInKindPrizeType, isPrizeType, PRIZE_FEE_PCT } from "@/lib/prizeResponsibility";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";
import { ContestExtendDialog } from "./ContestExtendDialog";
import { ContestPaymentDialog } from "./ContestPaymentDialog";

const CONTEST_MANAGEMENT_UPSELL_BENEFITS = [
  "Convocatorias activas sin límite",
  "Prórrogas de fecha hasta 2 veces por convocatoria",
  "Publicaciones destacadas en el listado",
];

// Mismo shape/criterio que ContestWizardForm (createContest/publishContest,
// src/app/actions/contests.ts) — se reimplementa aquí en vez de importarlo
// porque el wizard no lo exporta.
function isQuotaReachedResult(result: { ok: false; error: string }): result is QuotaReachedResult {
  return result.error === "QUOTA_REACHED";
}

function formatQuotaDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function quotaReachedMessage(quota: QuotaReachedResult): string {
  if (quota.reason === "simultaneous") {
    return "Ya tienes el máximo de convocatorias activas de tu plan. Cierra o cancela una para publicar otra.";
  }
  const formattedDate = formatQuotaDate(quota.nextAvailableAt);
  return formattedDate
    ? `Alcanzaste el límite de convocatorias publicadas en los últimos 3 meses. Podrás publicar de nuevo el ${formattedDate}.`
    : "Alcanzaste el límite de convocatorias publicadas en los últimos 3 meses.";
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Mismo gotcha de discriminated union que isQuotaReachedResult: el miembro
// genérico `{ ok: false; error: string }` del retorno de publishContest
// widen-ea "PAYMENT_REQUIRED" a string, así que TS no estrecha sin este guard.
function isPaymentRequiredResult(result: { ok: false; error: string }): result is PaymentRequiredResult {
  return result.error === "PAYMENT_REQUIRED";
}

const CLOSED_STATUSES = new Set(["AWARDED", "CANCELLED", "BREACHED"]);
const EXTENDABLE_STATUSES = new Set(["PUBLISHED", "SHORTLIST"]);

/* ══ Chip de estado de pago (Fase 3, Términos §3.3-§3.5) ══════════════════
   payments llega vacío hasta que el client intenta publicar por primera vez
   (createContestPaymentCheckout recién crea el ContestPayment PENDING), así
   que sin registros no se muestra nada. IN_KIND_FEE / PRIZE_FULL solo tienen
   un pago; MONETARY+Pro encadena PRIZE_SPLIT_1 (gate de publicar) y
   PRIZE_SPLIT_2 (nace al publicar, vence submitDeadline − 10 días). ═══════ */
interface PaymentChip {
  label: string;
  variant: "success" | "warning" | "danger";
  showPayNow: boolean;
}

function paymentChipFor(
  payments: ContestManagementPayment[],
  prizeType: string,
  now: Date = new Date(),
): PaymentChip | null {
  if (payments.length === 0) return null;
  const byKind = new Map(payments.map((payment) => [payment.kind, payment]));

  if (isPrizeType(prizeType) && isInKindPrizeType(prizeType)) {
    const fee = byKind.get("IN_KIND_FEE");
    if (!fee) return null;
    return fee.status === "PAID"
      ? { label: "Fee pagado", variant: "success", showPayNow: false }
      : { label: "Fee pendiente", variant: "warning", showPayNow: false };
  }

  const full = byKind.get("PRIZE_FULL");
  if (full) {
    return full.status === "PAID"
      ? { label: "Premio pagado", variant: "success", showPayNow: false }
      : { label: "Pago pendiente", variant: "warning", showPayNow: false };
  }

  const split1 = byKind.get("PRIZE_SPLIT_1");
  if (!split1) return null;
  const split2 = byKind.get("PRIZE_SPLIT_2");
  if (!split2) {
    return split1.status === "PAID"
      ? { label: "Primer pago pagado", variant: "success", showPayNow: false }
      : { label: "Primer pago pendiente", variant: "warning", showPayNow: false };
  }

  if (split2.status === "PAID") return { label: "Premio pagado", variant: "success", showPayNow: false };

  const dueLabel = split2.dueAt ? formatQuotaDate(split2.dueAt) : null;
  const overdue = split2.dueAt ? new Date(split2.dueAt).getTime() < now.getTime() : false;
  if (overdue) {
    return {
      label: dueLabel ? `50% vencido · venció ${dueLabel}` : "50% vencido",
      variant: "danger",
      showPayNow: true,
    };
  }
  return {
    label: dueLabel ? `50% pendiente · vence ${dueLabel}` : "50% pendiente",
    variant: "warning",
    showPayNow: true,
  };
}

/* ══ Panel de gestión del client (cupo + acciones por convocatoria) ═══════
   Mínima info visible con detalle en tooltip (preferencia de Ricardo): una
   Card/fila por convocatoria, nunca una tabla densa. Reusa el patrón
   PRO_REQUIRED/QUOTA_REACHED de ContestWizardForm para publishContest, y el
   patrón Dialog de confirmación de ContestOwnerApplicationsPanel para
   cancelContest. ══════════════════════════════════════════════════════ */

export function ContestManagementPanel({ data }: { data: ContestManagementData }) {
  const router = useRouter();
  const { addToast } = useToast();

  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ContestManagementItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [extendTarget, setExtendTarget] = useState<ContestManagementItem | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [quotaReached, setQuotaReached] = useState<QuotaReachedResult | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<{
    contestId: string;
    kind: PaymentRequiredResult["kind"];
    amountMXN: number;
    feePct: number | null;
  } | null>(null);
  const [payingSplit2Id, setPayingSplit2Id] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [paymentCancelledNotice, setPaymentCancelledNotice] = useState(false);
  const [, startPaySplit2] = useTransition();

  // El cancel_url de Stripe (createContestPaymentCheckout,
  // src/app/actions/contestPayments.ts) manda aquí con ?pago=cancelado. Se
  // lee de window.location y no con useSearchParams (obliga a un Suspense
  // boundary — mismo gotcha documentado en TourHost.tsx) y se limpia de la
  // barra para que recargar no reabra el aviso.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pago") !== "cancelado") return;
    setPaymentCancelledNotice(true);
    params.delete("pago");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  const { quota, contests } = data;

  const handlePublish = async (contest: ContestManagementItem) => {
    setPublishingId(contest.id);
    const result = await publishContest(contest.id);
    setPublishingId(null);
    if (!result.ok) {
      if (result.error === "PRO_REQUIRED") {
        setUpsellOpen(true);
        return;
      }
      if (isQuotaReachedResult(result)) {
        setQuotaReached(result);
        return;
      }
      if (isPaymentRequiredResult(result)) {
        const feePct =
          isPrizeType(contest.prizeType) && isInKindPrizeType(contest.prizeType)
            ? PRIZE_FEE_PCT[contest.prizeType]
            : null;
        setPaymentDialog({ contestId: contest.id, kind: result.kind, amountMXN: result.amountMXN, feePct });
        return;
      }
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Convocatoria publicada." });
    router.refresh();
  };

  const handlePaySplit2 = (contest: ContestManagementItem) => {
    setPayingSplit2Id(contest.id);
    startPaySplit2(async () => {
      try {
        await createContestPaymentCheckout(contest.id, "PRIZE_SPLIT_2");
      } catch (err) {
        setPayingSplit2Id(null);
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        addToast({
          variant: "danger",
          message: err instanceof Error ? err.message : "No se pudo iniciar el pago. Intenta de nuevo.",
        });
      }
    });
  };

  const handleRefreshPayments = async (contest: ContestManagementItem) => {
    setRefreshingId(contest.id);
    const result = await refreshContestPayments(contest.id);
    setRefreshingId(null);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    router.refresh();
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const result = await cancelContest(cancelTarget.id);
    setCancelling(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({
      variant: "success",
      message: cancelTarget.status === "DRAFT" ? "Borrador eliminado." : "Convocatoria cancelada.",
    });
    setCancelTarget(null);
    router.refresh();
  };

  return (
    <Column fillWidth gap="24">
      {paymentCancelledNotice && (
        <Feedback
          variant="warning"
          fillWidth
          showCloseButton
          onClose={() => setPaymentCancelledNotice(false)}
          description="Pago cancelado. Puedes reintentarlo al publicar."
        />
      )}

      <Column fillWidth background="surface" border="neutral-alpha-weak" radius="l" padding="24" gap="12">
        <Row fillWidth horizontal="between" vertical="center" wrap gap="12">
          <Column gap="4">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Cupo de convocatorias
            </Text>
            <Text variant="heading-strong-s" onBackground="neutral-strong">
              Convocatorias activas: {quota.activePublished} de {quota.simultaneousLimit}
            </Text>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Publicadas este trimestre: {quota.publishedLast90} de {quota.quarterlyLimit}
              {quota.nextQuarterlySlotAt
                ? ` · próximo cupo el ${formatQuotaDate(quota.nextQuarterlySlotAt)}`
                : ""}
            </Text>
          </Column>
          {quota.plan === "free" && (
            <Button variant="tertiary" size="s" href="/pro" arrowIcon>
              Duplica tu cupo con Client Pro
            </Button>
          )}
        </Row>
      </Column>

      {contests.length === 0 ? (
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="40"
          gap="16"
          horizontal="center"
          align="center"
        >
          <Text variant="body-default-m" onBackground="neutral-weak">
            Todavía no has creado ninguna convocatoria.
          </Text>
          <Button variant="primary" size="m" prefixIcon="plus" href="/convocatorias/nueva">
            Nueva convocatoria
          </Button>
        </Column>
      ) : (
        <Column fillWidth gap="12">
          {contests.map((contest) => {
            const phase = contestPhaseTag(contest.phase);
            const isDraft = contest.status === "DRAFT";
            const isExtendable = EXTENDABLE_STATUSES.has(contest.status);
            const isInKindPrize = isPrizeType(contest.prizeType) && isInKindPrizeType(contest.prizeType);
            const paymentChip = paymentChipFor(contest.payments, contest.prizeType);

            return (
              <Column
                key={contest.id}
                fillWidth
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
                padding="20"
                gap="12"
              >
                <Row fillWidth horizontal="between" vertical="start" gap="12" wrap>
                  <Column gap="4" minWidth={0} flex={1}>
                    <Row gap="8" vertical="center" wrap>
                      <Text variant="label-strong-m" onBackground="neutral-strong" truncate>
                        {contest.title}
                      </Text>
                      <Tag size="s" variant={phase.variant} label={phase.label} />
                      {contest.stagesCount > 0 && (
                        <HoverCard
                          trigger={
                            <Tag
                              size="s"
                              variant="neutral"
                              label={
                                contest.stagesCount === 1 ? "1 etapa" : `${contest.stagesCount} etapas`
                              }
                            />
                          }
                          placement="top"
                          fade={0}
                          scale={0.95}
                          duration={150}
                        >
                          <Tooltip label="Etapas del timeline configuradas para esta convocatoria" />
                        </HoverCard>
                      )}
                      {isInKindPrize && (
                        <HoverCard
                          trigger={
                            <Icon
                              name={contest.responsibilityAccepted ? "check" : "warning"}
                              size="xs"
                              onBackground={contest.responsibilityAccepted ? "success-medium" : "warning-medium"}
                            />
                          }
                          placement="top"
                          fade={0}
                          scale={0.95}
                          duration={150}
                        >
                          <Tooltip
                            label={contest.responsibilityAccepted ? "Carta firmada" : "Carta pendiente"}
                          />
                        </HoverCard>
                      )}
                    </Row>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      {formatContestMoney(contest.prizeAmount, contest.currency)}
                    </Text>
                  </Column>

                  <HoverCard
                    trigger={
                      <Text variant="body-default-s" onBackground="neutral-weak" style={{ cursor: "default" }}>
                        {contest.applicationsCount === 1
                          ? "1 postulante"
                          : `${contest.applicationsCount} postulantes`}
                      </Text>
                    }
                    placement="top"
                    fade={0}
                    scale={0.95}
                    duration={150}
                  >
                    <Tooltip
                      label={
                        contest.entriesCount === 1
                          ? "1 entrega recibida"
                          : `${contest.entriesCount} entregas recibidas`
                      }
                    />
                  </HoverCard>
                </Row>

                <Row fillWidth gap="16" wrap>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Postulación: {formatShortDate(contest.applyDeadline)}
                  </Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Entrega: {formatShortDate(contest.submitDeadline)}
                  </Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Resultados: {formatShortDate(contest.resultsDate)}
                  </Text>
                  {contest.extensionsCount > 0 && (
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Prórrogas: {contest.extensionsCount}/2
                    </Text>
                  )}
                </Row>

                {paymentChip && (
                  <Row gap="8" vertical="center" wrap>
                    <Tag size="s" variant={paymentChip.variant} label={paymentChip.label} />
                    {paymentChip.showPayNow && (
                      <Button
                        variant="secondary"
                        size="s"
                        onClick={() => handlePaySplit2(contest)}
                        loading={payingSplit2Id === contest.id}
                      >
                        Pagar ahora
                      </Button>
                    )}
                    {paymentChip.variant !== "success" && (
                      <Button
                        variant="tertiary"
                        size="s"
                        onClick={() => handleRefreshPayments(contest)}
                        loading={refreshingId === contest.id}
                      >
                        Actualizar estado de pago
                      </Button>
                    )}
                  </Row>
                )}

                <Row fillWidth gap="8" wrap horizontal="end">
                  <Button variant="secondary" size="s" href={`/convocatorias/${contest.slug}`}>
                    Ver
                  </Button>
                  {isDraft && (
                    <>
                      <Button variant="secondary" size="s" href={`/convocatorias/${contest.slug}/editar`}>
                        Editar
                      </Button>
                      <Button
                        variant="primary"
                        size="s"
                        onClick={() => handlePublish(contest)}
                        loading={publishingId === contest.id}
                      >
                        Publicar
                      </Button>
                      <Button variant="tertiary" size="s" onClick={() => setCancelTarget(contest)}>
                        Eliminar
                      </Button>
                    </>
                  )}
                  {isExtendable && (
                    <>
                      <Button variant="secondary" size="s" onClick={() => setExtendTarget(contest)}>
                        Prorrogar
                      </Button>
                      {contest.status === "PUBLISHED" && (
                        <Button variant="tertiary" size="s" onClick={() => setCancelTarget(contest)}>
                          Cancelar
                        </Button>
                      )}
                    </>
                  )}
                </Row>
              </Column>
            );
          })}
        </Column>
      )}

      <ProUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        title="Publica sin límite"
        message="Publica convocatorias ilimitadas y prorroga sus fechas con Client Pro"
        benefits={CONTEST_MANAGEMENT_UPSELL_BENEFITS}
      />

      <Dialog
        isOpen={quotaReached !== null}
        onClose={() => setQuotaReached(null)}
        title="Límite de convocatorias alcanzado"
        maxWidth={24}
        footer={
          <Row fillWidth horizontal="end">
            <Button variant="primary" size="m" onClick={() => setQuotaReached(null)}>
              Entendido
            </Button>
          </Row>
        }
      >
        <Text variant="body-default-m" onBackground="neutral-weak">
          {quotaReached ? quotaReachedMessage(quotaReached) : ""}
        </Text>
      </Dialog>

      <Dialog
        isOpen={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title={cancelTarget?.status === "DRAFT" ? "¿Eliminar este borrador?" : "¿Cancelar esta convocatoria?"}
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={() => setCancelTarget(null)} disabled={cancelling}>
              Volver
            </Button>
            <Button variant="danger" size="m" onClick={handleCancel} loading={cancelling}>
              {cancelTarget?.status === "DRAFT" ? "Eliminar" : "Sí, cancelar"}
            </Button>
          </Row>
        }
      >
        <Feedback
          variant="warning"
          description={
            cancelTarget?.status === "DRAFT"
              ? "El borrador se perderá y no podrás recuperarlo."
              : "Se cancelará antes de tener Terna seleccionada. No podrás revertirlo."
          }
        />
      </Dialog>

      {paymentDialog && (
        <ContestPaymentDialog
          isOpen={paymentDialog !== null}
          onClose={() => setPaymentDialog(null)}
          contestId={paymentDialog.contestId}
          kind={paymentDialog.kind}
          amountMXN={paymentDialog.amountMXN}
          feePct={paymentDialog.feePct}
        />
      )}

      {extendTarget && (
        <ContestExtendDialog
          contest={extendTarget}
          isOpen={extendTarget !== null}
          onClose={() => setExtendTarget(null)}
          onExtended={() => {
            setExtendTarget(null);
            addToast({ variant: "success", message: "Fechas prorrogadas." });
            router.refresh();
          }}
        />
      )}
    </Column>
  );
}

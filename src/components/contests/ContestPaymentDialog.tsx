"use client";

import { Button, Dialog, Feedback, Row, Text, useToast } from "@once-ui-system/core";
import { useTransition } from "react";
import { createContestPaymentCheckout } from "@/app/actions/contestPayments";
import type { ContestPaymentKind } from "@/lib/contests";
import { formatContestMoney } from "@/lib/contestPhaseUi";

/* ══ Gate de pago antes de publicar (Fase 3, Términos §3.3-§3.5) ══════════
   Reutilizado por ContestWizardForm y ContestManagementPanel: ambos llaman
   publishContest, y ambos reciben el mismo PaymentRequiredResult
   ({ kind, amountMXN }, src/app/actions/contests.ts) cuando el pago del gate
   todavía no está PAID. El mensaje depende solo de `kind`; IN_KIND_FEE
   además necesita el % de fee (8 o 12, según prizeType — PRIZE_FEE_PCT en
   src/lib/prizeResponsibility.ts) que el caller ya conoce.

   Redirect: mismo patrón que ProPricing (src/components/pro/ProPricing.tsx)
   — createContestPaymentCheckout("use server") navega el propio navegador
   vía el throw NEXT_REDIRECT de Next; solo un error real cae en el catch. */

function paymentMessage(kind: ContestPaymentKind, amount: string, feePct?: number | null): string {
  switch (kind) {
    case "PRIZE_FULL":
      return `Tu plan Free requiere cubrir el premio completo por adelantado: ${amount} (custodia Hub-Nerds).`;
    case "PRIZE_SPLIT_1":
      return `Primer pago del premio (50%): ${amount}. El 50% restante se liquida a más tardar 10 días antes del cierre.`;
    case "PRIZE_SPLIT_2":
      return `Segundo pago del premio (50% restante): ${amount}.`;
    case "IN_KIND_FEE":
      return `Tarifa de premio en especie (${feePct ?? "?"}%): ${amount}.`;
    default:
      return `Pago requerido: ${amount}.`;
  }
}

export function ContestPaymentDialog({
  isOpen,
  onClose,
  contestId,
  kind,
  amountMXN,
  feePct,
}: {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
  kind: ContestPaymentKind;
  amountMXN: number;
  feePct?: number | null;
}) {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();

  const amount = `${formatContestMoney(amountMXN)} MXN`;

  const handlePay = () => {
    startTransition(async () => {
      try {
        await createContestPaymentCheckout(contestId, kind);
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        addToast({
          variant: "danger",
          message: err instanceof Error ? err.message : "No se pudo iniciar el pago. Intenta de nuevo.",
        });
      }
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => !isPending && onClose()}
      title="Pago requerido para publicar"
      closeOnClickaway={!isPending}
      maxWidth={28}
      footer={
        <Row fillWidth gap="8" horizontal="end" wrap>
          <Button variant="secondary" size="m" onClick={onClose} disabled={isPending}>
            Ahora no
          </Button>
          <Button variant="primary" size="m" onClick={handlePay} loading={isPending}>
            Pagar {amount}
          </Button>
        </Row>
      }
    >
      <Text variant="body-default-m" onBackground="neutral-weak" style={{ overflowWrap: "break-word" }}>
        {paymentMessage(kind, amount, feePct)}
      </Text>
      <Feedback
        variant="info"
        marginTop="16"
        description="Serás redirigido a Stripe para completar el pago de forma segura."
      />
    </Dialog>
  );
}

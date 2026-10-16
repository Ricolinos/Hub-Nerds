"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/app/actions/billing";
import { isPro } from "@/lib/plan";
import {
  contestPaymentAmountForKind,
  reconcileContestPayments,
  type ContestPaymentKind,
  type ContestPaymentStatus,
} from "@/lib/contests";

/* ══ Pagos de convocatorias (Fase 3, Términos §3.3-§3.5) ══════════════════
   Mismo patrón que src/app/actions/billing.ts: auth de Clerk, Stripe
   Checkout (mode "payment", no "subscription"), redirect(session.url) en
   éxito. La lógica pura (montos por kind, reconciliación) vive en
   src/lib/contests.ts para poder reutilizarla desde publishContest
   (src/app/actions/contests.ts) sin import circular. ══════════════════════ */

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// Nombre descriptivo del line_item de Checkout, mostrado al client en el
// hosted checkout de Stripe.
function buildProductName(
  kind: ContestPaymentKind,
  title: string,
  prizeFeePct: number | null,
): string {
  switch (kind) {
    case "PRIZE_FULL":
      return `Premio de «${title}» — pago único (100%)`;
    case "PRIZE_SPLIT_1":
      return `Premio de «${title}» — pago 1 de 2 (50%)`;
    case "PRIZE_SPLIT_2":
      return `Premio de «${title}» — pago 2 de 2 (50%)`;
    case "IN_KIND_FEE":
      return `Tarifa de premio en especie (${prizeFeePct ?? "?"}%) — «${title}»`;
    default:
      return `Pago de «${title}»`;
  }
}

// Crea (o reutiliza) el ContestPayment PENDING correspondiente al kind
// solicitado, abre una Stripe Checkout Session (mode "payment") y redirige
// al hosted checkout. Válido tanto para el gate de publicación (PRIZE_FULL /
// PRIZE_SPLIT_1 / IN_KIND_FEE, mientras la convocatoria sigue DRAFT) como
// para el segundo pago del split Pro (PRIZE_SPLIT_2, ya PUBLISHED/SHORTLIST,
// creado por publishContest al publicar).
export async function createContestPaymentCheckout(
  contestId: string,
  kind: ContestPaymentKind,
): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, plan: true, planStatus: true, stripeCustomerId: true },
  });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede pagar una convocatoria." };
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      id: true,
      clientId: true,
      slug: true,
      title: true,
      status: true,
      prizeType: true,
      prizeAmount: true,
      prizeFeePct: true,
      currency: true,
    },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };

  const plan: "free" | "pro" = isPro(user) ? "pro" : "free";
  const prizeAmount = Number(contest.prizeAmount);

  if (kind === "PRIZE_SPLIT_2") {
    if (contest.status !== "PUBLISHED" && contest.status !== "SHORTLIST") {
      return { ok: false, error: "El segundo pago solo aplica a una convocatoria ya publicada." };
    }
    const splitOne = await prisma.contestPayment.findUnique({
      where: { contestId_kind: { contestId, kind: "PRIZE_SPLIT_1" } },
    });
    if (!splitOne || splitOne.status !== "PAID") {
      return { ok: false, error: "Primero debes completar el primer pago (50%)." };
    }
  } else if (contest.status !== "DRAFT") {
    return { ok: false, error: "Este pago solo aplica mientras la convocatoria sigue en borrador." };
  }

  const amount = contestPaymentAmountForKind(kind, plan, contest.prizeType, prizeAmount);
  if (amount === null) {
    return { ok: false, error: "Este pago no corresponde al plan o al tipo de premio de la convocatoria." };
  }

  const existing = await prisma.contestPayment.findUnique({
    where: { contestId_kind: { contestId, kind } },
  });
  if (existing?.status === "PAID") {
    return { ok: false, error: "Este pago ya fue realizado." };
  }

  const payment = await prisma.contestPayment.upsert({
    where: { contestId_kind: { contestId, kind } },
    update: { amount, currency: "MXN" },
    create: { contestId, kind, amount, currency: "MXN", status: "PENDING" },
    select: { id: true },
  });

  const customerId = await ensureStripeCustomer(user);
  const productName = buildProductName(kind, contest.title, contest.prizeFeePct);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(amount * 100),
          product_data: { name: productName },
        },
        quantity: 1,
      },
    ],
    metadata: { type: "contest_payment", contestPaymentId: payment.id, contestId, kind },
    success_url: `${APP_URL}/convocatorias/${contest.slug}?pago=exito&kind=${kind}`,
    cancel_url: `${APP_URL}/convocatorias/gestion?pago=cancelado`,
  });

  if (!session.url) return { ok: false, error: "Stripe no devolvió una URL de checkout." };

  await prisma.contestPayment.update({
    where: { id: payment.id },
    data: { stripeSessionId: session.id },
  });

  revalidatePath("/convocatorias/gestion");
  redirect(session.url);
}

export interface ContestPaymentStatusItem {
  kind: ContestPaymentKind;
  status: ContestPaymentStatus;
  amount: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
}

// Reconciliación PULL guardada por auth (para UI: botón "Actualizar estado"
// del panel de gestión). La reconciliación en sí (llamar a Stripe) vive en
// src/lib/contests.ts (reconcileContestPayments), compartida con el gate de
// publishContest.
export async function refreshContestPayments(
  contestId: string,
): Promise<Result<{ payments: ContestPaymentStatusItem[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { clientId: true },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };

  await reconcileContestPayments(contestId);

  const payments = await prisma.contestPayment.findMany({ where: { contestId } });

  revalidatePath("/convocatorias/gestion");

  return {
    ok: true,
    payments: payments.map((payment) => ({
      kind: payment.kind as ContestPaymentKind,
      status: payment.status as ContestPaymentStatus,
      amount: Number(payment.amount),
      currency: payment.currency,
      dueAt: payment.dueAt ? payment.dueAt.toISOString() : null,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    })),
  };
}

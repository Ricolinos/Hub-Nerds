"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NotificationType, Prisma, type ContestApplicationStatus, type ContestStatus } from "@/generated/prisma/client";
import { slugifyTitle } from "@/lib/caseStudies";
import {
  ACTIVE_PUBLISHED_STATUSES,
  canApplyToContest,
  deriveContestPhase,
  FREE_PUBLISH_LIMIT,
  NINETY_DAYS_MS,
  PRO_PUBLISH_LIMIT,
  reconcileContestPayments,
  requiredPublishPayment,
  splitPrizeAmounts,
  type ContestPaymentKind,
} from "@/lib/contests";
import { prisma } from "@/lib/prisma";
import { isValidProjectSubtype, isValidProjectType } from "@/lib/projectTypes";
import { isPro } from "@/lib/plan";
import {
  isInKindPrizeType,
  isPrizeType,
  PRIZE_DESCRIPTION_MAX_LENGTH,
  PRIZE_FEE_PCT,
  RESPONSIBILITY_VERSION,
  type PrizeType,
} from "@/lib/prizeResponsibility";

/* ══ Brief-hub: convocatorias (concursos creativos) — server actions ══════
   ══ Mismo patrón que src/app/actions/collab.ts: auth de Clerk, valida-  ══
   ══ ción de rol client/collaborator, ownership por clientId/freelancerId, ══
   ══ y revalidatePath. Fase 1: la ruta UI (/convocatorias) aún no existe,══
   ══ revalidatePath es un no-op inofensivo hasta que se construya.      ══ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Error de validación de negocio, usado para abortar limpio dentro de
// transacciones interactivas (prisma.$transaction con callback) sin
// propagar un error genérico de Prisma al caller.
class ContestActionError extends Error {}

/* ══ Límite free en Brief-hub ═══════════════════════════════════════════
   Un usuario sin plan Pro (isPro(), src/lib/plan.ts) solo puede tener UNA
   convocatoria/postulación "activa" a la vez; a partir de la segunda debe
   ver el upsell a Pro. El shape del error respeta la convención existente
   de esta action (ok:false + error string), pero fija error:"PRO_REQUIRED"
   + feature para que el consumidor (UI) distinga este caso de un error de
   validación genérico y muestre el upsell correcto. ══════════════════════ */

type ProRequiredResult = { ok: false; error: "PRO_REQUIRED"; feature: "convocatorias" };

const PRO_REQUIRED_RESULT: ProRequiredResult = {
  ok: false,
  error: "PRO_REQUIRED",
  feature: "convocatorias",
};

/* ══ Carta de responsabilidad del premio en especie (publishContest) ═══════
   Distinta de PRO_REQUIRED (premio en especie sin plan Pro): esta se
   devuelve cuando el client Pro sí eligió una modalidad de premio en
   especie pero todavía no aceptó la carta (acceptPrizeResponsibility) para
   esa convocatoria. Ver src/lib/prizeResponsibility.ts. ═══════════════════ */

export type ResponsibilityRequiredResult = { ok: false; error: "RESPONSIBILITY_REQUIRED" };

const RESPONSIBILITY_REQUIRED_RESULT: ResponsibilityRequiredResult = {
  ok: false,
  error: "RESPONSIBILITY_REQUIRED",
};

/* ══ Pago requerido antes de publicar (Fase 3, Términos §3.3-§3.5) ═════════
   Distinta de RESPONSIBILITY_REQUIRED (falta aceptar la carta) y de
   PRO_REQUIRED (falta plan Pro): esta se devuelve cuando el pago del gate
   (PRIZE_FULL | PRIZE_SPLIT_1 | IN_KIND_FEE, ver requiredPublishPayment en
   src/lib/contests.ts) todavía no está PAID. amountMXN ya viene redondeado a
   centavos, listo para mostrar en la UI. ═══════════════════════════════════ */

export type PaymentRequiredResult = {
  ok: false;
  error: "PAYMENT_REQUIRED";
  kind: ContestPaymentKind;
  amountMXN: number;
};

// Error dedicado (distinto de ContestActionError) para poder distinguirlo en
// el catch de applyToContest sin pisar el mensaje con el genérico en español.
class ProRequiredError extends Error {}

/* ══ Cupos de convocatorias PUBLICADAS por plan (publishContest/createContest) ═
   Distinto del gate PRO_REQUIRED de arriba (free sin ninguna Pro todavía):
   una vez que el client ya tiene Pro, sigue habiendo un tope — el doble del
   free — tanto de convocatorias activas simultáneas como de convocatorias
   publicadas en una ventana móvil de 90 días (~4/año free, ~8/año pro). Se
   exporta para que la UI (ContestWizardForm) distinga este caso del upsell a
   Pro y muestre "espera a que se libere/cierre un cupo" en vez de "hazte Pro".
   ══════════════════════════════════════════════════════════════════════ */

export type QuotaReachedResult = {
  ok: false;
  error: "QUOTA_REACHED";
  feature: "convocatorias";
  reason: "simultaneous" | "quarterly";
  nextAvailableAt: string | null;
};

// NINETY_DAYS_MS, FREE_PUBLISH_LIMIT, PRO_PUBLISH_LIMIT y
// ACTIVE_PUBLISHED_STATUSES viven en src/lib/contests.ts (esta fuente no
// puede exportar consts al llevar "use server"), también consumidos por
// getMyContestsManagement para el mismo cálculo de cupo.

// Contest.status que ya no cuenta contra el límite free (convocatoria
// terminada, de un lado o del otro). Prisma espera `string[]` mutable (no
// una tupla readonly) para `notIn`, mismo gotcha que FREELANCER_ROLE_VALUES
// en src/lib/roles.ts.
const CLOSED_CONTEST_STATUSES: ContestStatus[] = ["AWARDED", "CANCELLED", "BREACHED"];
// ContestApplication.status que ya no cuenta como postulación "activa".
const INACTIVE_APPLICATION_STATUSES: ContestApplicationStatus[] = ["REJECTED", "WITHDRAWN"];

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

function isEmptyJsonValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

// Slugifica el título (mismo helper que PortfolioPiece, src/lib/caseStudies.ts)
// y agrega un sufijo numérico hasta encontrar un slug libre.
async function generateUniqueContestSlug(title: string): Promise<string> {
  const base = slugifyTitle(title) || "convocatoria";
  let candidate = base;
  let suffix = 2;
  // eslint-disable-next-line no-await-in-loop -- secuencial por diseño: cada intento depende del anterior
  while (await prisma.contest.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/* ══ Gestión del client ══════════════════════════════════════════════ */

export interface CreateContestInput {
  title: string;
  brief?: Prisma.InputJsonValue;
  terms?: Prisma.InputJsonValue;
  projectType?: string | null;
  projectSubtype?: string | null;
  prizeAmount: number;
  currency?: string;
  shortlistFee: number;
  // Retrocompatible: default "MONETARY" si no se envía (ver
  // src/lib/prizeResponsibility.ts). Premio en especie exige plan Pro.
  prizeType?: string;
  prizeDescription?: string | null;
  maxApplicants?: number | null;
  shortlistSize?: number;
  applyDeadline: string;
  submitDeadline: string;
  resultsDate: string;
  rightsPolicy?: string | null;
}

// Solo un client crea convocatorias; nace en DRAFT con un slug único
// derivado del título (mismo slugifyTitle que PortfolioPiece).
export async function createContest(
  input: CreateContestInput,
): Promise<Result<{ contestId: string; slug: string }> | ProRequiredResult | QuotaReachedResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planStatus: true },
  });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede crear convocatorias." };
  }

  const userIsPro = isPro(user);
  const activeContestCount = await prisma.contest.count({
    where: { clientId: userId, status: { notIn: CLOSED_CONTEST_STATUSES } },
  });
  if (!userIsPro) {
    if (activeContestCount > 0) return PRO_REQUIRED_RESULT;
  } else if (activeContestCount >= 2) {
    // Pro también tiene tope: evita que acumule borradores/activas por
    // encima de su cupo de publicación (2 simultáneas). No hay "quarterly"
    // aquí porque crear un DRAFT todavía no consume la ventana de 90 días.
    return { ok: false, error: "QUOTA_REACHED", feature: "convocatorias", reason: "simultaneous", nextAvailableAt: null };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: "El título es obligatorio." };

  if (input.projectType != null && !isValidProjectType(input.projectType)) {
    return { ok: false, error: "Tipo de proyecto inválido." };
  }
  if (input.projectSubtype != null) {
    if (!input.projectType || !isValidProjectSubtype(input.projectType, input.projectSubtype)) {
      return { ok: false, error: "El subtipo no pertenece al tipo de proyecto seleccionado." };
    }
  }

  let prizeType: PrizeType = "MONETARY";
  if (input.prizeType !== undefined) {
    if (!isPrizeType(input.prizeType)) return { ok: false, error: "Tipo de premio inválido." };
    prizeType = input.prizeType;
  }
  let prizeDescription: string | null = null;
  let prizeFeePct: number | null = null;
  if (isInKindPrizeType(prizeType)) {
    if (!userIsPro) return PRO_REQUIRED_RESULT;
    const description = input.prizeDescription?.trim() ?? "";
    if (!description) return { ok: false, error: "Describe el premio en especie." };
    if (description.length > PRIZE_DESCRIPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `La descripción del premio no puede exceder ${PRIZE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      };
    }
    prizeDescription = description;
    prizeFeePct = PRIZE_FEE_PCT[prizeType];
  }

  const applyDeadline = new Date(input.applyDeadline);
  const submitDeadline = new Date(input.submitDeadline);
  const resultsDate = new Date(input.resultsDate);
  if ([applyDeadline, submitDeadline, resultsDate].some((date) => Number.isNaN(date.getTime()))) {
    return { ok: false, error: "Alguna de las fechas no es válida." };
  }

  if (input.prizeAmount <= 0) return { ok: false, error: "El premio debe ser mayor a cero." };
  if (input.shortlistFee <= 0) return { ok: false, error: "El fee de Terna debe ser mayor a cero." };

  const slug = await generateUniqueContestSlug(title);

  const contest = await prisma.contest.create({
    data: {
      slug,
      title,
      brief: input.brief ?? Prisma.JsonNull,
      terms: input.terms ?? Prisma.JsonNull,
      projectType: input.projectType ?? null,
      projectSubtype: input.projectSubtype ?? null,
      prizeAmount: input.prizeAmount,
      currency: input.currency?.trim() || undefined,
      shortlistFee: input.shortlistFee,
      prizeType,
      prizeDescription,
      prizeFeePct,
      maxApplicants: input.maxApplicants ?? null,
      shortlistSize: input.shortlistSize ?? undefined,
      applyDeadline,
      submitDeadline,
      resultsDate,
      rightsPolicy: input.rightsPolicy?.trim() || null,
      status: "DRAFT",
      clientId: userId,
    },
    select: { id: true, slug: true },
  });

  revalidatePath("/convocatorias");
  revalidatePath("/dashboard/client");
  return { ok: true, contestId: contest.id, slug: contest.slug };
}

export interface UpdateContestInput {
  title?: string;
  brief?: Prisma.InputJsonValue | null;
  terms?: Prisma.InputJsonValue | null;
  projectType?: string | null;
  projectSubtype?: string | null;
  prizeAmount?: number;
  currency?: string;
  shortlistFee?: number;
  prizeType?: string;
  prizeDescription?: string | null;
  maxApplicants?: number | null;
  shortlistSize?: number;
  applyDeadline?: string;
  submitDeadline?: string;
  resultsDate?: string;
  rightsPolicy?: string | null;
}

// Solo el client dueño, y solo mientras la convocatoria siga en DRAFT
// (una vez PUBLISHED, applyToContest ya pudo haberse llamado con estos datos).
export async function updateContest(
  contestId: string,
  data: UpdateContestInput,
): Promise<Result | ProRequiredResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: {
      clientId: true,
      status: true,
      projectType: true,
      prizeType: true,
      prizeDescription: true,
    },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "DRAFT") {
    return { ok: false, error: "Solo se puede editar una convocatoria en borrador." };
  }

  // Premio: solo re-validar si el input trae prizeType/prizeDescription;
  // si prizeType CAMBIA, la carta de responsabilidad ya aceptada (si la
  // había) deja de corresponder y se resetea.
  let prizeTypeForUpdate: PrizeType | undefined;
  let prizeDescriptionForUpdate: string | null | undefined;
  let prizeFeePctForUpdate: number | null | undefined;
  let resetResponsibility = false;

  if (data.prizeType !== undefined) {
    if (!isPrizeType(data.prizeType)) return { ok: false, error: "Tipo de premio inválido." };
    prizeTypeForUpdate = data.prizeType;
    if (data.prizeType !== contest.prizeType) resetResponsibility = true;
  }

  const effectivePrizeType: PrizeType = isPrizeType(prizeTypeForUpdate ?? contest.prizeType)
    ? ((prizeTypeForUpdate ?? contest.prizeType) as PrizeType)
    : "MONETARY";

  if (isInKindPrizeType(effectivePrizeType)) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planStatus: true },
    });
    if (!user || !isPro(user)) return PRO_REQUIRED_RESULT;

    const effectiveDescription = (
      data.prizeDescription !== undefined ? data.prizeDescription : contest.prizeDescription
    )?.trim() ?? "";
    if (!effectiveDescription) return { ok: false, error: "Describe el premio en especie." };
    if (effectiveDescription.length > PRIZE_DESCRIPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `La descripción del premio no puede exceder ${PRIZE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      };
    }
    if (data.prizeDescription !== undefined) prizeDescriptionForUpdate = effectiveDescription;
    if (resetResponsibility) prizeFeePctForUpdate = PRIZE_FEE_PCT[effectivePrizeType];
  } else if (resetResponsibility) {
    // Cambió a MONETARY: limpia descripción/fee del premio en especie previo.
    prizeDescriptionForUpdate = null;
    prizeFeePctForUpdate = null;
  }

  if (data.projectType !== undefined && data.projectType !== null && !isValidProjectType(data.projectType)) {
    return { ok: false, error: "Tipo de proyecto inválido." };
  }
  if (data.projectSubtype !== undefined && data.projectSubtype !== null) {
    const effectiveType = data.projectType !== undefined ? data.projectType : contest.projectType;
    if (!effectiveType || !isValidProjectSubtype(effectiveType, data.projectSubtype)) {
      return { ok: false, error: "El subtipo no pertenece al tipo de proyecto seleccionado." };
    }
  }

  let applyDeadline: Date | undefined;
  if (data.applyDeadline !== undefined) {
    applyDeadline = new Date(data.applyDeadline);
    if (Number.isNaN(applyDeadline.getTime())) {
      return { ok: false, error: "La fecha límite de postulación no es válida." };
    }
  }
  let submitDeadline: Date | undefined;
  if (data.submitDeadline !== undefined) {
    submitDeadline = new Date(data.submitDeadline);
    if (Number.isNaN(submitDeadline.getTime())) {
      return { ok: false, error: "La fecha límite de entrega no es válida." };
    }
  }
  let resultsDate: Date | undefined;
  if (data.resultsDate !== undefined) {
    resultsDate = new Date(data.resultsDate);
    if (Number.isNaN(resultsDate.getTime())) {
      return { ok: false, error: "La fecha de resultados no es válida." };
    }
  }

  if (data.prizeAmount !== undefined && data.prizeAmount <= 0) {
    return { ok: false, error: "El premio debe ser mayor a cero." };
  }
  if (data.shortlistFee !== undefined && data.shortlistFee <= 0) {
    return { ok: false, error: "El fee de Terna debe ser mayor a cero." };
  }

  await prisma.contest.update({
    where: { id: contestId },
    data: {
      title: data.title !== undefined ? data.title.trim() || undefined : undefined,
      brief: data.brief !== undefined ? (data.brief === null ? Prisma.JsonNull : data.brief) : undefined,
      terms: data.terms !== undefined ? (data.terms === null ? Prisma.JsonNull : data.terms) : undefined,
      projectType: data.projectType !== undefined ? data.projectType : undefined,
      projectSubtype: data.projectSubtype !== undefined ? data.projectSubtype : undefined,
      prizeAmount: data.prizeAmount !== undefined ? data.prizeAmount : undefined,
      currency: data.currency !== undefined ? data.currency.trim() || undefined : undefined,
      shortlistFee: data.shortlistFee !== undefined ? data.shortlistFee : undefined,
      prizeType: prizeTypeForUpdate,
      prizeDescription: prizeDescriptionForUpdate,
      prizeFeePct: prizeFeePctForUpdate,
      responsibilityAcceptedAt: resetResponsibility ? null : undefined,
      responsibilityVersion: resetResponsibility ? null : undefined,
      maxApplicants: data.maxApplicants !== undefined ? data.maxApplicants : undefined,
      shortlistSize: data.shortlistSize !== undefined ? data.shortlistSize : undefined,
      applyDeadline,
      submitDeadline,
      resultsDate,
      rightsPolicy: data.rightsPolicy !== undefined ? data.rightsPolicy?.trim() || null : undefined,
    },
  });

  revalidatePath("/convocatorias");
  revalidatePath("/dashboard/client");
  return { ok: true };
}

/* ══ Carta de responsabilidad del premio en especie ═════════════════════
   Solo el client dueño, Pro, con la convocatoria en DRAFT y prizeType en
   especie. Estampa responsibilityAcceptedAt/responsibilityVersion; a partir
   de aquí publishContest ya no exige RESPONSIBILITY_REQUIRED (mientras el
   client no vuelva a cambiar de modalidad, ver updateContest). ═══════════ */
export async function acceptPrizeResponsibility(contestId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planStatus: true },
  });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede aceptar la carta de responsabilidad." };
  }
  if (!isPro(user)) return { ok: false, error: "Esta función requiere plan Pro." };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { clientId: true, status: true, prizeType: true, slug: true },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "DRAFT") {
    return { ok: false, error: "Solo se puede aceptar la carta mientras la convocatoria esté en borrador." };
  }
  if (!isPrizeType(contest.prizeType) || !isInKindPrizeType(contest.prizeType)) {
    return { ok: false, error: "Esta convocatoria no tiene premio en especie." };
  }

  await prisma.contest.update({
    where: { id: contestId },
    data: { responsibilityAcceptedAt: new Date(), responsibilityVersion: RESPONSIBILITY_VERSION },
  });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  return { ok: true };
}

// Solo el client dueño. Valida el mínimo viable para abrir postulaciones
// (título, brief, montos, tamaño de Terna, orden y futuro de las fechas).
export async function publishContest(
  contestId: string,
): Promise<Result | ProRequiredResult | QuotaReachedResult | ResponsibilityRequiredResult | PaymentRequiredResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "DRAFT") {
    return { ok: false, error: "Solo se puede publicar una convocatoria en borrador." };
  }

  if (!contest.title.trim()) return { ok: false, error: "El título es obligatorio." };
  if (isEmptyJsonValue(contest.brief)) return { ok: false, error: "El brief no puede estar vacío." };
  if (Number(contest.prizeAmount) <= 0) return { ok: false, error: "El premio debe ser mayor a cero." };
  if (Number(contest.shortlistFee) <= 0) {
    return { ok: false, error: "El fee de Terna debe ser mayor a cero." };
  }
  if (contest.shortlistSize < 3 || contest.shortlistSize > 7) {
    return { ok: false, error: "El tamaño de la Terna debe estar entre 3 y 7 finalistas." };
  }

  const now = new Date();
  if (contest.applyDeadline.getTime() <= now.getTime()) {
    return { ok: false, error: "La fecha límite de postulación debe ser futura." };
  }
  if (
    !(
      contest.applyDeadline.getTime() < contest.submitDeadline.getTime() &&
      contest.submitDeadline.getTime() < contest.resultsDate.getTime()
    )
  ) {
    return {
      ok: false,
      error: "El orden de fechas debe ser: postulación < entrega < resultados.",
    };
  }

  const client = await prisma.user.findUnique({
    where: { id: contest.clientId },
    select: { plan: true, planStatus: true },
  });
  const clientIsPro = client ? isPro(client) : false;

  // Premio en especie (Términos §3.5): defensa en profundidad por si el
  // client degradó a free después de elegir la modalidad, y exige la carta
  // de responsabilidad (acceptPrizeResponsibility) antes de publicar.
  if (isPrizeType(contest.prizeType) && isInKindPrizeType(contest.prizeType)) {
    if (!clientIsPro) return PRO_REQUIRED_RESULT;
    if (!contest.prizeDescription?.trim()) {
      return { ok: false, error: "Describe el premio en especie antes de publicar." };
    }
    if (!contest.responsibilityAcceptedAt) {
      return RESPONSIBILITY_REQUIRED_RESULT;
    }
  }

  const publishLimit = clientIsPro ? PRO_PUBLISH_LIMIT : FREE_PUBLISH_LIMIT;
  const windowStart = new Date(now.getTime() - NINETY_DAYS_MS);

  const [activePublishedCount, publishedLast90Count] = await Promise.all([
    prisma.contest.count({
      where: { clientId: contest.clientId, status: { in: ACTIVE_PUBLISHED_STATUSES } },
    }),
    prisma.contest.count({
      where: { clientId: contest.clientId, publishedAt: { gte: windowStart } },
    }),
  ]);

  if (activePublishedCount >= publishLimit || publishedLast90Count >= publishLimit) {
    if (!clientIsPro) return PRO_REQUIRED_RESULT;

    const reason: "simultaneous" | "quarterly" =
      activePublishedCount >= publishLimit ? "simultaneous" : "quarterly";
    let nextAvailableAt: string | null = null;
    if (reason === "quarterly") {
      const oldestInWindow = await prisma.contest.findFirst({
        where: { clientId: contest.clientId, publishedAt: { gte: windowStart } },
        orderBy: { publishedAt: "asc" },
        select: { publishedAt: true },
      });
      if (oldestInWindow?.publishedAt) {
        nextAvailableAt = new Date(oldestInWindow.publishedAt.getTime() + NINETY_DAYS_MS).toISOString();
      }
    }
    return { ok: false, error: "QUOTA_REACHED", feature: "convocatorias", reason, nextAvailableAt };
  }

  /* ══ Pago requerido antes de publicar (Fase 3, Términos §3.3-§3.5) ═══════
     FREE+MONETARY exige el 100% (PRIZE_FULL), PRO+MONETARY el primer 50%
     (PRIZE_SPLIT_1), PRO+en especie el fee (IN_KIND_FEE). Reconciliación
     PULL antes de leer el estado: sin Stripe CLI local no llegan webhooks,
     así que el pago pudo completarse en Stripe sin que nuestra BD se haya
     enterado todavía. ═══════════════════════════════════════════════════ */
  const requiredPayment = requiredPublishPayment(
    clientIsPro ? "pro" : "free",
    contest.prizeType,
    Number(contest.prizeAmount),
  );
  if (requiredPayment) {
    await reconcileContestPayments(contestId);
    const payment = await prisma.contestPayment.findUnique({
      where: { contestId_kind: { contestId, kind: requiredPayment.kind } },
    });
    if (!payment || payment.status !== "PAID") {
      return { ok: false, error: "PAYMENT_REQUIRED", kind: requiredPayment.kind, amountMXN: requiredPayment.amount };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.contest.update({
      where: { id: contestId },
      data: { status: "PUBLISHED", publishedAt: contest.publishedAt ?? now },
    });

    // PRO+MONETARY: al publicar nace el segundo pago (50% restante), con
    // vencimiento submitDeadline − 10 días naturales (Términos §3.4). Split
    // exacto con splitPrizeAmounts (mismo cómputo que el gate de arriba), así
    // PRIZE_SPLIT_1 + PRIZE_SPLIT_2 siempre reconstruyen prizeAmount.
    if (clientIsPro && contest.prizeType === "MONETARY") {
      const { split2 } = splitPrizeAmounts(Number(contest.prizeAmount));
      const dueAt = new Date(contest.submitDeadline.getTime() - 10 * 24 * 60 * 60 * 1000);
      await tx.contestPayment.upsert({
        where: { contestId_kind: { contestId, kind: "PRIZE_SPLIT_2" } },
        // No pisar un SPLIT_2 preexistente (edge case defensivo; publishContest
        // solo corre una vez por convocatoria DRAFT→PUBLISHED).
        update: {},
        create: {
          contestId,
          kind: "PRIZE_SPLIT_2",
          amount: split2,
          currency: contest.currency,
          status: "PENDING",
          dueAt,
        },
      });
    }
  });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  return { ok: true };
}

// Solo el client dueño, y solo si nadie fue seleccionado como Terna todavía
// (DRAFT o PUBLISHED); una vez en SHORTLIST hay compromisos de fee con los
// finalistas y ya no se puede cancelar.
export async function cancelContest(contestId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { clientId: true, status: true, slug: true },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "DRAFT" && contest.status !== "PUBLISHED") {
    return {
      ok: false,
      error: "Solo se puede cancelar una convocatoria en borrador o publicada sin Terna seleccionada.",
    };
  }

  await prisma.contest.update({ where: { id: contestId }, data: { status: "CANCELLED" } });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  return { ok: true };
}

/* ══ Prórroga de fechas (panel de gestión, solo Pro) ═══════════════════════
   Regla de negocio (coherente con Términos §3.3): solo un client Pro puede
   prorrogar, nunca hacia atrás, máx. 2 veces por convocatoria, y solo
   mientras siga PUBLISHED o SHORTLIST (los borradores se editan por el
   wizard vía updateContest; una cerrada ya no admite cambios). Notifica a
   cada freelancer con postulación activa. ══════════════════════════════ */

export type ExtensionLimitResult = { ok: false; error: "EXTENSION_LIMIT" };

// Contest.status desde los que se puede prorrogar (mismo criterio que
// ACTIVE_PUBLISHED_STATUSES, pero con nombre propio para no acoplar la
// semántica de "cupo simultáneo" con la de "puede prorrogar").
const EXTENDABLE_CONTEST_STATUSES: ContestStatus[] = ["PUBLISHED", "SHORTLIST"];
const MAX_CONTEST_EXTENSIONS = 2;

export interface ExtendContestDeadlineInput {
  applyDeadline?: string;
  submitDeadline?: string;
  resultsDate?: string;
}

export type ExtendContestDeadlineResult =
  | Result<{
      extensionsCount: number;
      dates: { applyDeadline: string; submitDeadline: string; resultsDate: string };
    }>
  | ProRequiredResult
  | ExtensionLimitResult;

// Solo el client dueño, y solo con plan Pro. Cada fecha provista debe ser
// estrictamente posterior a la actual de ese campo; applyDeadline solo es
// extendible mientras la fase derivada actual sea "applications". El orden
// final apply < submit < results debe mantenerse.
export async function extendContestDeadline(
  contestId: string,
  input: ExtendContestDeadlineInput,
): Promise<ExtendContestDeadlineResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planStatus: true },
  });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede prorrogar una convocatoria." };
  }

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: { _count: { select: { applications: true } } },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };

  if (!isPro(user)) return PRO_REQUIRED_RESULT;

  if (!EXTENDABLE_CONTEST_STATUSES.includes(contest.status)) {
    return {
      ok: false,
      error: "Solo se puede prorrogar una convocatoria publicada o con Terna seleccionada.",
    };
  }

  if (contest.extensionsCount >= MAX_CONTEST_EXTENSIONS) {
    return { ok: false, error: "EXTENSION_LIMIT" };
  }

  if (
    input.applyDeadline === undefined &&
    input.submitDeadline === undefined &&
    input.resultsDate === undefined
  ) {
    return { ok: false, error: "Indica al menos una fecha a prorrogar." };
  }

  let applyDeadline = contest.applyDeadline;
  if (input.applyDeadline !== undefined) {
    const parsed = new Date(input.applyDeadline);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "La fecha límite de postulación no es válida." };
    }
    if (parsed.getTime() <= contest.applyDeadline.getTime()) {
      return { ok: false, error: "La nueva fecha límite de postulación debe ser posterior a la actual." };
    }
    const currentPhase = deriveContestPhase({
      status: contest.status,
      applyDeadline: contest.applyDeadline,
      submitDeadline: contest.submitDeadline,
      resultsDate: contest.resultsDate,
      maxApplicants: contest.maxApplicants,
      applicationCount: contest._count.applications,
    });
    if (currentPhase !== "applications") {
      return { ok: false, error: "Solo puedes prorrogar la postulación mientras siga abierta." };
    }
    applyDeadline = parsed;
  }

  let submitDeadline = contest.submitDeadline;
  if (input.submitDeadline !== undefined) {
    const parsed = new Date(input.submitDeadline);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "La fecha límite de entrega no es válida." };
    }
    if (parsed.getTime() <= contest.submitDeadline.getTime()) {
      return { ok: false, error: "La nueva fecha límite de entrega debe ser posterior a la actual." };
    }
    submitDeadline = parsed;
  }

  let resultsDate = contest.resultsDate;
  if (input.resultsDate !== undefined) {
    const parsed = new Date(input.resultsDate);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "La fecha de resultados no es válida." };
    }
    if (parsed.getTime() <= contest.resultsDate.getTime()) {
      return { ok: false, error: "La nueva fecha de resultados debe ser posterior a la actual." };
    }
    resultsDate = parsed;
  }

  if (
    !(
      applyDeadline.getTime() < submitDeadline.getTime() &&
      submitDeadline.getTime() < resultsDate.getTime()
    )
  ) {
    return { ok: false, error: "El orden de fechas debe ser: postulación < entrega < resultados." };
  }

  const activeApplications = await prisma.contestApplication.findMany({
    where: { contestId, status: { notIn: INACTIVE_APPLICATION_STATUSES } },
    select: { freelancerId: true },
  });

  const submitDeadlineChanged = input.submitDeadline !== undefined;

  const extensionsCount = await prisma.$transaction(async (tx) => {
    const updated = await tx.contest.update({
      where: { id: contestId },
      data: {
        applyDeadline,
        submitDeadline,
        resultsDate,
        extensionsCount: { increment: 1 },
      },
      select: { extensionsCount: true },
    });

    // Si se prorrogó submitDeadline, el vencimiento del segundo pago
    // (PRIZE_SPLIT_2 PENDING, Términos §3.4) se corre acorde: siempre
    // submitDeadline − 10 días naturales, con la nueva fecha.
    if (submitDeadlineChanged) {
      await tx.contestPayment.updateMany({
        where: { contestId, kind: "PRIZE_SPLIT_2", status: "PENDING" },
        data: { dueAt: new Date(submitDeadline.getTime() - 10 * 24 * 60 * 60 * 1000) },
      });
    }

    if (activeApplications.length > 0) {
      await tx.notification.createMany({
        data: activeApplications.map(({ freelancerId }) => ({
          userId: freelancerId,
          type: NotificationType.CONTEST_EXTENDED,
          payload: { contestId, title: contest.title },
        })),
      });
    }

    return updated.extensionsCount;
  });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/freelancer");

  return {
    ok: true,
    extensionsCount,
    dates: {
      applyDeadline: applyDeadline.toISOString(),
      submitDeadline: submitDeadline.toISOString(),
      resultsDate: resultsDate.toISOString(),
    },
  };
}

/* ══ Etapas del timeline (panel de gestión, Fase 4, solo Pro) ═════════════
   Puramente informativas/organizativas (Términos §3.3): no alteran el motor
   de fases derivadas (deriveContestPhase, src/lib/contests.ts) — son un
   cronograma propio que el client comunica a los freelancers en el detalle.
   Estrategia replace-all: cada guardado reemplaza el set completo por el que
   manda el client, con order = índice del array recibido. Editable con la
   convocatoria en DRAFT o PUBLISHED (un pro puede seguir afinando el
   cronograma tras publicar; ya no una vez hay Terna seleccionada o cerrada). ══ */

const MAX_CONTEST_STAGES = 6;
const STAGE_TITLE_MAX_LENGTH = 120;
const STAGE_DESCRIPTION_MAX_LENGTH = 500;
const STAGE_EDITABLE_STATUSES: ContestStatus[] = ["DRAFT", "PUBLISHED"];

export interface ContestStageInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

// Solo el client dueño, y solo con plan Pro. Reemplaza TODAS las etapas de la
// convocatoria por las recibidas (deleteMany + createMany en transacción),
// nunca un merge parcial.
export async function saveContestStages(
  contestId: string,
  stages: ContestStageInput[],
): Promise<Result<{ count: number }> | ProRequiredResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planStatus: true },
  });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede configurar las etapas de una convocatoria." };
  }
  if (!isPro(user)) return PRO_REQUIRED_RESULT;

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { clientId: true, status: true, slug: true },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (!STAGE_EDITABLE_STATUSES.includes(contest.status)) {
    return {
      ok: false,
      error: "Solo se pueden editar las etapas mientras la convocatoria esté en borrador o publicada.",
    };
  }

  if (stages.length > MAX_CONTEST_STAGES) {
    return { ok: false, error: `No puedes agregar más de ${MAX_CONTEST_STAGES} etapas.` };
  }

  const normalized: Array<{ title: string; description: string | null; dueDate: Date | null }> = [];
  for (const stage of stages) {
    const title = stage.title?.trim() ?? "";
    if (!title) return { ok: false, error: "El título de cada etapa es obligatorio." };
    if (title.length > STAGE_TITLE_MAX_LENGTH) {
      return { ok: false, error: `El título de una etapa no puede exceder ${STAGE_TITLE_MAX_LENGTH} caracteres.` };
    }

    const description = stage.description?.trim() || null;
    if (description && description.length > STAGE_DESCRIPTION_MAX_LENGTH) {
      return {
        ok: false,
        error: `La descripción de una etapa no puede exceder ${STAGE_DESCRIPTION_MAX_LENGTH} caracteres.`,
      };
    }

    let dueDate: Date | null = null;
    if (stage.dueDate) {
      const parsed = new Date(stage.dueDate);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, error: "Alguna fecha objetivo de etapa no es válida." };
      }
      dueDate = parsed;
    }

    normalized.push({ title, description, dueDate });
  }

  await prisma.$transaction(async (tx) => {
    await tx.contestStage.deleteMany({ where: { contestId } });
    if (normalized.length > 0) {
      await tx.contestStage.createMany({
        data: normalized.map((stage, index) => ({
          contestId,
          order: index,
          title: stage.title,
          description: stage.description,
          dueDate: stage.dueDate,
        })),
      });
    }
  });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  return { ok: true, count: normalized.length };
}

/* ══ Postulaciones del freelancer (Fase 1: solo pitch + portafolio existente) ══ */

export interface MyPortfolioPieceOption {
  id: string;
  title: string;
  coverUrl: string | null;
}

// Piezas propias del freelancer logueado, para el selector de piezas del
// Dialog de postulación (ContestApplyDialog) — de solo lectura, no valida
// rol (un client sin piezas simplemente vería la lista vacía).
export async function getMyPortfolioPiecesForApplication(): Promise<
  Result<{ pieces: MyPortfolioPieceOption[] }>
> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const pieces = await prisma.portfolioPiece.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, coverUrl: true },
  });

  return { ok: true, pieces };
}

// Solo un freelancer se postula, solo con piezas propias, y solo dentro de la
// fase "applications" (valida canApplyToContest, src/lib/contests.ts).
// Transacción con conteo fresco para no rebasar maxApplicants con
// postulaciones concurrentes.
export async function applyToContest(
  contestId: string,
  pitch: string,
  portfolioPieceIds: string[],
): Promise<Result<{ applicationId: string }> | ProRequiredResult> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedPitch = pitch.trim();
  if (!trimmedPitch) return { ok: false, error: "El pitch es obligatorio." };

  const uniquePieceIds = Array.from(new Set(portfolioPieceIds));

  try {
    const applicationId = await prisma.$transaction(async (tx) => {
      const [user, contest] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { role: true, plan: true, planStatus: true } }),
        tx.contest.findUnique({ where: { id: contestId } }),
      ]);
      if (!contest) throw new ContestActionError("Convocatoria no encontrada.");

      if (user && !isPro(user)) {
        const activeApplicationCount = await tx.contestApplication.count({
          where: {
            freelancerId: userId,
            status: { notIn: INACTIVE_APPLICATION_STATUSES },
            contest: { status: { notIn: CLOSED_CONTEST_STATUSES } },
          },
        });
        if (activeApplicationCount > 0) throw new ProRequiredError();
      }

      const [existingApplication, applicationCount] = await Promise.all([
        tx.contestApplication.findUnique({
          where: { contestId_freelancerId: { contestId, freelancerId: userId } },
          select: { id: true },
        }),
        tx.contestApplication.count({ where: { contestId } }),
      ]);

      const guard = canApplyToContest(
        {
          status: contest.status,
          applyDeadline: contest.applyDeadline,
          submitDeadline: contest.submitDeadline,
          resultsDate: contest.resultsDate,
          maxApplicants: contest.maxApplicants,
          applicationCount,
        },
        { role: user?.role, hasExistingApplication: Boolean(existingApplication) },
      );
      if (!guard.ok) throw new ContestActionError(guard.error);

      if (uniquePieceIds.length > 0) {
        const ownedCount = await tx.portfolioPiece.count({
          where: { id: { in: uniquePieceIds }, userId },
        });
        if (ownedCount !== uniquePieceIds.length) {
          throw new ContestActionError("Todas las piezas deben pertenecer a tu portafolio.");
        }
      }

      const application = await tx.contestApplication.create({
        data: {
          contestId,
          freelancerId: userId,
          pitch: trimmedPitch,
          portfolioPieceIds: uniquePieceIds,
        },
        select: { id: true },
      });
      return application.id;
    });

    revalidatePath("/convocatorias");
    revalidatePath("/dashboard/freelancer");
    return { ok: true, applicationId };
  } catch (error) {
    if (error instanceof ProRequiredError) return PRO_REQUIRED_RESULT;
    if (error instanceof ContestActionError) return { ok: false, error: error.message };
    throw error;
  }
}

// Solo el propio postulante, y solo mientras su postulación siga SUBMITTED
// (aún no fue resuelta por el client).
export async function withdrawApplication(applicationId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const application = await prisma.contestApplication.findUnique({
    where: { id: applicationId },
    select: { freelancerId: true, status: true, contestId: true },
  });
  if (!application) return { ok: false, error: "Postulación no encontrada." };
  if (application.freelancerId !== userId) return { ok: false, error: "No autorizado" };
  if (application.status !== "SUBMITTED") {
    return { ok: false, error: "Solo puedes retirar una postulación que aún no fue resuelta." };
  }

  await prisma.contestApplication.update({
    where: { id: applicationId },
    data: { status: "WITHDRAWN" },
  });

  revalidatePath("/convocatorias");
  revalidatePath("/dashboard/freelancer");
  return { ok: true };
}

/* ══ Selección de Terna y entregas de finalistas ══════════════════════ */

// Solo el client dueño, y solo tras el cierre de postulaciones (deadline
// pasado o cupo lleno). Marca SHORTLISTED a los elegidos y REJECTED al
// resto de postulaciones SUBMITTED; crea una ContestEntry vacía por
// finalista (recién ahí empieza a existir la propuesta real) y notifica.
export async function selectShortlist(contestId: string, applicationIds: string[]): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const uniqueIds = Array.from(new Set(applicationIds));
  if (uniqueIds.length === 0) return { ok: false, error: "Selecciona al menos un finalista." };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      applications: { select: { id: true, freelancerId: true, status: true } },
      _count: { select: { applications: true } },
    },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };

  const phase = deriveContestPhase({
    status: contest.status,
    applyDeadline: contest.applyDeadline,
    submitDeadline: contest.submitDeadline,
    resultsDate: contest.resultsDate,
    maxApplicants: contest.maxApplicants,
    applicationCount: contest._count.applications,
  });
  if (phase !== "applicationsClosed") {
    return { ok: false, error: "Solo puedes seleccionar la Terna tras el cierre de postulaciones." };
  }
  if (uniqueIds.length > contest.shortlistSize) {
    return { ok: false, error: `La Terna no puede exceder ${contest.shortlistSize} finalistas.` };
  }

  const applicationsById = new Map(contest.applications.map((application) => [application.id, application]));
  const invalidId = uniqueIds.find((id) => {
    const application = applicationsById.get(id);
    return !application || application.status !== "SUBMITTED";
  });
  if (invalidId) {
    return { ok: false, error: "Alguna de las postulaciones seleccionadas no es válida." };
  }

  const rejectedIds = contest.applications
    .filter((application) => application.status === "SUBMITTED" && !uniqueIds.includes(application.id))
    .map((application) => application.id);
  const selectedFreelancerIds = uniqueIds.map((id) => applicationsById.get(id)!.freelancerId);

  await prisma.$transaction([
    prisma.contestApplication.updateMany({
      where: { id: { in: uniqueIds } },
      data: { status: "SHORTLISTED" },
    }),
    ...(rejectedIds.length > 0
      ? [
          prisma.contestApplication.updateMany({
            where: { id: { in: rejectedIds } },
            data: { status: "REJECTED" },
          }),
        ]
      : []),
    prisma.contestEntry.createMany({
      data: uniqueIds.map((applicationId) => ({ applicationId })),
    }),
    prisma.contest.update({ where: { id: contestId }, data: { status: "SHORTLIST" } }),
    prisma.notification.createMany({
      data: selectedFreelancerIds.map((freelancerId) => ({
        userId: freelancerId,
        type: NotificationType.CONTEST_SHORTLISTED,
        payload: { contestId },
      })),
    }),
  ]);

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/freelancer");
  return { ok: true };
}

// Solo el finalista dueño de la postulación, y solo antes de submitDeadline.
// Sella submittedAt para que quede registrado el momento real de entrega.
export async function submitEntry(
  applicationId: string,
  contentBlocks: Prisma.InputJsonValue,
  coverUrl?: string | null,
): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const application = await prisma.contestApplication.findUnique({
    where: { id: applicationId },
    select: {
      freelancerId: true,
      status: true,
      entry: { select: { id: true } },
      contest: { select: { status: true, submitDeadline: true } },
    },
  });
  if (!application) return { ok: false, error: "Postulación no encontrada." };
  if (application.freelancerId !== userId) return { ok: false, error: "No autorizado" };
  if (application.status !== "SHORTLISTED" || !application.entry) {
    return { ok: false, error: "Solo un finalista de la Terna puede entregar una propuesta." };
  }
  if (application.contest.status !== "SHORTLIST") {
    return { ok: false, error: "Esta convocatoria ya no acepta entregas." };
  }
  if (new Date().getTime() >= application.contest.submitDeadline.getTime()) {
    return { ok: false, error: "La fecha límite de entrega ya pasó." };
  }

  await prisma.contestEntry.update({
    where: { applicationId },
    data: {
      contentBlocks: contentBlocks ?? Prisma.JsonNull,
      coverUrl: coverUrl ?? null,
      submittedAt: new Date(),
    },
  });

  revalidatePath("/convocatorias");
  revalidatePath("/dashboard/freelancer");
  return { ok: true };
}

/* ══ Fallo: ganador, runner-ups y siembra del proyecto conjunto ═══════ */

// Solo el client dueño. Solo en fase "production" (con todas las entregas
// ya hechas) o "judging" (deadline de entrega vencido). Marca WINNER al
// ganador, FINALIST a los runner-ups explícitos y PARTICIPANT al resto de
// la Terna; siembra (o reutiliza) la Connection ACCEPTED client↔ganador y
// un CollabProject con la cotización = premio de la convocatoria.
export async function awardContest(
  contestId: string,
  winnerApplicationId: string,
  finalistApplicationIds: string[],
): Promise<Result<{ projectId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    include: {
      applications: {
        where: { status: "SHORTLISTED" },
        include: { entry: true },
      },
    },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "SHORTLIST") {
    return { ok: false, error: "Solo se puede emitir el fallo de una convocatoria con Terna seleccionada." };
  }

  const phase = deriveContestPhase({
    status: contest.status,
    applyDeadline: contest.applyDeadline,
    submitDeadline: contest.submitDeadline,
    resultsDate: contest.resultsDate,
    maxApplicants: contest.maxApplicants,
    applicationCount: contest.applications.length,
  });
  if (phase !== "production" && phase !== "judging") {
    return { ok: false, error: "El fallo solo se puede emitir en fase de producción o dictamen." };
  }
  const allSubmitted = contest.applications.every((application) => application.entry?.submittedAt);
  if (phase === "production" && !allSubmitted) {
    return { ok: false, error: "Aún faltan entregas de finalistas antes del cierre de producción." };
  }

  const winnerApplication = contest.applications.find((application) => application.id === winnerApplicationId);
  if (!winnerApplication || !winnerApplication.entry) {
    return { ok: false, error: "El ganador debe ser un finalista de la Terna con propuesta." };
  }

  const uniqueFinalistIds = Array.from(new Set(finalistApplicationIds)).filter(
    (id) => id !== winnerApplicationId,
  );
  const invalidFinalist = uniqueFinalistIds.find(
    (id) => !contest.applications.some((application) => application.id === id),
  );
  if (invalidFinalist) {
    return { ok: false, error: "Algún runner-up seleccionado no pertenece a la Terna." };
  }

  const participantIds = contest.applications
    .map((application) => application.id)
    .filter((id) => id !== winnerApplicationId && !uniqueFinalistIds.includes(id));

  const projectId = await prisma.$transaction(async (tx) => {
    await tx.contestEntry.update({
      where: { applicationId: winnerApplicationId },
      data: { placement: "WINNER" },
    });
    if (uniqueFinalistIds.length > 0) {
      await tx.contestEntry.updateMany({
        where: { applicationId: { in: uniqueFinalistIds } },
        data: { placement: "FINALIST" },
      });
    }
    if (participantIds.length > 0) {
      await tx.contestEntry.updateMany({
        where: { applicationId: { in: participantIds } },
        data: { placement: "PARTICIPANT" },
      });
    }

    // Siembra (o reutiliza) la conexión client↔ganador: el fallo de la
    // convocatoria implica una relación de trabajo aceptada, sin pasar por
    // el flujo manual de sendContactRequest/respondContactRequest.
    const connection = await tx.connection.upsert({
      where: {
        clientId_freelancerId: { clientId: contest.clientId, freelancerId: winnerApplication.freelancerId },
      },
      update: { status: "ACCEPTED" },
      create: { clientId: contest.clientId, freelancerId: winnerApplication.freelancerId, status: "ACCEPTED" },
      select: { id: true },
    });

    const project = await tx.collabProject.create({
      data: {
        connectionId: connection.id,
        title: contest.title,
        quoteAmount: contest.prizeAmount,
        quoteCurrency: contest.currency,
      },
      select: { id: true },
    });

    await tx.contest.update({
      where: { id: contestId },
      data: { status: "AWARDED", awardedProjectId: project.id },
    });

    await tx.notification.create({
      data: {
        userId: winnerApplication.freelancerId,
        type: NotificationType.CONTEST_AWARDED,
        payload: { contestId, projectId: project.id },
      },
    });

    return project.id;
  });

  revalidatePath("/convocatorias");
  revalidatePath(`/convocatorias/${contest.slug}`);
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/freelancer");
  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, projectId };
}

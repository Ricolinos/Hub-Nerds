import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { ContestApplicationStatus, ContestStatus, EntryPlacement } from "@/generated/prisma/client";
import { isFreelancerRole } from "@/lib/roles";
import { isPro } from "@/lib/plan";
import { isInKindPrizeType, isPrizeType, PRIZE_FEE_PCT } from "@/lib/prizeResponsibility";
import { stripe } from "@/lib/stripe";

/* ══ Brief-hub: convocatorias (concursos creativos) ══════════════════════
   ══ Modelo de dos fases anti spec-work: el freelancer se postula SOLO con ══
   ══ pitch + piezas de portafolio existentes (ContestApplication); el   ══
   ══ client elige una Terna limitada (selectShortlist) que sí produce  ══
   ══ propuesta (ContestEntry) y cobra un fee garantizado.               ══
   ══ Fechas serializadas como ISO string para Server → Client, mismo   ══
   ══ patrón que src/lib/collab.ts. ═══════════════════════════════════ */

export type ContestPhase =
  | "draft"
  | "applications"
  | "applicationsClosed"
  | "production"
  | "judging"
  | "awarded"
  | "cancelled"
  | "breached";

// Días de gracia tras resultsDate antes de considerar la convocatoria
// incumplida (BREACHED) por falta de fallo.
const BREACH_GRACE_DAYS = 7;
const BREACH_GRACE_MS = BREACH_GRACE_DAYS * 24 * 60 * 60 * 1000;

/* ══ Cupos de convocatorias PUBLICADAS por plan ═══════════════════════════
   Fuente única de verdad (importada por src/app/actions/contests.ts, que no
   puede exportar consts al llevar "use server"): tope de convocatorias
   PUBLICADAS activas al mismo tiempo (PUBLISHED|SHORTLIST) y de convocatorias
   publicadas en una ventana móvil de 90 días — el doble para Pro. ═══════ */
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
export const FREE_PUBLISH_LIMIT = 1;
export const PRO_PUBLISH_LIMIT = 2;
// Statuses que cuentan como "convocatoria publicada activa" para el cupo
// simultáneo (DRAFT no cuenta).
export const ACTIVE_PUBLISHED_STATUSES: ContestStatus[] = ["PUBLISHED", "SHORTLIST"];

export interface ContestPhaseInput {
  status: ContestStatus;
  applyDeadline: Date;
  submitDeadline: Date;
  resultsDate: Date;
  maxApplicants: number | null;
  applicationCount: number;
}

// PUBLISHED o SHORTLIST sin fallo emitido BREACH_GRACE_DAYS después de
// resultsDate ⇒ incumplida. Pura (no toca la BD); ver materializeContestStatus
// para la escritura lazy desde las queries de lectura.
export function isContestBreached(
  contest: Pick<ContestPhaseInput, "status" | "resultsDate">,
  now: Date = new Date(),
): boolean {
  if (contest.status !== "PUBLISHED" && contest.status !== "SHORTLIST") return false;
  return now.getTime() > contest.resultsDate.getTime() + BREACH_GRACE_MS;
}

// Fase efectiva de una convocatoria a partir de su status + fechas + cupo.
export function deriveContestPhase(contest: ContestPhaseInput, now: Date = new Date()): ContestPhase {
  if (isContestBreached(contest, now)) return "breached";

  switch (contest.status) {
    case "DRAFT":
      return "draft";
    case "CANCELLED":
      return "cancelled";
    case "BREACHED":
      return "breached";
    case "AWARDED":
      return "awarded";
    case "PUBLISHED": {
      const cupoLleno =
        contest.maxApplicants != null && contest.applicationCount >= contest.maxApplicants;
      const deadlinePasado = now.getTime() >= contest.applyDeadline.getTime();
      return deadlinePasado || cupoLleno ? "applicationsClosed" : "applications";
    }
    case "SHORTLIST":
      return now.getTime() < contest.submitDeadline.getTime() ? "production" : "judging";
    default:
      return "draft";
  }
}

// Materialización lazy de BREACHED: llamada desde las queries de lectura de
// esta librería. No-op (y sin escritura) si la convocatoria no incumplió.
export async function materializeContestStatus(contest: {
  id: string;
  status: ContestStatus;
  resultsDate: Date;
}): Promise<ContestStatus> {
  if (contest.status === "BREACHED" || !isContestBreached(contest)) return contest.status;
  await prisma.contest.update({ where: { id: contest.id }, data: { status: "BREACHED" } });
  return "BREACHED";
}

/* ══ Pagos de convocatorias (Fase 3, Términos §3.3-§3.5) ══════════════════
   FREE + MONETARY   → paga el 100% del premio antes de publicar (PRIZE_FULL).
   PRO  + MONETARY   → 50% antes de publicar (PRIZE_SPLIT_1) + 50% restante
                        liquidado a más tardar submitDeadline − 10 días
                        naturales (PRIZE_SPLIT_2, creado por publishContest
                        al publicar); si no liquida a tiempo ⇒ incumplimiento
                        (ver isSplit2PaymentOverdue).
   PRO  + IN_KIND_*  → fee (prizeFeePct%) sobre el valor declarado, antes de
                        publicar (IN_KIND_FEE).
   Server actions en src/app/actions/contestPayments.ts. ═══════════════════ */

export type ContestPaymentKind = "PRIZE_FULL" | "PRIZE_SPLIT_1" | "PRIZE_SPLIT_2" | "IN_KIND_FEE";
export type ContestPaymentStatus = "PENDING" | "PAID" | "CANCELED";

// Redondeo estándar a centavos (evita arrastre de binarios de punto flotante).
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Divide el premio total en dos pagos que suman EXACTAMENTE el total: el
// segundo absorbe el residuo de redondeo del primero (nunca al revés), así
// PRIZE_SPLIT_1 + PRIZE_SPLIT_2 siempre reconstruyen prizeAmount a centavos.
export function splitPrizeAmounts(totalPrizeAmount: number): { split1: number; split2: number } {
  const split1 = round2(totalPrizeAmount / 2);
  const split2 = round2(totalPrizeAmount - split1);
  return { split1, split2 };
}

// Pago requerido para PUBLICAR (gate de publishContest): null si el premio ya
// está cubierto (prizeType inválido no debería llegar aquí, defensivo). No
// cubre PRIZE_SPLIT_2: ese pago recién nace AL publicar (ver publishContest
// en src/app/actions/contests.ts), no antes.
export function requiredPublishPayment(
  plan: "free" | "pro",
  prizeType: string,
  prizeAmount: number,
): { kind: ContestPaymentKind; amount: number } | null {
  if (!isPrizeType(prizeType)) return null;
  if (isInKindPrizeType(prizeType)) {
    const pct = PRIZE_FEE_PCT[prizeType];
    if (pct == null) return null;
    return { kind: "IN_KIND_FEE", amount: round2((prizeAmount * pct) / 100) };
  }
  if (plan === "free") {
    return { kind: "PRIZE_FULL", amount: round2(prizeAmount) };
  }
  return { kind: "PRIZE_SPLIT_1", amount: splitPrizeAmounts(prizeAmount).split1 };
}

// Monto esperado para CUALQUIER kind, incluido PRIZE_SPLIT_2 (que
// requiredPublishPayment no cubre) — usado por createContestPaymentCheckout
// para validar que el kind solicitado corresponde al plan/prizeType vigentes
// de la convocatoria antes de crear la Checkout Session. null = no aplica.
export function contestPaymentAmountForKind(
  kind: ContestPaymentKind,
  plan: "free" | "pro",
  prizeType: string,
  prizeAmount: number,
): number | null {
  if (!isPrizeType(prizeType)) return null;
  const inKind = isInKindPrizeType(prizeType);

  if (kind === "IN_KIND_FEE") {
    if (plan !== "pro" || !inKind) return null;
    const pct = PRIZE_FEE_PCT[prizeType];
    return pct == null ? null : round2((prizeAmount * pct) / 100);
  }
  if (inKind) return null; // PRIZE_FULL/SPLIT_* no aplican a premios en especie

  if (kind === "PRIZE_FULL") {
    return plan === "free" ? round2(prizeAmount) : null;
  }
  if (plan !== "pro") return null;
  const { split1, split2 } = splitPrizeAmounts(prizeAmount);
  if (kind === "PRIZE_SPLIT_1") return split1;
  if (kind === "PRIZE_SPLIT_2") return split2;
  return null;
}

// Reconciliación PULL (sin Stripe CLI local no llegan webhooks en dev):
// sincroniza los ContestPayment PENDING que ya tienen sesión de Stripe
// creada consultando su payment_status. Idempotente y silenciosa ante
// fallos de red puntuales (no debe tumbar al caller).
export async function reconcileContestPayments(contestId: string): Promise<void> {
  const pending = await prisma.contestPayment.findMany({
    where: { contestId, status: "PENDING", stripeSessionId: { not: null } },
  });
  for (const payment of pending) {
    try {
      // eslint-disable-next-line no-await-in-loop -- pocas filas por convocatoria, secuencial por simplicidad
      const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId!);
      if (session.payment_status === "paid") {
        // eslint-disable-next-line no-await-in-loop
        await prisma.contestPayment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    } catch (error) {
      console.error(`reconcileContestPayments: fallo reconciliando pago ${payment.id}`, error);
    }
  }
}

// Vencimiento del pago 2/2 (PRO+MONETARY, Términos §3.4): incumplimiento si
// PRIZE_SPLIT_2 sigue PENDING después de su dueAt. Distinto de
// isContestBreached (basado en resultsDate sin fallo emitido); ambos
// materializan a BREACHED. Evaluarlo con precisión requiere reconciliar el
// pago con Stripe primero (reconcileContestPayments), así que solo se invoca
// desde flujos de gestión (getMyContestsManagement) — nunca desde lecturas
// públicas (Explorar, detalle de convocatoria).
export function isSplit2PaymentOverdue(
  contest: { status: ContestStatus },
  split2Payment: { status: string; dueAt: Date | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (contest.status !== "PUBLISHED" && contest.status !== "SHORTLIST") return false;
  if (!split2Payment || split2Payment.status !== "PENDING" || !split2Payment.dueAt) return false;
  return now.getTime() > split2Payment.dueAt.getTime();
}

/* ══ Tipos de lectura (serializados) ═══════════════════════════════════ */

export interface ContestSummary {
  id: string;
  slug: string;
  title: string;
  projectType: string | null;
  projectSubtype: string | null;
  prizeAmount: number;
  currency: string;
  shortlistFee: number;
  maxApplicants: number | null;
  shortlistSize: number;
  applyDeadline: string;
  submitDeadline: string;
  resultsDate: string;
  status: ContestStatus;
  phase: ContestPhase;
  applicationCount: number;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContestUserSummary {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
  headline: string | null;
}

export interface ContestEntryDetail {
  id: string;
  applicationId: string;
  contentBlocks: unknown;
  coverUrl: string | null;
  submittedAt: string | null;
  placement: EntryPlacement | null;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContestPortfolioPieceOption {
  id: string;
  title: string;
  coverUrl: string | null;
}

export interface ContestApplicationDetail {
  id: string;
  contestId: string;
  freelancerId: string;
  freelancer: ContestUserSummary;
  pitch: string;
  portfolioPieceIds: string[];
  // Piezas resueltas (título/portada) en el mismo orden que portfolioPieceIds,
  // para las miniaturas del panel de postulaciones del client dueño.
  portfolioPieces: ContestPortfolioPieceOption[];
  status: ContestApplicationStatus;
  entry: ContestEntryDetail | null;
  createdAt: string;
  updatedAt: string;
}

// Etapa/hito informativo del timeline (Fase 4, solo Client Pro): puramente
// organizativo, no participa del motor de fases derivadas (ContestPhase).
export interface ContestStageSummary {
  id: string;
  order: number;
  title: string;
  description: string | null;
  dueDate: string | null;
}

export interface ContestDetail extends ContestSummary {
  brief: unknown;
  terms: unknown;
  rightsPolicy: string | null;
  awardedProjectId: string | null;
  client: ContestUserSummary;
  applications: ContestApplicationDetail[];
  // Timeline informativo (Fase 4): [] si el client nunca lo configuró (o no
  // es Pro), siempre ordenado por `order`.
  stages: ContestStageSummary[];
}

export interface FreelancerApplicationDetail {
  id: string;
  contestId: string;
  contest: ContestSummary;
  pitch: string;
  portfolioPieceIds: string[];
  status: ContestApplicationStatus;
  entry: ContestEntryDetail | null;
  createdAt: string;
  updatedAt: string;
}

function toContestSummary(
  contest: {
    id: string;
    slug: string;
    title: string;
    projectType: string | null;
    projectSubtype: string | null;
    prizeAmount: { toString(): string };
    currency: string;
    shortlistFee: { toString(): string };
    maxApplicants: number | null;
    shortlistSize: number;
    applyDeadline: Date;
    submitDeadline: Date;
    resultsDate: Date;
    status: ContestStatus;
    clientId: string;
    createdAt: Date;
    updatedAt: Date;
  },
  applicationCount: number,
): ContestSummary {
  return {
    id: contest.id,
    slug: contest.slug,
    title: contest.title,
    projectType: contest.projectType,
    projectSubtype: contest.projectSubtype,
    prizeAmount: Number(contest.prizeAmount),
    currency: contest.currency,
    shortlistFee: Number(contest.shortlistFee),
    maxApplicants: contest.maxApplicants,
    shortlistSize: contest.shortlistSize,
    applyDeadline: contest.applyDeadline.toISOString(),
    submitDeadline: contest.submitDeadline.toISOString(),
    resultsDate: contest.resultsDate.toISOString(),
    status: contest.status,
    phase: deriveContestPhase({
      status: contest.status,
      applyDeadline: contest.applyDeadline,
      submitDeadline: contest.submitDeadline,
      resultsDate: contest.resultsDate,
      maxApplicants: contest.maxApplicants,
      applicationCount,
    }),
    applicationCount,
    clientId: contest.clientId,
    createdAt: contest.createdAt.toISOString(),
    updatedAt: contest.updatedAt.toISOString(),
  };
}

function toUserSummary(user: {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
  headline?: string | null;
}): ContestUserSummary {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    imageUrl: user.imageUrl,
    headline: user.headline ?? null,
  };
}

function toEntryDetail(entry: {
  id: string;
  applicationId: string;
  contentBlocks: unknown;
  coverUrl: string | null;
  submittedAt: Date | null;
  placement: EntryPlacement | null;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ContestEntryDetail {
  return {
    id: entry.id,
    applicationId: entry.applicationId,
    contentBlocks: entry.contentBlocks,
    coverUrl: entry.coverUrl,
    submittedAt: entry.submittedAt === null ? null : entry.submittedAt.toISOString(),
    placement: entry.placement,
    feedback: entry.feedback,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

function toStageSummary(stage: {
  id: string;
  order: number;
  title: string;
  description: string | null;
  dueDate: Date | null;
}): ContestStageSummary {
  return {
    id: stage.id,
    order: stage.order,
    title: stage.title,
    description: stage.description,
    dueDate: stage.dueDate ? stage.dueDate.toISOString() : null,
  };
}

/* ══ Queries ═══════════════════════════════════════════════════════════ */

// Timeline de etapas de una convocatoria (Fase 4), ordenado por `order`. Uso
// independiente de getContestBySlug para callers que solo necesitan el
// timeline (p. ej. el propio panel de edición de etapas).
export async function getContestStages(contestId: string): Promise<ContestStageSummary[]> {
  const stages = await prisma.contestStage.findMany({
    where: { contestId },
    orderBy: { order: "asc" },
  });
  return stages.map(toStageSummary);
}

// Explorar: convocatorias PUBLISHED (no incumplidas), ordenadas por
// applyDeadline ascendente, con conteo de postulaciones.
export async function getPublishedContests(): Promise<ContestSummary[]> {
  const contests = await prisma.contest.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { applyDeadline: "asc" },
    include: { _count: { select: { applications: true } } },
  });

  const results: ContestSummary[] = [];
  for (const contest of contests) {
    const status = await materializeContestStatus(contest);
    if (status === "BREACHED") continue;
    results.push(toContestSummary({ ...contest, status }, contest._count.applications));
  }
  return results;
}

// Detalle público/privado de una convocatoria: postulaciones + entries +
// client. El caller decide qué exponer según el rol del viewer.
export async function getContestBySlug(slug: string): Promise<ContestDetail | null> {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    include: {
      client: { select: { id: true, username: true, name: true, imageUrl: true, headline: true } },
      applications: {
        orderBy: { createdAt: "asc" },
        include: {
          freelancer: { select: { id: true, username: true, name: true, imageUrl: true, headline: true } },
          entry: true,
        },
      },
      stages: { orderBy: { order: "asc" } },
    },
  });
  if (!contest) return null;

  const status = await materializeContestStatus(contest);

  // Miniaturas de las piezas adjuntas a cada postulación (panel del client
  // dueño): una sola consulta para todas las piezas referenciadas por
  // cualquier postulación, en vez de N+1.
  const allPieceIds = Array.from(new Set(contest.applications.flatMap((a) => a.portfolioPieceIds)));
  const pieces =
    allPieceIds.length > 0
      ? await prisma.portfolioPiece.findMany({
          where: { id: { in: allPieceIds } },
          select: { id: true, title: true, coverUrl: true },
        })
      : [];
  const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));

  return {
    ...toContestSummary({ ...contest, status }, contest.applications.length),
    brief: contest.brief,
    terms: contest.terms,
    rightsPolicy: contest.rightsPolicy,
    awardedProjectId: contest.awardedProjectId,
    client: toUserSummary(contest.client),
    stages: contest.stages.map(toStageSummary),
    applications: contest.applications.map((application) => ({
      id: application.id,
      contestId: application.contestId,
      freelancerId: application.freelancerId,
      freelancer: toUserSummary(application.freelancer),
      pitch: application.pitch,
      portfolioPieceIds: application.portfolioPieceIds,
      portfolioPieces: application.portfolioPieceIds
        .map((id) => pieceById.get(id))
        .filter((piece): piece is { id: string; title: string; coverUrl: string | null } => Boolean(piece)),
      status: application.status,
      entry: application.entry ? toEntryDetail(application.entry) : null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    })),
  };
}

// Panel del client: todas sus convocatorias, más recientes primero.
export async function getContestsForClient(clientId: string): Promise<ContestSummary[]> {
  const contests = await prisma.contest.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  const results: ContestSummary[] = [];
  for (const contest of contests) {
    const status = await materializeContestStatus(contest);
    results.push(toContestSummary({ ...contest, status }, contest._count.applications));
  }
  return results;
}

// Panel del freelancer: sus postulaciones (con la convocatoria embebida), más
// recientes primero.
export async function getApplicationsForFreelancer(freelancerId: string): Promise<FreelancerApplicationDetail[]> {
  const applications = await prisma.contestApplication.findMany({
    where: { freelancerId },
    orderBy: { createdAt: "desc" },
    include: {
      contest: { include: { _count: { select: { applications: true } } } },
      entry: true,
    },
  });

  const results: FreelancerApplicationDetail[] = [];
  for (const application of applications) {
    const status = await materializeContestStatus(application.contest);
    results.push({
      id: application.id,
      contestId: application.contestId,
      contest: toContestSummary(
        { ...application.contest, status },
        application.contest._count.applications,
      ),
      pitch: application.pitch,
      portfolioPieceIds: application.portfolioPieceIds,
      status: application.status,
      entry: application.entry ? toEntryDetail(application.entry) : null,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    });
  }
  return results;
}

// Vista "Convocatorias cerradas" (MegaMenu): terminadas con fallo (AWARDED),
// canceladas (CANCELLED) o incumplidas (BREACHED), más recientes primero por
// resultsDate. No incluye PUBLISHED/SHORTLIST aún no materializadas a
// BREACHED (ver materializeContestStatus, se resuelve de forma perezosa en
// las otras queries de lectura).
export async function getClosedContests(): Promise<ContestSummary[]> {
  const contests = await prisma.contest.findMany({
    where: { status: { in: ["AWARDED", "CANCELLED", "BREACHED"] } },
    orderBy: { resultsDate: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  const results: ContestSummary[] = [];
  for (const contest of contests) {
    const status = await materializeContestStatus(contest);
    results.push(toContestSummary({ ...contest, status }, contest._count.applications));
  }
  return results;
}

/* ══ Guard de postulación ══════════════════════════════════════════════
   Función pura: el caller (server action) resuelve rol/postulación previa
   con sus propias queries (idealmente dentro de una transacción, para no
   rebasar maxApplicants con postulaciones concurrentes) y le pasa el
   resultado ya resuelto aquí. ══════════════════════════════════════════ */

export interface ContestApplicant {
  role: string | null | undefined;
  hasExistingApplication: boolean;
}

export type CanApplyResult = { ok: true } | { ok: false; error: string };

export function canApplyToContest(
  contest: ContestPhaseInput,
  applicant: ContestApplicant,
  now: Date = new Date(),
): CanApplyResult {
  if (!isFreelancerRole(applicant.role)) {
    return { ok: false, error: "Solo un freelancer puede postularse a una convocatoria." };
  }
  if (applicant.hasExistingApplication) {
    return { ok: false, error: "Ya te postulaste a esta convocatoria." };
  }
  if (contest.maxApplicants != null && contest.applicationCount >= contest.maxApplicants) {
    return { ok: false, error: "Esta convocatoria ya alcanzó su cupo máximo de postulantes." };
  }
  const phase = deriveContestPhase(contest, now);
  if (phase !== "applications") {
    return { ok: false, error: "Esta convocatoria no acepta postulaciones en este momento." };
  }
  return { ok: true };
}

/* ══ Panel de gestión del client (Fase 1: panel + prórrogas, solo Pro) ═══
   Lectura para la futura página /convocatorias/panel (u equivalente): cupo
   de publicación vigente + todas las convocatorias propias con sus
   contadores, para que el panel decida qué acciones (publicar, prorrogar)
   mostrar sin round-trips adicionales. Resuelve su propia auth (a diferencia
   del resto de las queries de este archivo, que reciben el id ya resuelto)
   porque no depende de ningún parámetro de ruta. ══════════════════════════ */

export interface ContestManagementQuota {
  plan: "free" | "pro";
  activePublished: number;
  publishedLast90: number;
  simultaneousLimit: number;
  quarterlyLimit: number;
  nextQuarterlySlotAt: string | null;
}

// Item de ContestPayment tal cual lo consume el panel de gestión (chips de
// estado + avisos de vencimiento del SPLIT_2).
export interface ContestManagementPayment {
  kind: ContestPaymentKind;
  status: ContestPaymentStatus;
  amount: number;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
}

export interface ContestManagementItem {
  id: string;
  slug: string;
  title: string;
  status: ContestStatus;
  phase: ContestPhase;
  prizeAmount: number;
  currency: string;
  // Premio en especie (Términos §3.5): MONETARY | IN_KIND_DIRECT | IN_KIND_PLATFORM
  // (ver src/lib/prizeResponsibility.ts)
  prizeType: string;
  // Si el premio es en especie, indica si ya se aceptó la carta de
  // responsabilidad requerida para publicar (acceptPrizeResponsibility).
  responsibilityAccepted: boolean;
  applyDeadline: string;
  submitDeadline: string;
  resultsDate: string;
  publishedAt: string | null;
  extensionsCount: number;
  applicationsCount: number;
  entriesCount: number;
  hasAwardedProject: boolean;
  // Cantidad de etapas del timeline configuradas (Fase 4, solo Pro); 0 si el
  // client nunca las configuró.
  stagesCount: number;
  createdAt: string;
  // Pagos del premio/fee (Fase 3, Términos §3.3-§3.5): FREE+MONETARY trae un
  // PRIZE_FULL, PRO+MONETARY un PRIZE_SPLIT_1 y (tras publicar) PRIZE_SPLIT_2,
  // PRO+en especie un IN_KIND_FEE. Vacío para convocatorias sin pago exigible
  // aún (p. ej. DRAFT antes de intentar publicar).
  payments: ContestManagementPayment[];
}

export interface ContestManagementData {
  quota: ContestManagementQuota;
  contests: ContestManagementItem[];
}

export async function getMyContestsManagement(): Promise<ContestManagementData | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true, planStatus: true },
  });
  if (!user || user.role !== "client") return null;

  const userIsPro = isPro(user);
  const publishLimit = userIsPro ? PRO_PUBLISH_LIMIT : FREE_PUBLISH_LIMIT;
  const now = new Date();
  const windowStart = new Date(now.getTime() - NINETY_DAYS_MS);

  const [activePublishedCount, publishedLast90Count, oldestInWindow, contests] = await Promise.all([
    prisma.contest.count({
      where: { clientId: userId, status: { in: ACTIVE_PUBLISHED_STATUSES } },
    }),
    prisma.contest.count({
      where: { clientId: userId, publishedAt: { gte: windowStart } },
    }),
    prisma.contest.findFirst({
      where: { clientId: userId, publishedAt: { gte: windowStart } },
      orderBy: { publishedAt: "asc" },
      select: { publishedAt: true },
    }),
    prisma.contest.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        prizeAmount: true,
        currency: true,
        prizeType: true,
        responsibilityAcceptedAt: true,
        maxApplicants: true,
        applyDeadline: true,
        submitDeadline: true,
        resultsDate: true,
        publishedAt: true,
        extensionsCount: true,
        awardedProjectId: true,
        createdAt: true,
        _count: { select: { applications: true, stages: true } },
      },
    }),
  ]);

  // Entregas reales (ContestEntry) por convocatoria: una sola consulta para
  // todas, en vez de N+1 (mismo patrón que getContestBySlug con las piezas).
  const contestIds = contests.map((contest) => contest.id);
  const entries =
    contestIds.length > 0
      ? await prisma.contestEntry.findMany({
          where: { application: { contestId: { in: contestIds } } },
          select: { application: { select: { contestId: true } } },
        })
      : [];
  const entriesCountByContest = new Map<string, number>();
  for (const entry of entries) {
    const contestId = entry.application.contestId;
    entriesCountByContest.set(contestId, (entriesCountByContest.get(contestId) ?? 0) + 1);
  }

  // Pagos (Fase 3): una sola consulta para todas las convocatorias del
  // client, en vez de N+1.
  const payments =
    contestIds.length > 0 ? await prisma.contestPayment.findMany({ where: { contestId: { in: contestIds } } }) : [];
  const paymentsByContest = new Map<string, (typeof payments)[number][]>();
  for (const payment of payments) {
    const list = paymentsByContest.get(payment.contestId) ?? [];
    list.push(payment);
    paymentsByContest.set(payment.contestId, list);
  }

  // Vencimiento del SPLIT_2 (Términos §3.4): reconciliación pull barata
  // (solo para convocatorias PUBLISHED/SHORTLIST con un PRIZE_SPLIT_2
  // PENDING) + materialización lazy a BREACHED, igual que
  // materializeContestStatus pero disparada por el pago en vez de
  // resultsDate. Nunca se corre en las lecturas públicas de arriba.
  for (const contest of contests) {
    if (contest.status !== "PUBLISHED" && contest.status !== "SHORTLIST") continue;
    const contestPayments = paymentsByContest.get(contest.id) ?? [];
    const split2 = contestPayments.find((payment) => payment.kind === "PRIZE_SPLIT_2");
    if (!split2 || split2.status !== "PENDING") continue;

    if (split2.stripeSessionId) {
      // eslint-disable-next-line no-await-in-loop -- pocas convocatorias por client, secuencial por simplicidad
      await reconcileContestPayments(contest.id);
      // eslint-disable-next-line no-await-in-loop
      const refreshed = await prisma.contestPayment.findUnique({ where: { id: split2.id } });
      if (refreshed) Object.assign(split2, refreshed);
    }

    if (split2.status === "PENDING" && isSplit2PaymentOverdue(contest, split2)) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.contest.update({ where: { id: contest.id }, data: { status: "BREACHED" } });
      contest.status = "BREACHED";
    }
  }

  const nextQuarterlySlotAt =
    publishedLast90Count >= publishLimit && oldestInWindow?.publishedAt
      ? new Date(oldestInWindow.publishedAt.getTime() + NINETY_DAYS_MS).toISOString()
      : null;

  return {
    quota: {
      plan: userIsPro ? "pro" : "free",
      activePublished: activePublishedCount,
      publishedLast90: publishedLast90Count,
      simultaneousLimit: publishLimit,
      quarterlyLimit: publishLimit,
      nextQuarterlySlotAt,
    },
    contests: contests.map((contest) => ({
      id: contest.id,
      slug: contest.slug,
      title: contest.title,
      status: contest.status,
      phase: deriveContestPhase({
        status: contest.status,
        applyDeadline: contest.applyDeadline,
        submitDeadline: contest.submitDeadline,
        resultsDate: contest.resultsDate,
        maxApplicants: contest.maxApplicants,
        applicationCount: contest._count.applications,
      }),
      prizeAmount: Number(contest.prizeAmount),
      currency: contest.currency,
      prizeType: contest.prizeType,
      responsibilityAccepted: contest.responsibilityAcceptedAt !== null,
      applyDeadline: contest.applyDeadline.toISOString(),
      submitDeadline: contest.submitDeadline.toISOString(),
      resultsDate: contest.resultsDate.toISOString(),
      publishedAt: contest.publishedAt ? contest.publishedAt.toISOString() : null,
      extensionsCount: contest.extensionsCount,
      applicationsCount: contest._count.applications,
      entriesCount: entriesCountByContest.get(contest.id) ?? 0,
      hasAwardedProject: contest.awardedProjectId !== null,
      stagesCount: contest._count.stages,
      createdAt: contest.createdAt.toISOString(),
      payments: (paymentsByContest.get(contest.id) ?? []).map((payment) => ({
        kind: payment.kind as ContestPaymentKind,
        status: payment.status as ContestPaymentStatus,
        amount: Number(payment.amount),
        currency: payment.currency,
        dueAt: payment.dueAt ? payment.dueAt.toISOString() : null,
        paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      })),
    })),
  };
}

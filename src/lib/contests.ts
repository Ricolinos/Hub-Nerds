import { prisma } from "@/lib/prisma";
import type { ContestApplicationStatus, ContestStatus, EntryPlacement } from "@/generated/prisma/client";
import { isFreelancerRole } from "@/lib/roles";

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

export interface ContestDetail extends ContestSummary {
  brief: unknown;
  terms: unknown;
  rightsPolicy: string | null;
  awardedProjectId: string | null;
  client: ContestUserSummary;
  applications: ContestApplicationDetail[];
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

/* ══ Queries ═══════════════════════════════════════════════════════════ */

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

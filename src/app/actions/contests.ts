"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NotificationType, Prisma } from "@/generated/prisma/client";
import { slugifyTitle } from "@/lib/caseStudies";
import { canApplyToContest, deriveContestPhase } from "@/lib/contests";
import { prisma } from "@/lib/prisma";
import { isValidProjectSubtype, isValidProjectType } from "@/lib/projectTypes";

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
): Promise<Result<{ contestId: string; slug: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== "client") {
    return { ok: false, error: "Solo un client puede crear convocatorias." };
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
  maxApplicants?: number | null;
  shortlistSize?: number;
  applyDeadline?: string;
  submitDeadline?: string;
  resultsDate?: string;
  rightsPolicy?: string | null;
}

// Solo el client dueño, y solo mientras la convocatoria siga en DRAFT
// (una vez PUBLISHED, applyToContest ya pudo haberse llamado con estos datos).
export async function updateContest(contestId: string, data: UpdateContestInput): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const contest = await prisma.contest.findUnique({
    where: { id: contestId },
    select: { clientId: true, status: true, projectType: true },
  });
  if (!contest) return { ok: false, error: "Convocatoria no encontrada." };
  if (contest.clientId !== userId) return { ok: false, error: "No autorizado" };
  if (contest.status !== "DRAFT") {
    return { ok: false, error: "Solo se puede editar una convocatoria en borrador." };
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

// Solo el client dueño. Valida el mínimo viable para abrir postulaciones
// (título, brief, montos, tamaño de Terna, orden y futuro de las fechas).
export async function publishContest(contestId: string): Promise<Result> {
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

  await prisma.contest.update({ where: { id: contestId }, data: { status: "PUBLISHED" } });

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
): Promise<Result<{ applicationId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedPitch = pitch.trim();
  if (!trimmedPitch) return { ok: false, error: "El pitch es obligatorio." };

  const uniquePieceIds = Array.from(new Set(portfolioPieceIds));

  try {
    const applicationId = await prisma.$transaction(async (tx) => {
      const [user, contest] = await Promise.all([
        tx.user.findUnique({ where: { id: userId }, select: { role: true } }),
        tx.contest.findUnique({ where: { id: contestId } }),
      ]);
      if (!contest) throw new ContestActionError("Convocatoria no encontrada.");

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

import { prisma } from "@/lib/prisma";
import { materializeContestStatus } from "@/lib/contests";
import type { ContestStatus } from "@/generated/prisma/client";

/* ══ Récords privados de Brief-hub, siempre derivados por agregación en el ══
   ══ momento de la consulta (nunca contadores persistidos, para no ══
   ══ desincronizarse de los datos reales). ═══════════════════════════════ */

export interface FreelancerContestRecord {
  // Postulaciones enviadas, sin contar las retiradas (WITHDRAWN)
  participated: number;
  // Postulaciones que llegaron a la Terna de finalistas
  shortlisted: number;
  // Entries con placement FINALIST (terna que no ganó)
  finalist: number;
  // Entries con placement WINNER
  won: number;
}

export async function getFreelancerContestRecord(userId: string): Promise<FreelancerContestRecord> {
  const [participated, shortlisted, finalist, won] = await Promise.all([
    prisma.contestApplication.count({
      where: { freelancerId: userId, status: { not: "WITHDRAWN" } },
    }),
    prisma.contestApplication.count({
      where: { freelancerId: userId, status: "SHORTLISTED" },
    }),
    prisma.contestEntry.count({
      where: { placement: "FINALIST", application: { freelancerId: userId } },
    }),
    prisma.contestEntry.count({
      where: { placement: "WINNER", application: { freelancerId: userId } },
    }),
  ]);

  return { participated, shortlisted, finalist, won };
}

export interface ClientContestRecord {
  // Convocatorias que salieron del borrador y no fueron canceladas
  created: number;
  // Convocatorias con fallo emitido (AWARDED)
  awarded: number;
  // Convocatorias incumplidas (sin fallo BREACH_GRACE_DAYS después de resultsDate)
  breached: number;
  // Máximo de convocatorias abiertas simultáneamente (barrido de eventos
  // createdAt → resultsDate sobre las no DRAFT/CANCELLED)
  maxConcurrent: number;
  // Suma de prizeAmount de las AWARDED + shortlistFee × nº de finalistas
  // (SHORTLISTED) de cada una de esas convocatorias
  totalInvested: number;
  // awarded / (awarded + breached); null si el client no tiene ninguna de
  // las dos todavía (no hay suficiente historial para calcular una tasa)
  complianceRate: number | null;
}

export async function getClientContestRecord(userId: string): Promise<ClientContestRecord> {
  const contests = await prisma.contest.findMany({
    where: { clientId: userId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      resultsDate: true,
      prizeAmount: true,
      shortlistFee: true,
      applications: { select: { status: true } },
    },
  });

  // Materializa BREACHED de forma lazy antes de contar (mismo criterio que
  // src/lib/contests.ts): una convocatoria PUBLISHED/SHORTLIST cuyo plazo de
  // gracia post-resultsDate ya venció cuenta como incumplida aunque nadie
  // haya vuelto a leerla todavía.
  const resolved: { status: ContestStatus; createdAt: Date; resultsDate: Date; prizeAmount: unknown; shortlistFee: unknown; applications: { status: string }[] }[] = [];
  for (const contest of contests) {
    const status = await materializeContestStatus(contest);
    resolved.push({ ...contest, status });
  }

  const created = resolved.filter((c) => c.status !== "DRAFT" && c.status !== "CANCELLED").length;
  const awardedContests = resolved.filter((c) => c.status === "AWARDED");
  const awarded = awardedContests.length;
  const breached = resolved.filter((c) => c.status === "BREACHED").length;

  // Barrido de eventos: una convocatoria se considera "abierta" desde que
  // deja el borrador (createdAt, aproximación de su publicación real) hasta
  // su resultsDate. maxConcurrent = máximo de solapamientos simultáneos.
  const openContests = resolved.filter((c) => c.status !== "DRAFT" && c.status !== "CANCELLED");
  const events: { time: number; delta: 1 | -1 }[] = [];
  for (const contest of openContests) {
    events.push({ time: contest.createdAt.getTime(), delta: 1 });
    events.push({ time: contest.resultsDate.getTime(), delta: -1 });
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let concurrent = 0;
  let maxConcurrent = 0;
  for (const event of events) {
    concurrent += event.delta;
    if (concurrent > maxConcurrent) maxConcurrent = concurrent;
  }

  const totalInvested = awardedContests.reduce((sum, contest) => {
    const finalistCount = contest.applications.filter((a) => a.status === "SHORTLISTED").length;
    return sum + Number(contest.prizeAmount) + Number(contest.shortlistFee) * finalistCount;
  }, 0);

  const complianceRate = awarded + breached > 0 ? awarded / (awarded + breached) : null;

  return { created, awarded, breached, maxConcurrent, totalInvested, complianceRate };
}

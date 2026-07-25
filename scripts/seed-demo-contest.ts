// Seed de una convocatoria demo de Brief-hub (client_demo) con una
// postulación de freelancer_demo. Idempotente: upsert por slug de la
// convocatoria y por el par (contestId, freelancerId) de la postulación.
// Requiere haber corrido antes `npm run seed:demo` (crea client_demo y
// freelancer_demo). Ejecutar: npm run seed:contest (o npx tsx scripts/seed-demo-contest.ts)
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const CONTEST_SLUG = "branding-cafeteria-demo";
const CONTEST_TITLE = "Branding completo para cafetería de especialidad";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

async function main() {
  const client = await prisma.user.findUnique({
    where: { username: "client_demo" },
    select: { id: true },
  });
  if (!client) {
    throw new Error(
      "No existe client_demo. Corre primero `npm run seed:demo` para crear los usuarios demo.",
    );
  }

  const freelancer = await prisma.user.findUnique({
    where: { username: "freelancer_demo" },
    select: { id: true },
  });
  if (!freelancer) {
    throw new Error(
      "No existe freelancer_demo. Corre primero `npm run seed:demo` para crear los usuarios demo.",
    );
  }

  const contest = await prisma.contest.upsert({
    where: { slug: CONTEST_SLUG },
    update: {
      title: CONTEST_TITLE,
      brief: DEMO_BRIEF,
      prizeAmount: "15000.00",
      currency: "MXN",
      shortlistFee: "1500.00",
      shortlistSize: 3,
      applyDeadline: daysFromNow(7),
      submitDeadline: daysFromNow(21),
      resultsDate: daysFromNow(28),
      status: "PUBLISHED",
      projectType: "Diseño gráfico",
      projectSubtype: "Branding completo",
      clientId: client.id,
    },
    create: {
      slug: CONTEST_SLUG,
      title: CONTEST_TITLE,
      brief: DEMO_BRIEF,
      prizeAmount: "15000.00",
      currency: "MXN",
      shortlistFee: "1500.00",
      shortlistSize: 3,
      applyDeadline: daysFromNow(7),
      submitDeadline: daysFromNow(21),
      resultsDate: daysFromNow(28),
      status: "PUBLISHED",
      projectType: "Diseño gráfico",
      projectSubtype: "Branding completo",
      clientId: client.id,
    },
    select: { id: true, slug: true },
  });
  console.log(`🏆 Prisma: upsert de la convocatoria demo "${contest.slug}" (${contest.id})`);

  // Postulación con una pieza real del portafolio de freelancer_demo, si existe
  // alguna (misma idea que seedPortfolio en seed-demo-users.ts: reutiliza lo
  // ya sembrado en vez de inventar datos nuevos).
  const piece = await prisma.portfolioPiece.findFirst({
    where: { userId: freelancer.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const portfolioPieceIds = piece ? [piece.id] : [];

  const application = await prisma.contestApplication.upsert({
    where: { contestId_freelancerId: { contestId: contest.id, freelancerId: freelancer.id } },
    update: {
      pitch: DEMO_PITCH,
      portfolioPieceIds,
    },
    create: {
      contestId: contest.id,
      freelancerId: freelancer.id,
      pitch: DEMO_PITCH,
      portfolioPieceIds,
    },
    select: { id: true },
  });
  console.log(
    `📝 Prisma: upsert de la postulación demo de freelancer_demo (${application.id}), ${portfolioPieceIds.length} pieza(s) de portafolio adjunta(s)`,
  );
}

const DEMO_BRIEF = [
  {
    type: "paragraph",
    content:
      "Buscamos una identidad de marca completa (logotipo, paleta, tipografía y aplicaciones) para una cafetería de especialidad que abre su segunda sucursal.",
  },
  {
    type: "paragraph",
    content:
      "Entregables esperados: logotipo principal + variantes, paleta de color, tipografía, mockups de empaque y señalética básica.",
  },
];

const DEMO_PITCH =
  "Tengo experiencia reciente en branding para cafeterías de especialidad (ver pieza adjunta) y puedo entregar un sistema de marca flexible para ambas sucursales dentro del plazo.";

main()
  .catch((error) => {
    console.error("❌ Error en seed de convocatoria demo:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

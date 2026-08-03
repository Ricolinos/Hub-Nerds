// Verificación de solo lectura de los mínimos de perfil de los 2 usuarios
// demo (ver scripts/seed-demo-users.ts). Deliberadamente acotado por
// `username IN (client_demo, freelancer_demo)`: no imprime ni toca datos de
// ningún otro usuario de la BD compartida.
// Ejecutar: npx tsx scripts/check-demo-users.ts
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const DEMO_USERNAMES = ["client_demo", "freelancer_demo"] as const;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { in: [...DEMO_USERNAMES] } },
    select: {
      id: true,
      username: true,
      role: true,
      primaryRole: true,
      bio: true,
      company: true,
      brand: true,
      headline: true,
    },
  });
  console.log("── Usuarios demo (mínimos de perfil) ──");
  console.log(JSON.stringify(users, null, 2));

  const pieces = await prisma.portfolioPiece.findMany({
    where: { user: { username: "freelancer_demo" } },
    select: { id: true, title: true, markdownContent: true },
  });
  console.log("\n── Piezas de portafolio de freelancer_demo (markdownContent) ──");
  console.log(
    JSON.stringify(
      pieces.map((p) => ({ id: p.id, title: p.title, hasMarkdown: Boolean(p.markdownContent?.trim()) })),
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("❌ Error en la verificación de usuarios demo:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// Seed de usuarios demo reales en Clerk + Supabase con proyectos de prueba.
// Idempotente: reutiliza usuarios de Clerk existentes (por email) y
// recrea los proyectos demo en cada corrida.
// Ejecutar: npm run seed:demo  (o npx tsx scripts/seed-demo-users.ts)
import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

interface DemoUser {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "client" | "freelancer";
  whatsapp: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "client.demo+clerk_test@hubnerds.com",
    username: "client_demo",
    password: "ClientDemo!2026#hub",
    firstName: "Carla",
    lastName: "Client",
    role: "client",
    whatsapp: "+52 55 1234 5678",
  },
  {
    email: "freelancer.demo+clerk_test@hubnerds.com",
    username: "freelancer_demo",
    password: "FreelancerDemo!2026#hub",
    firstName: "Pablo",
    lastName: "Freelancer",
    role: "freelancer",
    whatsapp: "+52 55 8765 4321",
  },
];

function demoCalculationData(concepto: string, total: number) {
  return {
    columns: ["fase", "horas", "tarifa", "subtotal"],
    rows: [{ fase: concepto, horas: 10, tarifa: total / 10, subtotal: total }],
    summary: { subtotal: total, descuento: 0, total },
  };
}

interface DemoQuote {
  title: string;
  status: string;
  total: number;
}

const CLIENT_QUOTES: DemoQuote[] = [
  { title: "Branding Restaurante La Milpa", status: "draft", total: 8500 },
  { title: "Videobug Torneo Verano", status: "active", total: 12000 },
  { title: "Plecas Animadas Noticiero", status: "completed", total: 6800 },
];

const FREELANCER_QUOTES: DemoQuote[] = [
  { title: "Wipper Canal Deportes", status: "sent", total: 4500 },
  { title: "Motion Graphics Expo CDMX", status: "active", total: 15000 },
];

interface DemoPiece {
  title: string;
  description: string;
  category: string;
  coverUrl: string;
  views: number;
  likes: number;
  // false = borrador: solo visible para el dueño en su perfil
  isPublic?: boolean;
}

// Categorías alineadas con CATEGORY_SLUGS de /explorar (Animación, Branding, Ilustración)
const FREELANCER_PIECES: DemoPiece[] = [
  {
    title: "Intro Animada Torneo Clausura",
    description: "Secuencia de apertura para transmisión deportiva, con transiciones de logo en 3D.",
    category: "Animación",
    coverUrl: "/images/gallery/img-01.jpg",
    views: 18400,
    likes: 2380,
  },
  {
    title: "Identidad Visual Café Madrugada",
    description: "Sistema de marca completo para cafetería de especialidad: logo, paleta y aplicaciones.",
    category: "Branding",
    coverUrl: "/images/gallery/img-02.jpg",
    views: 12200,
    likes: 1540,
  },
  {
    title: "Serie Editorial Nocturna",
    description: "Set de ilustraciones editoriales para revista digital de cultura nocturna.",
    category: "Ilustración",
    coverUrl: "/images/gallery/img-03.jpg",
    views: 9600,
    likes: 980,
  },
  {
    title: "Wipper Deportivo 3D",
    description: "Cortinilla animada para canal de deportes con tipografía cinética.",
    category: "Animación",
    coverUrl: "/images/gallery/img-04.jpg",
    views: 15800,
    likes: 2010,
  },
  {
    title: "Packaging Sabor Local",
    description: "Branding y empaque para línea de salsas artesanales mexicanas.",
    category: "Branding",
    coverUrl: "/images/gallery/img-05.jpg",
    views: 7300,
    likes: 640,
    isPublic: false,
  },
  {
    title: "Stickers Festival Río Sonoro",
    description: "Colección de stickers ilustrados para festival de música independiente.",
    category: "Ilustración",
    coverUrl: "/images/gallery/img-06.jpg",
    views: 5100,
    likes: 760,
    isPublic: false,
  },
];

async function ensureClerkUser(demo: DemoUser): Promise<string> {
  const existing = await clerk.users.getUserList({ emailAddress: [demo.email] });
  if (existing.data.length > 0) {
    const user = existing.data[0];
    console.log(`♻️  Clerk: ${demo.email} ya existe (${user.id})`);
    return user.id;
  }

  const created = await clerk.users.createUser({
    emailAddress: [demo.email],
    username: demo.username,
    password: demo.password,
    firstName: demo.firstName,
    lastName: demo.lastName,
    publicMetadata: { role: demo.role, whatsapp: demo.whatsapp },
  });
  console.log(`✨ Clerk: usuario creado ${demo.email} (${created.id})`);
  return created.id;
}

async function seedQuotes(userId: string, quotes: DemoQuote[], clientName: string) {
  // Idempotencia: borra los proyectos previos de este usuario demo.
  await prisma.projectQuote.deleteMany({ where: { userId } });
  for (const quote of quotes) {
    await prisma.projectQuote.create({
      data: {
        userId,
        title: quote.title,
        clientName,
        status: quote.status,
        currency: "MXN",
        total: quote.total.toFixed(2),
        calculationData: demoCalculationData(quote.title, quote.total),
      },
    });
  }
  console.log(`💰 ${quotes.length} proyectos demo creados para ${userId}`);
}

async function seedPortfolio(userId: string, pieces: DemoPiece[], location: string) {
  // Idempotencia: borra las piezas previas de este usuario demo.
  await prisma.portfolioPiece.deleteMany({ where: { userId } });
  for (const piece of pieces) {
    await prisma.portfolioPiece.create({
      data: { userId, location, ...piece },
    });
  }
  console.log(`🎨 ${pieces.length} piezas de portafolio creadas para ${userId}`);
}

async function main() {
  const ids: Record<string, string> = {};

  for (const demo of DEMO_USERS) {
    const clerkId = await ensureClerkUser(demo);
    ids[demo.username] = clerkId;

    const name = `${demo.firstName} ${demo.lastName}`;
    await prisma.user.upsert({
      where: { id: clerkId },
      update: {
        email: demo.email,
        username: demo.username,
        name,
        role: demo.role,
        whatsapp: demo.whatsapp,
      },
      create: {
        id: clerkId,
        email: demo.email,
        username: demo.username,
        name,
        role: demo.role,
        whatsapp: demo.whatsapp,
      },
    });
    console.log(`👤 Prisma: upsert de ${demo.username} (${clerkId})`);
  }

  await seedQuotes(ids.client_demo, CLIENT_QUOTES, "Carla Client");
  await seedQuotes(ids.freelancer_demo, FREELANCER_QUOTES, "Pablo Freelancer");
  await seedPortfolio(ids.freelancer_demo, FREELANCER_PIECES, "Ciudad de México, MX");

  console.log("\n═══════════════ CREDENCIALES DEMO ═══════════════");
  for (const demo of DEMO_USERS) {
    console.log(`\n  Rol:      ${demo.role}${demo.role === "freelancer" ? " (Freelancer)" : ""}`);
    console.log(`  Clerk ID: ${ids[demo.username]}`);
    console.log(`  Email:    ${demo.email}`);
    console.log(`  Username: ${demo.username}`);
    console.log(`  Password: ${demo.password}`);
  }
  console.log("\n  (Emails +clerk_test: código de verificación 424242 en dev)");
  console.log("══════════════════════════════════════════════════");
}

main()
  .catch((error) => {
    console.error("❌ Error en seed de usuarios demo:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

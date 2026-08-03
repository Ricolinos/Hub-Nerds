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
// Import directo del módulo (no del barrel src/resources/index.ts): ese
// barrel re-exporta once-ui.config.ts, que no es seguro de importar fuera
// del runtime de Next. legal.ts es solo constantes, sin JSX.
import { LEGAL_VERSION } from "../src/resources/legal";

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
  // Mínimos de perfil (ver src/lib/onboarding.ts, isProfileComplete /
  // isClientProfileComplete): sin ellos el demo cae en loop de /bienvenida
  // (freelancer) o de /complete-profile (client). Mismos valores con los
  // que la auditoría reparó a mano las filas vivas (2026-08-03).
  primaryRole?: string;
  headline?: string;
  bio?: string;
  company?: string;
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
    company: "Empresa de demostración",
  },
  {
    email: "freelancer.demo+clerk_test@hubnerds.com",
    username: "freelancer_demo",
    password: "FreelancerDemo!2026#hub",
    firstName: "Pablo",
    lastName: "Freelancer",
    role: "freelancer",
    whatsapp: "+52 55 8765 4321",
    primaryRole: "Diseñador de Marca",
    headline: "Diseñador de Marca",
    bio: "Diseñador de marca. Cuenta de demostración de Hub-Nerds.",
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
  // Nombre del client que contrató este proyecto. Opcional: si se omite,
  // seedQuotes cae al clientName por defecto que recibe como parámetro.
  clientName?: string;
}

const CLIENT_QUOTES: DemoQuote[] = [
  { title: "Branding Restaurante La Milpa", status: "draft", total: 8500 },
  { title: "Videobug Torneo Verano", status: "active", total: 12000 },
  { title: "Plecas Animadas Noticiero", status: "completed", total: 6800 },
];

// Estos son proyectos que freelancer_demo cotizó para SUS PROPIOS clients
// (empresas externas) — nunca debe usarse aquí el nombre del propio freelancer,
// o el panel "Clients" de su perfil público termina mostrándolo a él mismo.
const FREELANCER_QUOTES: DemoQuote[] = [
  { title: "Wipper Canal Deportes", status: "sent", total: 4500, clientName: "TV Azteca Deportes" },
  {
    title: "Motion Graphics Expo CDMX",
    status: "active",
    total: 15000,
    clientName: "Expo CDMX Producciones",
  },
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

// Mismo formato exacto que escribe el alta real (ver completeProfile.ts /
// SignUpForm.tsx): termsAcceptedAt/termsVersion en publicMetadata. El
// gate de src/app/dashboard/page.tsx solo lee esas dos claves — sin ellas
// el demo rebota a /complete-profile en cada login.
function withTermsMetadata(
  demo: DemoUser,
  currentMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...currentMetadata,
    role: demo.role,
    whatsapp: demo.whatsapp,
    // Preserva el termsAcceptedAt ya existente (no lo pisa en cada re-seed);
    // solo lo siembra si todavía falta.
    termsAcceptedAt: currentMetadata.termsAcceptedAt ?? new Date().toISOString(),
    termsVersion: LEGAL_VERSION,
  };
}

async function ensureClerkUser(demo: DemoUser): Promise<string> {
  const existing = await clerk.users.getUserList({ emailAddress: [demo.email] });
  if (existing.data.length > 0) {
    const user = existing.data[0];
    // Reconcilia metadata en usuarios ya existentes: un demo sembrado antes
    // de esta auditoría puede no tener termsAcceptedAt/termsVersion.
    await clerk.users.updateUser(user.id, {
      publicMetadata: withTermsMetadata(demo, user.publicMetadata as Record<string, unknown>),
    });
    console.log(`♻️  Clerk: ${demo.email} ya existe (${user.id})`);
    return user.id;
  }

  const created = await clerk.users.createUser({
    emailAddress: [demo.email],
    username: demo.username,
    password: demo.password,
    firstName: demo.firstName,
    lastName: demo.lastName,
    publicMetadata: withTermsMetadata(demo),
  });
  console.log(`✨ Clerk: usuario creado ${demo.email} (${created.id})`);
  return created.id;
}

async function seedQuotes(userId: string, quotes: DemoQuote[], defaultClientName: string) {
  // Idempotencia: borra los proyectos previos de este usuario demo.
  await prisma.projectQuote.deleteMany({ where: { userId } });
  for (const quote of quotes) {
    await prisma.projectQuote.create({
      data: {
        userId,
        title: quote.title,
        clientName: quote.clientName ?? defaultClientName,
        status: quote.status,
        currency: "MXN",
        total: quote.total.toFixed(2),
        calculationData: demoCalculationData(quote.title, quote.total),
      },
    });
  }
  console.log(`💰 ${quotes.length} proyectos demo creados para ${userId}`);
}

// Markdown mínimo pero digno por pieza: heading + párrafo + portada como
// Media. Mismo formato que produce blocksToMarkdown() en
// src/components/profile/ContentBlocks.tsx (NO se importa ese archivo aquí:
// es browser-only) para un bloque "Texto" sin overrides de estilo (ver
// blockToMarkdown, case "text", camino "sin cambios") seguido de un bloque
// "Imagen" (case "image", `![alt](url)`). Sin esto, el visor
// /<username>/proyecto/<slug> cae al fallback de archivo .mdx legado (ver
// loadCaseStudy en el visor) y da 404 porque freelancer_demo no tiene
// ninguno en src/content/portfolio.
//
// El heading va como Markdown puro (`## `) en vez de con el `---` que
// antepone el bloque "Nueva sección" (case "section"): al ser SIEMPRE el
// primer bloque de la pieza, ese separador dejaría un divisor huérfano
// arriba de todo el artículo sin nada que dividir.
function demoPieceMarkdown(piece: DemoPiece): string {
  return [
    `## ${piece.title}`,
    `<Text variant="body-default-m" onBackground="neutral-medium">\n${piece.description}\n</Text>`,
    `![${piece.title}](${piece.coverUrl})`,
  ].join("\n\n");
}

async function seedPortfolio(userId: string, pieces: DemoPiece[], location: string) {
  // Idempotencia: borra las piezas previas de este usuario demo.
  await prisma.portfolioPiece.deleteMany({ where: { userId } });
  for (const piece of pieces) {
    await prisma.portfolioPiece.create({
      data: { userId, location, markdownContent: demoPieceMarkdown(piece), ...piece },
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
    // Mínimos de perfil (ver src/lib/onboarding.ts): primaryRole/bio para el
    // freelancer, company para el client. Sin esto, shouldSeeOnboarding()
    // manda al demo a /bienvenida en cada login.
    const profileMinimums = {
      primaryRole: demo.primaryRole,
      headline: demo.headline,
      bio: demo.bio,
      company: demo.company,
    };
    await prisma.user.upsert({
      where: { id: clerkId },
      update: {
        email: demo.email,
        username: demo.username,
        name,
        role: demo.role,
        whatsapp: demo.whatsapp,
        ...profileMinimums,
      },
      create: {
        id: clerkId,
        email: demo.email,
        username: demo.username,
        name,
        role: demo.role,
        whatsapp: demo.whatsapp,
        ...profileMinimums,
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

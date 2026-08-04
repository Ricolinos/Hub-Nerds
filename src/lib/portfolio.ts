import type { PublicFreelancerResult } from "@/app/actions/portfolioPieces";
import type { Shout } from "@/components/explore/ExploreFeed";
import { caseStudyHref } from "@/lib/caseStudies";
import { prisma } from "@/lib/prisma";
import { FREELANCER_ROLE_VALUES } from "@/lib/roles";

// Feed de piezas de portafolio con su autor: alimenta HomeShowcase y ExploreFeed.
// Solo piezas públicas: los borradores viven únicamente en el perfil del dueño.
//
// PERF: este feed usa `select` explícito, NO `include`. Con `include` Prisma
// trae TODAS las columnas de PortfolioPiece, incluidas las pesadas que ninguna
// tarjeta del feed muestra: `contentBlocks` y `markdownContent` (~1.4 MB cada
// una en la BD actual), más `gallery` y `caseStudy`. Medido contra la base
// real: 6 piezas públicas pesaban 3.48 MB serializados y la consulta tardaba
// ~71 s; con este select baja a los pocos campos que sí se pintan. La causa de
// fondo es que las piezas viejas guardan imágenes como data URL en base64
// dentro de esas columnas (ver comentarios en prisma/schema.prisma).
const FEED_WHERE = { isPublic: true, coverUrl: { not: null } } as const;

export async function getPortfolioFeed() {
  const [pieces, withMarkdown] = await Promise.all([
    prisma.portfolioPiece.findMany({
      // Piezas creadas desde el editor de Markdown sin portada no entran al
      // showcase visual de Home/Explorar, pero sí quedan en el perfil del Freelancer.
      where: FEED_WHERE,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        coverUrl: true,
        location: true,
        likes: true,
        views: true,
        user: { select: { name: true, username: true, imageUrl: true, plan: true } },
      },
    }),
    // Los consumidores solo necesitan SABER si la pieza tiene markdown (para
    // elegir la forma del enlace en caseStudyHref), nunca su contenido. Prisma
    // no puede proyectar `markdownContent IS NOT NULL` en un select, así que se
    // resuelve con esta consulta aparte que devuelve solo ids: sigue siendo
    // ordenes de magnitud más barata que arrastrar el texto completo.
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "PortfolioPiece"
      WHERE "isPublic" = true
        AND "coverUrl" IS NOT NULL
        AND "markdownContent" IS NOT NULL
        AND "markdownContent" <> ''
    `,
  ]);

  const markdownIds = new Set(withMarkdown.map((row) => row.id));
  const withHasMarkdown = pieces.map((piece) => ({
    ...piece,
    hasMarkdown: markdownIds.has(piece.id),
  }));
  return rankFeedWithProPriority(withHasMarkdown);
}

// Piezas de Freelancers plan "pro": múltiplo de peso frente a una pieza free
// (ajustado por simulación: con pocas piezas Pro en el catálogo, 3x no basta
// para que dominen los primeros slots la mayoría de las veces — ver el
// script de tuning en el reporte de la tarea; 6x sí, sin llegar a fijar el
// orden).
const PRO_WEIGHT_MULTIPLIER = 6;

// Baraja ponderada con prioridad Pro para el feed (Home + Explorar). Piezas
// de Freelancers plan "pro" pesan PRO_WEIGHT_MULTIPLIER veces las free, con
// un boost leve por recencia dentro de cada grupo para que la rotación no se
// estanque siempre en las mismas piezas. NO es un ranking estático: usa priority sampling
// ponderado sin reemplazo (Efraimidis-Spirakis: key = u^(1/peso), ordenar
// desc por key), así que el orden varía en cada llamada aunque las piezas Pro
// tiendan a subir. Con 0 piezas Pro todos los pesos quedan iguales salvo el
// boost de recencia, así que degrada a un shuffle suave por recencia (hoy
// ningún usuario es Pro: el feed sigue viéndose como un shuffle normal).
//
// `rng` es inyectable (default Math.random) para poder testear la
// distribución de forma determinística.
export function rankFeedWithProPriority<
  T extends { user: { plan?: string | null }; createdAt?: Date | string | null },
>(pieces: readonly T[], rng: () => number = Math.random): T[] {
  const total = pieces.length;
  if (total === 0) return [];

  const timestamps = pieces.map((piece) => {
    const raw = piece.createdAt;
    if (!raw) return null;
    const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    return Number.isFinite(time) ? time : null;
  });
  const validTimestamps = timestamps.filter((time): time is number => time !== null);
  const maxTime = validTimestamps.length ? Math.max(...validTimestamps) : null;
  const minTime = validTimestamps.length ? Math.min(...validTimestamps) : null;
  const timeRange = maxTime !== null && minTime !== null ? maxTime - minTime : 0;

  const keyed = pieces.map((piece, index) => {
    const isPro = piece.user.plan === "pro";
    const baseWeight = isPro ? PRO_WEIGHT_MULTIPLIER : 1;

    let recencyBoost: number;
    const time = timestamps[index];
    if (time !== null && timeRange > 0 && minTime !== null) {
      // Más reciente → boost cercano a 1.5x; más viejo del rango → 1x.
      recencyBoost = 1 + 0.5 * ((time - minTime) / timeRange);
    } else if (total > 1) {
      // Sin fechas usables (createdAt no viaja en el `select`): el array ya
      // llega ordenado por createdAt desc (ver `orderBy` arriba), así que la
      // posición sirve de proxy de recencia.
      recencyBoost = 1 + 0.5 * (1 - index / (total - 1));
    } else {
      recencyBoost = 1;
    }

    const weight = baseWeight * recencyBoost;
    // u acotado a (0,1) abierto: u=0 o u=1 harían key = 0/Infinity y romperían
    // el orden.
    const u = Math.min(Math.max(rng(), Number.EPSILON), 1 - Number.EPSILON);
    const key = Math.pow(u, 1 / weight);
    return { piece, key };
  });

  keyed.sort((a, b) => b.key - a.key);
  return keyed.map((entry) => entry.piece);
}

export function toShouts(feed: Awaited<ReturnType<typeof getPortfolioFeed>>): Shout[] {
  return feed.map((piece) => ({
    id: piece.id,
    author: piece.user.name ?? piece.user.username ?? "Creativo",
    avatar: piece.user.imageUrl,
    category: piece.category,
    title: piece.title,
    // Descripción breve opcional (PortfolioPiece.description, máx. 140
    // caracteres): antes de que este campo existiera en la UI, `description`
    // hacía doble función como "texto secundario de la card" con fallback a
    // `title` — ahora que el título ya se muestra aparte (ver `title` arriba
    // y ShoutCard en ExploreFeed.tsx), `description` vuelve a ser lo que su
    // nombre indica: null cuando el Freelancer no la llenó, sin fallback.
    description: piece.description,
    // La consulta ya filtra coverUrl no nulo; el fallback solo satisface al tipo.
    image: piece.coverUrl ?? "",
    likes: piece.likes,
    href: piece.user.username
      ? caseStudyHref(piece.user.username, piece.title, piece.hasMarkdown)
      : undefined,
  }));
}

// Mismo `select` y criterio de "freelancer público" que searchPublicFreelancers
// (src/app/actions/portfolioPieces.ts), pero SIN auth(): a diferencia del
// buscador del editor (solo usuarios logueados etiquetando colaboradores),
// esta función la usa la página pública del caso de estudio
// (/[username]/proyecto/[slug]), que ven visitantes anónimos — no puede
// depender de una server action con sesión obligatoria.
//
// PortfolioPiece.collaborators guarda usernames en el ORDEN que eligió el
// autor; un `where username in (...)` no preserva ese orden, así que se
// reordena en memoria contra la lista de entrada. Un username puede haber
// dejado de existir, vuelto privado o dejado de ser freelancer: esos
// simplemente se omiten (nunca rompe la página ni deja huecos). Una sola
// consulta para todos los usernames.
export async function getPublicFreelancersByUsernames(
  usernames: string[],
): Promise<PublicFreelancerResult[]> {
  if (usernames.length === 0) return [];

  const freelancers = await prisma.user.findMany({
    where: {
      username: { in: usernames },
      role: { in: FREELANCER_ROLE_VALUES },
      isPublic: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
      imageUrl: true,
      headline: true,
      primaryRole: true,
    },
  });

  const byUsername = new Map(freelancers.map((freelancer) => [freelancer.username, freelancer]));

  const ordered: PublicFreelancerResult[] = [];
  for (const username of usernames) {
    const freelancer = byUsername.get(username);
    if (!freelancer?.username) continue;
    ordered.push({
      id: freelancer.id,
      username: freelancer.username,
      name: freelancer.name,
      imageUrl: freelancer.imageUrl,
      headline: freelancer.headline,
      primaryRole: freelancer.primaryRole,
    });
  }
  return ordered;
}

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
        user: { select: { name: true, username: true, imageUrl: true } },
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
  return pieces.map((piece) => ({ ...piece, hasMarkdown: markdownIds.has(piece.id) }));
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

import { prisma } from "@/lib/prisma";
import type { Shout } from "@/components/explore/ExploreFeed";
import { caseStudyHref } from "@/lib/caseStudies";

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

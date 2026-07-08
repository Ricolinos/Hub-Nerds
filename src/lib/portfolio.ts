import { prisma } from "@/lib/prisma";
import type { Shout } from "@/components/explore/ExploreFeed";
import { caseStudyHref } from "@/lib/caseStudies";

// Feed de piezas de portafolio con su autor: alimenta HomeShowcase y ExploreFeed.
// Solo piezas públicas: los borradores viven únicamente en el perfil del dueño.
export async function getPortfolioFeed() {
  return prisma.portfolioPiece.findMany({
    // Piezas creadas desde el editor de Markdown sin portada no entran al
    // showcase visual de Home/Explorar, pero sí quedan en el perfil del Partner.
    where: { isPublic: true, coverUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, username: true, imageUrl: true } },
    },
  });
}

export function toShouts(feed: Awaited<ReturnType<typeof getPortfolioFeed>>): Shout[] {
  return feed.map((piece) => ({
    id: piece.id,
    author: piece.user.name ?? piece.user.username ?? "Partner",
    avatar: piece.user.imageUrl,
    category: piece.category,
    description: piece.description ?? piece.title,
    // La consulta ya filtra coverUrl no nulo; el fallback solo satisface al tipo.
    image: piece.coverUrl ?? "",
    likes: piece.likes,
    href: piece.user.username ? caseStudyHref(piece.user.username, piece.title) : undefined,
  }));
}

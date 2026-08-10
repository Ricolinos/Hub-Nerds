"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// Toggle de like sobre un PortfolioPiece: un usuario logueado, un like por
// pieza. PieceLike (tabla puente, @@unique([userId, pieceId])) es la fuente
// de verdad de "quién dio like"; PortfolioPiece.likes es un contador
// denormalizado que se actualiza en la MISMA transacción — así las tarjetas
// de feed (HomeShowcase/ExploreFeed) siguen leyendo un entero simple, sin
// un `_count` por pieza en cada listado.
export async function toggleLike(pieceId: string): Promise<Result<{ liked: boolean; likes: number }>> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Inicia sesión para dar like." };

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: { userId: true },
  });
  if (!piece) return { ok: false, error: "El proyecto ya no existe." };
  // Regla de servidor, no solo de UI: el dueño no puede darse like a su
  // propia pieza (decidido con el usuario) — sin esto, alguien podría
  // llamar la action directamente sin pasar por el LikeButton (que ya
  // oculta el botón activo en piezas propias).
  if (piece.userId === userId) return { ok: false, error: "No puedes darle like a tu propio proyecto." };

  const existing = await prisma.pieceLike.findUnique({
    where: { userId_pieceId: { userId, pieceId } },
    select: { id: true },
  });

  if (existing) {
    const [, updated] = await prisma.$transaction([
      prisma.pieceLike.delete({ where: { id: existing.id } }),
      prisma.portfolioPiece.update({
        where: { id: pieceId },
        data: { likes: { decrement: 1 } },
        select: { likes: true },
      }),
    ]);
    return { ok: true, liked: false, likes: updated.likes };
  }

  const [, updated] = await prisma.$transaction([
    prisma.pieceLike.create({ data: { userId, pieceId } }),
    prisma.portfolioPiece.update({
      where: { id: pieceId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    }),
  ]);
  return { ok: true, liked: true, likes: updated.likes };
}

// Estado de like del visitante actual sobre un lote de piezas: alimenta las
// tarjetas de HomeShowcase/ExploreFeed para saber cuáles ya likeó (y así
// mostrar el corazón lleno + permitir deslikear en vez de dar like de nuevo).
// Anónimos devuelven likedIds vacío y viewerId null (nunca lanza).
export async function getLikeState(
  pieceIds: string[],
): Promise<{ likedIds: string[]; viewerId: string | null }> {
  const { userId } = await auth();
  if (!userId || pieceIds.length === 0) return { likedIds: [], viewerId: userId ?? null };

  const likes = await prisma.pieceLike.findMany({
    where: { userId, pieceId: { in: pieceIds } },
    select: { pieceId: true },
  });
  return { likedIds: likes.map((like) => like.pieceId), viewerId: userId };
}

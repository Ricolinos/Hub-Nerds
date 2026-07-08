"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export interface CreatePortfolioPieceInput {
  title: string;
  content: string;
  downloadUrl?: string;
  resourcePassword?: string;
  isPublic: boolean;
  // URLs (o data URLs) de los archivos adjuntados desde el editor
  gallery?: string[];
  // Máx. 5, validado abajo
  tags?: string[];
  // Usernames de colaboradores, sin validar contra la tabla User todavía
  collaborators?: string[];
  releaseDate?: Date;
}

const MAX_TAGS = 5;

// Crea una pieza de portafolio desde el editor de Markdown del Partner.
// El contenido se guarda como texto plano; siempre queda ligada al usuario
// autenticado vía Clerk, nunca a un userId recibido del cliente.
export async function createPortfolioPiece(input: CreatePortfolioPieceInput): Promise<{ id: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error("El título es obligatorio");
  if (!content) throw new Error("El contenido es obligatorio");

  const piece = await prisma.portfolioPiece.create({
    data: {
      title,
      markdownContent: content,
      downloadUrl: input.downloadUrl?.trim() || null,
      resourcePassword: input.resourcePassword?.trim() || null,
      isPublic: input.isPublic,
      gallery: input.gallery && input.gallery.length > 0 ? input.gallery : undefined,
      tags: (input.tags ?? []).slice(0, MAX_TAGS),
      collaborators: input.collaborators ?? [],
      releaseDate: input.releaseDate ?? null,
      userId,
    },
    select: { id: true },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user?.username) revalidatePath(`/${user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");

  return { id: piece.id };
}

// Cambia la visibilidad de una pieza (público ↔ borrador).
// Solo el dueño de la pieza puede modificarla.
export async function setPieceVisibility(pieceId: string, isPublic: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!piece || piece.userId !== userId) throw new Error("No autorizado");

  await prisma.portfolioPiece.update({
    where: { id: pieceId },
    data: { isPublic },
  });

  // Los borradores desaparecen de perfil público, Explorar y Home.
  if (piece.user.username) revalidatePath(`/${piece.user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");
}

"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/* ══ Mensajería directa client ↔ freelancer ═════════════════════════════
   El hilo vive a nivel Connection (no CollabProject): un client puede
   tener varios proyectos con el mismo freelancer y comparten un solo chat
   vía connectionId. Arranca con polling client-side; Supabase Realtime
   se agrega en un PR posterior. ══════════════════════════════════════ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_MESSAGE_LENGTH = 4000;

export interface MessageData {
  id: string;
  connectionId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string | null; username: string | null; imageUrl: string | null };
}

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

// Solo el client o el freelancer de esa Connection específica están
// autorizados a leer/enviar/marcar como leído su hilo de mensajes.
async function requireConnectionAuth(connectionId: string, userId: string): Promise<Result> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { clientId: true, freelancerId: true },
  });
  if (!connection) return { ok: false, error: "Conexión no encontrada." };
  if (connection.clientId !== userId && connection.freelancerId !== userId) {
    return { ok: false, error: "No autorizado" };
  }
  return { ok: true };
}

export async function getMessages(connectionId: string): Promise<Result<{ messages: MessageData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const auth = await requireConnectionAuth(connectionId, userId);
  if (!auth.ok) return auth;

  const messages = await prisma.message.findMany({
    where: { connectionId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, username: true, imageUrl: true } },
    },
  });

  return {
    ok: true,
    messages: messages.map((message) => ({
      id: message.id,
      connectionId: message.connectionId,
      senderId: message.senderId,
      body: message.body,
      readAt: message.readAt ? message.readAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
    })),
  };
}

export async function sendMessage(connectionId: string, body: string): Promise<Result<{ messageId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const auth = await requireConnectionAuth(connectionId, userId);
  if (!auth.ok) return auth;

  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false, error: "El mensaje no puede estar vacío." };
  if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "El mensaje es demasiado largo." };
  }

  const message = await prisma.message.create({
    data: { connectionId, senderId: userId, body: trimmedBody },
    select: { id: true },
  });

  return { ok: true, messageId: message.id };
}

export async function markMessagesRead(connectionId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const auth = await requireConnectionAuth(connectionId, userId);
  if (!auth.ok) return auth;

  await prisma.message.updateMany({
    where: { connectionId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return { ok: true };
}

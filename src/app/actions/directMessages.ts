"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { NotificationType } from "@/generated/prisma/client";
import { FREELANCER_ROLE_VALUES, isFreelancerRole } from "@/lib/roles";

/* ══ Inbox Light: hilos 1-a-1 fuera de proyectos ══════════════════════
   ACL de dirección (chat-requirements.md 3.1): un "client" solo puede
   INICIAR con un "freelancer"; un "freelancer" solo puede
   INICIAR con otro "freelancer" (freelancer<->freelancer libre; freelancer->client
   prohibido, el freelancer solo puede responder si el client ya inició). La
   restricción aplica solo al arranque del hilo: una vez creado, ambas
   partes pueden responder libremente. ═══════════════════════════════════ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_MESSAGE_LENGTH = 4000;

export interface DirectMessageData {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sender: { id: string; name: string | null; username: string | null; imageUrl: string | null };
}

export interface DirectThreadData {
  id: string;
  initiatorId: string;
  recipientId: string;
  createdAt: string;
  updatedAt: string;
  otherParticipant: {
    id: string;
    name: string | null;
    username: string | null;
    imageUrl: string | null;
    role: string;
    headline: string | null;
    lastSeenAt: string | null;
    presenceStatus: string | null;
  };
  lastMessage: { id: string; body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
}

export interface EligibleRecipientData {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  headline: string | null;
  lastSeenAt: string | null;
  presenceStatus: string | null;
}

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

function validateBody(body: string): Result<{ trimmed: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "El mensaje no puede estar vacío." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "El mensaje es demasiado largo." };
  }
  return { ok: true, trimmed };
}

// Solo los participantes (initiator o recipient) de ese hilo específico
// están autorizados a leer/enviar/marcar como leído.
async function requireDirectThreadAuth(threadId: string, userId: string): Promise<Result> {
  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { initiatorId: true, recipientId: true },
  });
  if (!thread) return { ok: false, error: "Hilo no encontrado." };
  if (thread.initiatorId !== userId && thread.recipientId !== userId) {
    return { ok: false, error: "No autorizado" };
  }
  return { ok: true };
}

// Candidatos válidos para iniciar un hilo, según la misma ACL de dirección
// que startDirectThread: un "client" solo puede iniciar con freelancers, y
// un "freelancer" solo puede iniciar con otros freelancers (nunca con un
// client) — ambos casos colapsan en la misma query: todo freelancer con
// username, excluyendo al propio usuario actual.
export async function getEligibleRecipients(): Promise<
  Result<{ recipients: EligibleRecipientData[] }>
> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return { ok: false, error: "Usuario no encontrado." };

  const recipients = await prisma.user.findMany({
    where: {
      role: { in: FREELANCER_ROLE_VALUES },
      id: { not: userId },
      username: { not: null },
      // Perfil privado (isPublic: false) = no buscable como destinatario;
      // el propio colaborador sigue pudiendo iniciar conversaciones normalmente.
      isPublic: true,
    },
    select: {
      id: true,
      name: true,
      username: true,
      imageUrl: true,
      headline: true,
      lastSeenAt: true,
      presenceStatus: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    ok: true,
    recipients: recipients.map((recipient) => ({
      ...recipient,
      lastSeenAt: recipient.lastSeenAt ? recipient.lastSeenAt.toISOString() : null,
    })),
  };
}

export async function startDirectThread(
  recipientId: string,
  firstBody: string,
): Promise<Result<{ threadId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };
  if (userId === recipientId)
    return { ok: false, error: "No puedes iniciar un hilo contigo mismo." };

  const bodyCheck = validateBody(firstBody);
  if (!bodyCheck.ok) return bodyCheck;

  const [initiator, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.user.findUnique({ where: { id: recipientId }, select: { role: true } }),
  ]);
  if (!initiator) return { ok: false, error: "Usuario no encontrado." };
  if (!recipient) return { ok: false, error: "Destinatario no encontrado." };

  if (initiator.role === "client" && !isFreelancerRole(recipient.role)) {
    return { ok: false, error: "Un client solo puede iniciar conversaciones con un freelancer." };
  }
  if (isFreelancerRole(initiator.role) && !isFreelancerRole(recipient.role)) {
    return {
      ok: false,
      error:
        "Un freelancer no puede iniciar una conversación con un client; debe esperar a que el client escriba primero.",
    };
  }

  // Busca hilo existente en ambas direcciones antes de crear uno nuevo.
  const existing = await prisma.directThread.findFirst({
    where: {
      OR: [
        { initiatorId: userId, recipientId },
        { initiatorId: recipientId, recipientId: userId },
      ],
    },
    select: { id: true },
  });

  const threadId = existing
    ? existing.id
    : (
        await prisma.directThread.create({
          data: { initiatorId: userId, recipientId },
          select: { id: true },
        })
      ).id;

  const message = await prisma.directMessage.create({
    data: { threadId, senderId: userId, body: bodyCheck.trimmed },
    select: { id: true },
  });

  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: NotificationType.NEW_MESSAGE,
      payload: { threadId, messageId: message.id },
    },
  });

  return { ok: true, threadId };
}

export async function getDirectThreads(): Promise<Result<{ threads: DirectThreadData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const threads = await prisma.directThread.findMany({
    where: { OR: [{ initiatorId: userId }, { recipientId: userId }] },
    include: {
      initiator: {
        select: {
          id: true,
          name: true,
          username: true,
          imageUrl: true,
          role: true,
          headline: true,
          lastSeenAt: true,
          presenceStatus: true,
        },
      },
      recipient: {
        select: {
          id: true,
          name: true,
          username: true,
          imageUrl: true,
          role: true,
          headline: true,
          lastSeenAt: true,
          presenceStatus: true,
        },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const unreadCounts = await prisma.directMessage.groupBy({
    by: ["threadId"],
    where: {
      threadId: { in: threads.map((thread) => thread.id) },
      readAt: null,
      senderId: { not: userId },
    },
    _count: { _all: true },
  });
  const unreadMap = new Map(unreadCounts.map((entry) => [entry.threadId, entry._count._all]));

  const mapped = threads.map((thread) => {
    const otherParticipant = thread.initiatorId === userId ? thread.recipient : thread.initiator;
    const lastMessage = thread.messages[0] ?? null;
    return {
      id: thread.id,
      initiatorId: thread.initiatorId,
      recipientId: thread.recipientId,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      otherParticipant: {
        ...otherParticipant,
        lastSeenAt: otherParticipant.lastSeenAt ? otherParticipant.lastSeenAt.toISOString() : null,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      unreadCount: unreadMap.get(thread.id) ?? 0,
      sortTime: lastMessage ? lastMessage.createdAt.getTime() : thread.createdAt.getTime(),
    };
  });

  mapped.sort((a, b) => b.sortTime - a.sortTime);

  return { ok: true, threads: mapped.map(({ sortTime, ...thread }) => thread) };
}

export async function getDirectMessages(
  threadId: string,
): Promise<Result<{ messages: DirectMessageData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const authResult = await requireDirectThreadAuth(threadId, userId);
  if (!authResult.ok) return authResult;

  const messages = await prisma.directMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, username: true, imageUrl: true } } },
  });

  return {
    ok: true,
    messages: messages.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      body: message.body,
      readAt: message.readAt ? message.readAt.toISOString() : null,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
    })),
  };
}

export async function sendDirectMessage(
  threadId: string,
  body: string,
): Promise<Result<{ messageId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const thread = await prisma.directThread.findUnique({
    where: { id: threadId },
    select: { initiatorId: true, recipientId: true },
  });
  if (!thread) return { ok: false, error: "Hilo no encontrado." };
  if (thread.initiatorId !== userId && thread.recipientId !== userId) {
    return { ok: false, error: "No autorizado" };
  }

  const bodyCheck = validateBody(body);
  if (!bodyCheck.ok) return bodyCheck;

  const recipientId = thread.initiatorId === userId ? thread.recipientId : thread.initiatorId;

  const message = await prisma.directMessage.create({
    data: { threadId, senderId: userId, body: bodyCheck.trimmed },
    select: { id: true },
  });

  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: NotificationType.NEW_MESSAGE,
      payload: { threadId, messageId: message.id },
    },
  });

  return { ok: true, messageId: message.id };
}

export async function markDirectThreadRead(threadId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const authResult = await requireDirectThreadAuth(threadId, userId);
  if (!authResult.ok) return authResult;

  await prisma.directMessage.updateMany({
    where: { threadId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return { ok: true };
}

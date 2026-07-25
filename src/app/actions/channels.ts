"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { NotificationType, Prisma, ProjectMemberRole } from "@/generated/prisma/client";
import { isFreelancerRole } from "@/lib/roles";

/* ══ Mensajería robusta del proyecto + matriz de roles + pipeline ═════
   mensaje->tarea (chat-requirements.md 3.2/3.3). Todo este módulo exige
   project.status === "active": el chat colaborativo solo existe mientras
   el proyecto está en curso. ══════════════════════════════════════════ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_MESSAGE_LENGTH = 4000;
const TASK_TITLE_LENGTH = 80;

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export interface ProjectMemberAuth {
  ok: boolean;
  error?: string;
  isClient?: boolean;
  clientId?: string;
  // Freelancer "fundador" de la Connection (distinto de un ProjectCollaborator
  // adicional); solo él y el client pueden administrar el acceso a salas.
  freelancerId?: string;
  status?: string;
  participantIds?: string[];
}

// Acceso al chat robusto: userId debe ser el client creador (connection.
// clientId), el freelancer fundador (connection.freelancerId) o un colaborador
// adicional (ProjectCollaborator). Devuelve status y la lista completa de
// participantes para reutilizar en notificaciones masivas.
export async function requireProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMemberAuth> {
  const project = await prisma.collabProject.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      connection: { select: { clientId: true, freelancerId: true } },
      collaborators: { select: { userId: true } },
    },
  });
  if (!project) return { ok: false, error: "Proyecto no encontrado." };

  const participantIds = [
    project.connection.clientId,
    project.connection.freelancerId,
    ...project.collaborators.map((collaborator) => collaborator.userId),
  ];
  if (!participantIds.includes(userId)) return { ok: false, error: "No autorizado" };

  return {
    ok: true,
    isClient: project.connection.clientId === userId,
    clientId: project.connection.clientId,
    freelancerId: project.connection.freelancerId,
    status: project.status,
    participantIds,
  };
}

function assertActiveProject(status: string): { ok: false; error: string } | null {
  if (status !== "active") {
    return { ok: false, error: "El chat del proyecto solo está disponible en proyectos activos." };
  }
  return null;
}

/* ══ Control de acceso por sala (ChannelMember) ═══════════════════════════
   ProjectChannel.restricted es la fuente de verdad de si la sala es
   restringida (una fila de ChannelMember ya no basta: también existen filas
   solo para portar el flag isAdmin en salas abiertas). Acceso = miembro del
   proyecto Y (sala no restringida O tiene fila ChannelMember O es el
   client dueño del proyecto, que siempre entra). Este helper centraliza la
   regla para no duplicarla entre getChannels, getChannelMessages,
   sendChannelMessage y getChannelContext. */

// Trae, para un lote de canales, si están restringidos y el set de userIds
// con fila ChannelMember explícita (independientemente de si son admin).
async function getChannelAccessData(
  channelIds: string[],
): Promise<Map<string, { restricted: boolean; memberIds: Set<string> }>> {
  if (channelIds.length === 0) return new Map();
  const [channels, rows] = await Promise.all([
    prisma.projectChannel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, restricted: true },
    }),
    prisma.channelMember.findMany({
      where: { channelId: { in: channelIds } },
      select: { channelId: true, userId: true },
    }),
  ]);

  const data = new Map<string, { restricted: boolean; memberIds: Set<string> }>();
  for (const channel of channels) {
    data.set(channel.id, { restricted: channel.restricted, memberIds: new Set() });
  }
  for (const row of rows) {
    const entry = data.get(row.channelId);
    if (entry) entry.memberIds.add(row.userId);
  }
  return data;
}

function channelIsAccessible(
  accessData: Map<string, { restricted: boolean; memberIds: Set<string> }>,
  channelId: string,
  userId: string,
  isClient: boolean,
): boolean {
  const entry = accessData.get(channelId);
  if (!entry?.restricted) return true; // sala abierta o inexistente
  return isClient || entry.memberIds.has(userId);
}

// Verificación puntual (1 canal) para las acciones de mensajería. `isClient`
// debe venir de requireProjectMember (el dueño del proyecto siempre entra).
// Exportado para reutilizarse en inbox.ts (getChannelContext) sin duplicar
// la regla de acceso.
export async function requireChannelAccess(
  channelId: string,
  userId: string,
  isClient: boolean,
): Promise<Result> {
  const accessData = await getChannelAccessData([channelId]);
  if (!channelIsAccessible(accessData, channelId, userId, isClient)) {
    return { ok: false, error: "No tienes acceso a esta sala." };
  }
  return { ok: true };
}

/* ══ Canales ═══════════════════════════════════════════════════════════ */

export interface ChannelData {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

function validateChannelName(name: string): Result<{ trimmed: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    return { ok: false, error: "El nombre del canal debe tener entre 1 y 60 caracteres." };
  }
  return { ok: true, trimmed };
}

// Solo el client creador del proyecto administra los canales.
export async function createChannel(
  projectId: string,
  name: string,
): Promise<Result<{ channelId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;
  if (!member.isClient) return { ok: false, error: "Solo el client puede crear canales." };

  const nameCheck = validateChannelName(name);
  if (!nameCheck.ok) return nameCheck;

  const channel = await prisma.projectChannel.create({
    data: { projectId, name: nameCheck.trimmed },
    select: { id: true },
  });

  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true, channelId: channel.id };
}

export async function renameChannel(channelId: string, name: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;
  if (!member.isClient) return { ok: false, error: "Solo el client puede renombrar canales." };

  const nameCheck = validateChannelName(name);
  if (!nameCheck.ok) return nameCheck;

  await prisma.projectChannel.update({
    where: { id: channelId },
    data: { name: nameCheck.trimmed },
  });

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true };
}

export async function deleteChannel(channelId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;
  if (!member.isClient) return { ok: false, error: "Solo el client puede eliminar canales." };

  await prisma.projectChannel.delete({ where: { id: channelId } });

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true };
}

export async function getChannels(projectId: string): Promise<Result<{ channels: ChannelData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;

  const channels = await prisma.projectChannel.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { messages: true } } },
  });

  // Salas restringidas se ocultan a quien no sea miembro explícito ni el
  // client dueño del proyecto.
  const accessData = await getChannelAccessData(channels.map((channel) => channel.id));
  const visibleChannels = channels.filter((channel) =>
    channelIsAccessible(accessData, channel.id, userId, member.isClient ?? false),
  );

  return {
    ok: true,
    channels: visibleChannels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      projectId: channel.projectId,
      createdAt: channel.createdAt.toISOString(),
      updatedAt: channel.updatedAt.toISOString(),
      messageCount: channel._count.messages,
    })),
  };
}

/* ══ Mensajes de canal ═════════════════════════════════════════════════ */

export interface ChannelMessageData {
  id: string;
  channelId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; username: string | null; imageUrl: string | null };
  task: {
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    assignee: {
      id: string;
      name: string | null;
      username: string | null;
      imageUrl: string | null;
    } | null;
    asset: { id: string; title: string } | null;
  } | null;
}

export async function sendChannelMessage(
  channelId: string,
  body: string,
): Promise<Result<{ messageId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;

  const accessData = await getChannelAccessData([channelId]);
  if (!channelIsAccessible(accessData, channelId, userId, member.isClient ?? false)) {
    return { ok: false, error: "No tienes acceso a esta sala." };
  }

  const trimmedBody = body.trim();
  if (!trimmedBody) return { ok: false, error: "El mensaje no puede estar vacío." };
  if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "El mensaje es demasiado largo." };
  }

  const message = await prisma.channelMessage.create({
    data: { channelId, senderId: userId, body: trimmedBody },
    select: { id: true },
  });

  const recipients = member.participantIds!.filter(
    (id) => id !== userId && channelIsAccessible(accessData, channelId, id, id === member.clientId),
  );
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        userId: recipientId,
        type: NotificationType.NEW_MESSAGE,
        payload: { projectId: channel.projectId, channelId, messageId: message.id },
      })),
    });
  }

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true, messageId: message.id };
}

export async function getChannelMessages(
  channelId: string,
): Promise<Result<{ messages: ChannelMessageData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;

  const accessCheck = await requireChannelAccess(channelId, userId, member.isClient ?? false);
  if (!accessCheck.ok) return accessCheck;

  const messages = await prisma.channelMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
    include: {
      sender: { select: { id: true, name: true, username: true, imageUrl: true } },
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
          asset: { select: { id: true, title: true } },
        },
      },
    },
  });

  return {
    ok: true,
    messages: messages.map((message) => ({
      id: message.id,
      channelId: message.channelId,
      senderId: message.senderId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      sender: message.sender,
      task: message.task
        ? {
            id: message.task.id,
            title: message.task.title,
            status: message.task.status,
            dueDate: message.task.dueDate ? message.task.dueDate.toISOString() : null,
            assignee: message.task.assignee,
            asset: message.task.asset,
          }
        : null,
    })),
  };
}

/* ══ Matriz de roles del proyecto ══════════════════════════════════════ */

export interface ProjectRoleData {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdAt: string;
  user: { id: string; name: string | null; username: string | null; imageUrl: string | null };
}

export async function getProjectRoles(
  projectId: string,
): Promise<Result<{ roles: ProjectRoleData[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;

  const roles = await prisma.projectRoleAssignment.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, username: true, imageUrl: true } } },
  });

  return {
    ok: true,
    roles: roles.map((role) => ({
      id: role.id,
      projectId: role.projectId,
      userId: role.userId,
      role: role.role,
      createdAt: role.createdAt.toISOString(),
      user: role.user,
    })),
  };
}

// Solo el client creador asigna roles, y únicamente a freelancers participantes
// del proyecto (fundador o colaborador adicional), nunca a sí mismo.
export async function assignProjectRole(
  projectId: string,
  targetUserId: string,
  role: ProjectMemberRole,
): Promise<Result<{ roleId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;
  if (!member.isClient) return { ok: false, error: "Solo el client puede asignar roles." };

  if (!Object.values(ProjectMemberRole).includes(role)) {
    return { ok: false, error: "Rol inválido." };
  }
  if (targetUserId === member.clientId || !member.participantIds!.includes(targetUserId)) {
    return { ok: false, error: "El usuario debe ser un freelancer participante del proyecto." };
  }

  try {
    const assignment = await prisma.projectRoleAssignment.create({
      data: { projectId, userId: targetUserId, role },
      select: { id: true },
    });
    revalidatePath(`/proyectos/${projectId}`);
    return { ok: true, roleId: assignment.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Ese freelancer ya tiene ese rol." };
    }
    throw error;
  }
}

export async function removeProjectRole(
  projectId: string,
  targetUserId: string,
  role: ProjectMemberRole,
): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;
  if (!member.isClient) return { ok: false, error: "Solo el client puede quitar roles." };

  await prisma.projectRoleAssignment.deleteMany({
    where: { projectId, userId: targetUserId, role },
  });

  revalidatePath(`/proyectos/${projectId}`);
  return { ok: true };
}

/* ══ Pipeline mensaje -> tarea ═════════════════════════════════════════ */

export interface CreateTaskFromMessageInput {
  description?: string;
  assigneeId: string;
  assetId?: string;
  dueDate?: string;
}

// El caller solo necesita ser participante del proyecto (no forzosamente el
// client): cualquiera puede proponer convertir un mensaje en tarea, pero el
// responsable siempre debe ser un freelancer participante y la tarea nace
// "pending_approval" hasta que ese freelancer la resuelva.
export async function createTaskFromMessage(
  messageId: string,
  input: CreateTaskFromMessageInput,
): Promise<Result<{ taskId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const message = await prisma.channelMessage.findUnique({
    where: { id: messageId },
    select: { id: true, body: true, channel: { select: { projectId: true } } },
  });
  if (!message) return { ok: false, error: "Mensaje no encontrado." };

  const projectId = message.channel.projectId;
  const member = await requireProjectMember(projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status!);
  if (activeError) return activeError;

  if (input.assigneeId === member.clientId || !member.participantIds!.includes(input.assigneeId)) {
    return { ok: false, error: "El responsable debe ser un freelancer participante del proyecto." };
  }
  const assignee = await prisma.user.findUnique({
    where: { id: input.assigneeId },
    select: { role: true },
  });
  if (!assignee || !isFreelancerRole(assignee.role)) {
    return { ok: false, error: "El responsable debe ser un freelancer." };
  }

  if (input.assetId) {
    const asset = await prisma.projectAsset.findUnique({
      where: { id: input.assetId },
      select: { projectId: true },
    });
    if (!asset || asset.projectId !== projectId) {
      return { ok: false, error: "El activo no pertenece a este proyecto." };
    }
  }

  let dueDate: Date | undefined;
  if (input.dueDate !== undefined) {
    const parsed = new Date(input.dueDate);
    if (Number.isNaN(parsed.getTime()))
      return { ok: false, error: "La fecha límite no es válida." };
    dueDate = parsed;
  }

  const description = input.description?.trim() || message.body;
  const title = description.slice(0, TASK_TITLE_LENGTH);

  try {
    const task = await prisma.projectTask.create({
      data: {
        projectId,
        title,
        description,
        status: "pending_approval",
        assigneeId: input.assigneeId,
        assetId: input.assetId ?? null,
        dueDate: dueDate ?? null,
        sourceMessageId: messageId,
      },
      select: { id: true },
    });

    await prisma.notification.create({
      data: {
        userId: input.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        payload: { projectId, taskId: task.id },
      },
    });

    revalidatePath(`/proyectos/${projectId}`);
    return { ok: true, taskId: task.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Este mensaje ya tiene una tarea vinculada." };
    }
    throw error;
  }
}

// Solo el freelancer asignado resuelve su propia tarea pendiente de aprobación.
export async function resolveTaskApproval(taskId: string, approve: boolean): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const task = await prisma.projectTask.findUnique({
    where: { id: taskId },
    select: {
      status: true,
      assigneeId: true,
      projectId: true,
      project: { select: { status: true, connection: { select: { clientId: true } } } },
    },
  });
  if (!task) return { ok: false, error: "Tarea no encontrada." };

  const activeError = assertActiveProject(task.project.status);
  if (activeError) return activeError;
  if (task.assigneeId !== userId) {
    return { ok: false, error: "Solo el responsable asignado puede resolver esta tarea." };
  }
  if (task.status !== "pending_approval") {
    return { ok: false, error: "Esta tarea ya no está pendiente de aprobación." };
  }

  const status = approve ? "approved" : "rejected";
  await prisma.projectTask.update({ where: { id: taskId }, data: { status } });

  await prisma.notification.create({
    data: {
      userId: task.project.connection.clientId,
      type: NotificationType.TASK_STATUS_CHANGED,
      payload: { projectId: task.projectId, taskId, status },
    },
  });

  revalidatePath(`/proyectos/${task.projectId}`);
  return { ok: true };
}

/* ══ Membresía de salas (control de acceso) ═══════════════════════════════ */

export interface ChannelMemberData {
  userId: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  isAdmin: boolean;
}

export async function getChannelMembers(
  channelId: string,
): Promise<Result<{ members: ChannelMemberData[]; restricted: boolean }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true, restricted: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };

  const accessCheck = await requireChannelAccess(channelId, userId, member.isClient ?? false);
  if (!accessCheck.ok) return accessCheck;

  const rows = await prisma.channelMember.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
    select: {
      isAdmin: true,
      user: { select: { id: true, name: true, username: true, imageUrl: true } },
    },
  });

  return {
    ok: true,
    restricted: channel.restricted,
    members: rows.map((row) => ({
      userId: row.user.id,
      name: row.user.name,
      username: row.user.username,
      imageUrl: row.user.imageUrl,
      isAdmin: row.isAdmin,
    })),
  };
}

// Un usuario es admin de la sala si tiene una fila ChannelMember con
// isAdmin = true (independientemente de si la sala está restringida).
async function isChannelAdmin(channelId: string, userId: string): Promise<boolean> {
  const row = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { isAdmin: true },
  });
  return row?.isAdmin ?? false;
}

// El client dueño del proyecto, el freelancer fundador de la Connection, o un
// ADMIN de la sala pueden configurar el acceso a esa sala (mismo criterio de
// administración que createChannel/renameChannel, extendido al freelancer
// fundador y a los admins). userIds vacío deja la sala abierta a todo el
// proyecto (restricted = false); no vacío la restringe (restricted = true).
// Se preservan los flags isAdmin de quienes permanezcan en la lista.
export async function setChannelMembers(channelId: string, userIds: string[]): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status ?? "");
  if (activeError) return activeError;

  if (!member.isClient && userId !== member.freelancerId && !(await isChannelAdmin(channelId, userId))) {
    return {
      ok: false,
      error: "Solo el client, el freelancer fundador o un admin de la sala pueden configurar su acceso.",
    };
  }

  const uniqueUserIds = Array.from(new Set(userIds));
  const invalidUserId = uniqueUserIds.find((id) => !member.participantIds?.includes(id));
  if (invalidUserId) {
    return { ok: false, error: "Todos los usuarios deben ser participantes del proyecto." };
  }

  const existingAdmins = await prisma.channelMember.findMany({
    where: { channelId, isAdmin: true },
    select: { userId: true },
  });
  const adminIds = new Set(existingAdmins.map((row) => row.userId));

  await prisma.$transaction([
    prisma.channelMember.deleteMany({ where: { channelId } }),
    ...(uniqueUserIds.length > 0
      ? [
          prisma.channelMember.createMany({
            data: uniqueUserIds.map((memberId) => ({
              channelId,
              userId: memberId,
              isAdmin: adminIds.has(memberId),
            })),
          }),
        ]
      : []),
    prisma.projectChannel.update({
      where: { id: channelId },
      data: { restricted: uniqueUserIds.length > 0 },
    }),
  ]);

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true };
}

/* ══ Administración de la sala (nombre/descripción/imagen, admins) ══════ */

const MAX_CHANNEL_DESCRIPTION_LENGTH = 280;
// Data URL comprimida, mismo patrón que CollabProject.logoUrl
const MAX_CHANNEL_IMAGE_DATA_URL_CHARS = 700_000; // ≈ 500KB de imagen

export interface UpdateChannelInfoInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
}

// Solo admins de la sala (ChannelMember.isAdmin) o el client dueño del
// proyecto pueden editar nombre/descripción/imagen de la sala.
export async function updateChannelInfo(
  channelId: string,
  data: UpdateChannelInfoInput,
): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status ?? "");
  if (activeError) return activeError;

  if (!member.isClient && !(await isChannelAdmin(channelId, userId))) {
    return { ok: false, error: "Solo un admin de la sala o el client pueden editar la sala." };
  }

  let trimmedName: string | undefined;
  if (data.name !== undefined) {
    const nameCheck = validateChannelName(data.name);
    if (!nameCheck.ok) return nameCheck;
    trimmedName = nameCheck.trimmed;
  }

  let description: string | null | undefined;
  if (data.description !== undefined) {
    const trimmed = data.description === null ? null : data.description.trim() || null;
    if (trimmed && trimmed.length > MAX_CHANNEL_DESCRIPTION_LENGTH) {
      return {
        ok: false,
        error: `La descripción no puede exceder ${MAX_CHANNEL_DESCRIPTION_LENGTH} caracteres.`,
      };
    }
    description = trimmed;
  }

  if (data.imageUrl !== undefined && data.imageUrl !== null) {
    if (!data.imageUrl.startsWith("data:image/jpeg;base64,")) {
      return { ok: false, error: "Formato de imagen no válido." };
    }
    if (data.imageUrl.length > MAX_CHANNEL_IMAGE_DATA_URL_CHARS) {
      return { ok: false, error: "La imagen es demasiado pesada." };
    }
  }

  await prisma.projectChannel.update({
    where: { id: channelId },
    data: {
      name: trimmedName,
      description: data.description !== undefined ? description : undefined,
      imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
    },
  });

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true };
}

// Otorgar admin: solo el client dueño del proyecto. Quitar admin: el
// client dueño o el propio userId (auto-quitarse). El userId debe ser
// miembro del proyecto; se crea la fila ChannelMember (upsert) si no existe,
// sin tocar `restricted`.
export async function setChannelAdmin(
  channelId: string,
  targetUserId: string,
  isAdmin: boolean,
): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "Proyecto no encontrado." };
  const activeError = assertActiveProject(member.status ?? "");
  if (activeError) return activeError;

  if (isAdmin) {
    if (!member.isClient) {
      return { ok: false, error: "Solo el client puede otorgar administración de la sala." };
    }
  } else if (!member.isClient && userId !== targetUserId) {
    return {
      ok: false,
      error: "Solo el client o el propio usuario pueden quitar administración de la sala.",
    };
  }

  if (!member.participantIds?.includes(targetUserId)) {
    return { ok: false, error: "El usuario debe ser miembro del proyecto." };
  }

  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: targetUserId } },
    update: { isAdmin },
    create: { channelId, userId: targetUserId, isAdmin },
  });

  revalidatePath(`/proyectos/${channel.projectId}`);
  return { ok: true };
}

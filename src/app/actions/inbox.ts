"use server";

import { auth } from "@clerk/nextjs/server";
import type { ProjectMemberRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireChannelAccess, requireProjectMember } from "./channels";

/* ══ Bandeja unificada de /mensajes (chat-messenger-refactor.md 2/3) ═════
   Combina hilos directos (DirectThread) y canales de proyecto activos
   (ProjectChannel) en una sola lista ordenada por actividad reciente, más
   el contexto de un canal para el panel derecho. ═══════════════════════ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface ConversationParticipant {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  headline: string | null;
  role: string;
  lastSeenAt: string | null;
  presenceStatus: string | null;
}

export interface ConversationSummary {
  key: string;
  kind: "direct" | "group";
  threadId?: string;
  channelId?: string;
  title: string;
  subtitle: string | null;
  avatarUrl: string | null;
  participant?: ConversationParticipant;
  project?: { id: string; title: string; logoUrl: string | null };
  // Solo se calcula para conversaciones "direct": true si el otro
  // participante también forma parte de al menos un proyecto activo del
  // viewer (client/freelancer/colaborador). Usado por el filtro "Proyectos"
  // del SegmentedControl en modo de mensajes directos (ConversationList).
  sharesProject?: boolean;
  lastMessage: { body: string; createdAt: string; senderName: string | null } | null;
  unreadCount: number;
  lastActivityAt: string;
}

export interface ChannelContextParticipant {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  roles: ProjectMemberRole[];
  lastSeenAt: string | null;
  presenceStatus: string | null;
}

export interface ChannelContextTask {
  id: string;
  title: string;
  status: string;
  description: string | null;
  dueDate: string | null;
  assignee: {
    id: string;
    name: string | null;
    username: string | null;
    imageUrl: string | null;
  } | null;
  asset: { id: string; title: string } | null;
}

export interface ChannelContextLink {
  id: string;
  label: string;
  url: string;
  type: string;
  provider: string;
  addedById: string;
}

export interface ChannelContextData {
  channel: { id: string; name: string; description: string | null; imageUrl: string | null };
  project: { id: string; title: string; status: string; logoUrl: string | null };
  isAdmin: boolean;
  // Freelancer "fundador" de la Connection (freelancerParticipants[0]): junto al
  // client (isAdmin), es el único que puede configurar el acceso a salas
  // (setChannelMembers) — ver DetailsPanel "Acceso a la sala".
  founderFreelancerId: string;
  participants: ChannelContextParticipant[];
  freelancerParticipants: string[];
  tasks: ChannelContextTask[];
  assets: { id: string; title: string }[];
  links: ChannelContextLink[];
}

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function getInbox(): Promise<Result<{ conversations: ConversationSummary[] }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const [directThreads, projects] = await Promise.all([
    prisma.directThread.findMany({
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
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true, sender: { select: { name: true } } },
        },
      },
    }),
    prisma.collabProject.findMany({
      where: {
        status: "active",
        OR: [
          { connection: { clientId: userId } },
          { connection: { freelancerId: userId } },
          { collaborators: { some: { userId } } },
        ],
      },
      select: {
        id: true,
        title: true,
        logoUrl: true,
        connection: { select: { clientId: true, freelancerId: true } },
        collaborators: { select: { userId: true } },
        channels: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { body: true, createdAt: true, sender: { select: { name: true } } },
            },
          },
        },
      },
    }),
  ]);

  const unreadCounts = directThreads.length
    ? await prisma.directMessage.groupBy({
        by: ["threadId"],
        where: {
          threadId: { in: directThreads.map((thread) => thread.id) },
          readAt: null,
          senderId: { not: userId },
        },
        _count: { _all: true },
      })
    : [];
  const unreadMap = new Map(unreadCounts.map((entry) => [entry.threadId, entry._count._all]));

  // Set de todos los usuarios con quienes el viewer comparte al menos un
  // proyecto activo (client/freelancer fundador/colaborador de cualquiera de
  // sus proyectos), excluyéndose a sí mismo. Alimenta ConversationSummary.
  // sharesProject para el filtro "Proyectos" del modo directo.
  const projectPeerIds = new Set<string>();
  for (const project of projects) {
    projectPeerIds.add(project.connection.clientId);
    projectPeerIds.add(project.connection.freelancerId);
    for (const collaborator of project.collaborators) projectPeerIds.add(collaborator.userId);
  }
  projectPeerIds.delete(userId);

  // Aprovisionamiento idempotente: la creación de salas vive dentro de la
  // conversación, así que un proyecto activo sin ningún ProjectChannel
  // quedaría inaccesible desde /mensajes. Si channels.length === 0 se crea
  // automáticamente un canal "General". Solo se dispara cuando no hay
  // canales; en cargas concurrentes del mismo usuario podría dispararse dos
  // veces para el mismo proyecto (carrera benigna, no hay unique constraint
  // en projectId+name), pero nunca duplica sobre un proyecto que ya tiene
  // canal ni corrompe datos existentes.
  const projectsNeedingChannel = projects.filter((project) => project.channels.length === 0);
  const autoChannels = projectsNeedingChannel.length
    ? await Promise.all(
        projectsNeedingChannel.map((project) =>
          prisma.projectChannel.create({
            data: { projectId: project.id, name: "General" },
            select: { id: true, name: true, createdAt: true },
          }),
        ),
      )
    : [];
  const autoChannelByProjectId = new Map(
    projectsNeedingChannel.map((project, index) => [project.id, autoChannels[index]]),
  );

  const directConversations: ConversationSummary[] = directThreads.map((thread) => {
    const otherParticipant = thread.initiatorId === userId ? thread.recipient : thread.initiator;
    const lastMessage = thread.messages[0] ?? null;
    const lastActivityDate = lastMessage ? lastMessage.createdAt : thread.createdAt;
    return {
      key: `direct:${thread.id}`,
      kind: "direct",
      threadId: thread.id,
      title: otherParticipant.name ?? otherParticipant.username ?? "Usuario",
      subtitle: otherParticipant.headline,
      avatarUrl: otherParticipant.imageUrl,
      participant: {
        ...otherParticipant,
        lastSeenAt: otherParticipant.lastSeenAt ? otherParticipant.lastSeenAt.toISOString() : null,
      },
      sharesProject: projectPeerIds.has(otherParticipant.id),
      lastMessage: lastMessage
        ? {
            body: lastMessage.body,
            createdAt: lastMessage.createdAt.toISOString(),
            senderName: lastMessage.sender.name,
          }
        : null,
      unreadCount: unreadMap.get(thread.id) ?? 0,
      lastActivityAt: lastActivityDate.toISOString(),
    };
  });

  // ChannelMessage no tiene modelo de lectura por usuario (sin campo readAt ni
  // tabla de recibos, a diferencia de DirectMessage): unreadCount de los
  // canales grupales queda fijo en 0 hasta que se agregue esa pieza de datos.
  const groupConversations: ConversationSummary[] = projects.flatMap((project) => {
    const channels =
      project.channels.length > 0
        ? project.channels
        : [
            {
              ...autoChannelByProjectId.get(project.id)!,
              messages: [] as (typeof project.channels)[number]["messages"],
            },
          ];

    return channels.map((channel) => {
      const lastMessage = channel.messages[0] ?? null;
      const lastActivityDate = lastMessage ? lastMessage.createdAt : channel.createdAt;
      return {
        key: `group:${channel.id}`,
        kind: "group",
        channelId: channel.id,
        title: channel.name,
        subtitle: project.title,
        avatarUrl: null,
        project: { id: project.id, title: project.title, logoUrl: project.logoUrl },
        lastMessage: lastMessage
          ? {
              body: lastMessage.body,
              createdAt: lastMessage.createdAt.toISOString(),
              senderName: lastMessage.sender.name,
            }
          : null,
        unreadCount: 0,
        lastActivityAt: lastActivityDate.toISOString(),
      };
    });
  });

  const conversations = [...directConversations, ...groupConversations].sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );

  return { ok: true, conversations };
}

export async function getChannelContext(channelId: string): Promise<Result<ChannelContextData>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const channel = await prisma.projectChannel.findUnique({
    where: { id: channelId },
    select: { id: true, name: true, description: true, imageUrl: true, projectId: true },
  });
  if (!channel) return { ok: false, error: "Canal no encontrado." };

  const member = await requireProjectMember(channel.projectId, userId);
  if (!member.ok) return { ok: false, error: member.error ?? "No autorizado" };

  const accessCheck = await requireChannelAccess(channelId, userId, member.isClient ?? false);
  if (!accessCheck.ok) return accessCheck;

  const project = await prisma.collabProject.findUnique({
    where: { id: channel.projectId },
    select: {
      id: true,
      title: true,
      status: true,
      logoUrl: true,
      links: {
        orderBy: { createdAt: "desc" },
        select: { id: true, label: true, url: true, type: true, provider: true, addedById: true },
      },
      connection: {
        select: {
          clientId: true,
          freelancerId: true,
          client: {
            select: {
              id: true,
              name: true,
              username: true,
              imageUrl: true,
              lastSeenAt: true,
              presenceStatus: true,
            },
          },
          freelancer: {
            select: {
              id: true,
              name: true,
              username: true,
              imageUrl: true,
              lastSeenAt: true,
              presenceStatus: true,
            },
          },
        },
      },
      collaborators: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              imageUrl: true,
              lastSeenAt: true,
              presenceStatus: true,
            },
          },
        },
      },
      roleAssignments: { select: { userId: true, role: true } },
      assets: { select: { id: true, title: true } },
      tasks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          description: true,
          dueDate: true,
          assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
          asset: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!project) return { ok: false, error: "Proyecto no encontrado." };

  const rolesByUser = new Map<string, ProjectMemberRole[]>();
  for (const assignment of project.roleAssignments) {
    const current = rolesByUser.get(assignment.userId) ?? [];
    current.push(assignment.role);
    rolesByUser.set(assignment.userId, current);
  }

  const toParticipant = (
    user: {
      id: string;
      name: string | null;
      username: string | null;
      imageUrl: string | null;
      lastSeenAt: Date | null;
      presenceStatus: string | null;
    },
    roles: ProjectMemberRole[],
  ): ChannelContextParticipant => ({
    ...user,
    lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
    roles,
  });

  const participants: ChannelContextParticipant[] = [
    toParticipant(project.connection.client, []),
    toParticipant(project.connection.freelancer, rolesByUser.get(project.connection.freelancerId) ?? []),
    ...project.collaborators.map((collaborator) =>
      toParticipant(collaborator.user, rolesByUser.get(collaborator.user.id) ?? []),
    ),
  ];

  const freelancerParticipants = [
    project.connection.freelancerId,
    ...project.collaborators.map((collaborator) => collaborator.user.id),
  ];

  return {
    ok: true,
    channel: {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      imageUrl: channel.imageUrl,
    },
    project: {
      id: project.id,
      title: project.title,
      status: project.status,
      logoUrl: project.logoUrl,
    },
    isAdmin: userId === project.connection.clientId,
    founderFreelancerId: project.connection.freelancerId,
    participants,
    freelancerParticipants,
    tasks: project.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      description: task.description,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      assignee: task.assignee,
      asset: task.asset,
    })),
    assets: project.assets,
    links: project.links,
  };
}

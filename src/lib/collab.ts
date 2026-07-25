import { prisma } from "@/lib/prisma";
import type { ConnectionStatus, ProjectMemberRole, TaskPriority } from "@/generated/prisma/client";

/* ══ Tipos compartidos (fechas serializadas como ISO string para Server → ══
   ══ Client Components) ═══════════════════════════════════════════════ */

export interface CollabFreelancerSummary {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
  // Solo presente si el freelancer activó User.shareWhatsapp (opt-in); ver
  // src/app/[username]/page.tsx para la misma regla en el perfil público.
  whatsapp: string | null;
}

export interface CollabClientSummary {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
}

// Colaborador adicional del proyecto (además del freelancer "fundador" de la
// Connection). headline = puesto/profesión (User.headline).
export interface CollabCollaboratorSummary {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
  headline: string | null;
}

// Responsable asignado a una tarea del pipeline mensaje->tarea (chat-requirements.md).
export interface CollabTaskAssignee {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
}

// Activo del proyecto vinculado a una tarea (ProjectTask.assetId).
export interface CollabTaskAsset {
  id: string;
  title: string;
}

// Dependencia cruzada de una tarea (Fase 6): id de la fila TaskDependency y
// datos mínimos de la tarea de la que depende, para renderizar el link sin
// otro round-trip.
export interface CollabTaskDependency {
  id: string;
  dependsOnId: string;
  dependsOnTitle: string;
}

export interface CollabTask {
  id: string;
  title: string;
  status: string;
  order: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  // Campos del pipeline mensaje->tarea, todos opcionales/nulos en tareas
  // creadas manualmente desde el panel (sin origen en el chat).
  description: string | null;
  dueDate: string | null;
  assignee: CollabTaskAssignee | null;
  asset: CollabTaskAsset | null;
  // Atributos ricos (Fase 6): prioridad, avance, rango de fechas y categoría
  priority: TaskPriority;
  progress: number;
  startDate: string | null;
  category: string | null;
  dependencies: CollabTaskDependency[];
}

export interface CollabLink {
  id: string;
  label: string;
  url: string;
  provider: string;
  // brand = assets de marca (subidos por el client) | final = activos
  // finales (subidos por cualquier freelancer/colaborador)
  type: string;
  // Etiqueta libre de archivo (FILE_SUBTYPES en src/lib/projectTypes.ts)
  subtype: string | null;
  // Tarea de activo a la que queda ligado este adjunto, si aplica
  assetTaskId: string | null;
  addedById: string;
  projectId: string;
  createdAt: string;
}

// Responsable asignado a una tarea de activo (checklist de ProjectAsset)
export interface AssetTaskAssigneeData {
  userId: string;
  name: string | null;
  imageUrl: string | null;
}

export interface ProjectAssetTaskData {
  id: string;
  title: string;
  done: boolean;
  // pending | in_review | approved
  status: string;
  dueDate: string | null;
  deliverableUrl: string | null;
  order: number;
  assignees: AssetTaskAssigneeData[];
}

export interface ProjectAssetData {
  id: string;
  title: string;
  assetTemplateId: string | null;
  order: number;
  tasks: ProjectAssetTaskData[];
}

export interface CollabProjectData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  clientNotes: string | null;
  // Cotización y calendario del borrador; editables por ambas partes
  quoteAmount: number | null;
  quoteCurrency: string;
  quoteNotes: string | null;
  startDate: string | null;
  dueDate: string | null;
  // Imagen corporativa/logotipo del proyecto (data URL comprimida)
  logoUrl: string | null;
  // Categorización del proyecto (panel de administración)
  projectType: string | null;
  projectSubtype: string | null;
  connectionId: string;
  createdAt: string;
  updatedAt: string;
  tasks: CollabTask[];
  links: CollabLink[];
  assets: ProjectAssetData[];
  collaborators: CollabCollaboratorSummary[];
}

export interface ClientConnectionData {
  id: string;
  status: ConnectionStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  freelancer: CollabFreelancerSummary;
}

export interface FreelancerConnectionData {
  id: string;
  status: ConnectionStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  client: CollabClientSummary;
}

export interface ClientResourceData {
  id: string;
  label: string;
  url: string;
  provider: string;
  description: string | null;
  sharedWith: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedResourceData extends ClientResourceData {
  owner: CollabClientSummary;
}

export interface ClientCollabData {
  connections: ClientConnectionData[];
  projects: CollabProjectData[];
  resources: ClientResourceData[];
}

export interface FreelancerCollabData {
  pendingRequests: FreelancerConnectionData[];
  connections: FreelancerConnectionData[];
  projects: CollabProjectData[];
  sharedResources: SharedResourceData[];
}

/* ══ Helpers de proyección/serialización ══════════════════════════════ */

function toFreelancerSummary(freelancer: {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
  whatsapp: string | null;
  shareWhatsapp: boolean;
}): CollabFreelancerSummary {
  return {
    id: freelancer.id,
    username: freelancer.username,
    name: freelancer.name,
    imageUrl: freelancer.imageUrl,
    whatsapp: freelancer.shareWhatsapp ? freelancer.whatsapp : null,
  };
}

function toClientSummary(client: {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
}): CollabClientSummary {
  return {
    id: client.id,
    username: client.username,
    name: client.name,
    imageUrl: client.imageUrl,
  };
}

function toTask(task: {
  id: string;
  title: string;
  status: string;
  order: number;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
  description: string | null;
  dueDate: Date | null;
  assignee: CollabTaskAssignee | null;
  asset: CollabTaskAsset | null;
  priority: TaskPriority;
  progress: number;
  startDate: Date | null;
  category: string | null;
  dependencies: { id: string; dependsOnId: string; dependsOn: { id: string; title: string } }[];
}): CollabTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    order: task.order,
    projectId: task.projectId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    description: task.description,
    dueDate: task.dueDate === null ? null : task.dueDate.toISOString(),
    assignee: task.assignee,
    asset: task.asset,
    priority: task.priority,
    progress: task.progress,
    startDate: task.startDate === null ? null : task.startDate.toISOString(),
    category: task.category,
    dependencies: task.dependencies.map((dependency) => ({
      id: dependency.id,
      dependsOnId: dependency.dependsOnId,
      dependsOnTitle: dependency.dependsOn.title,
    })),
  };
}

function toLink(link: {
  id: string;
  label: string;
  url: string;
  provider: string;
  type: string;
  subtype: string | null;
  assetTaskId: string | null;
  addedById: string;
  projectId: string;
  createdAt: Date;
}): CollabLink {
  return {
    id: link.id,
    label: link.label,
    url: link.url,
    provider: link.provider,
    type: link.type,
    subtype: link.subtype,
    assetTaskId: link.assetTaskId,
    addedById: link.addedById,
    projectId: link.projectId,
    createdAt: link.createdAt.toISOString(),
  };
}

function toAssetTask(task: {
  id: string;
  title: string;
  done: boolean;
  status: string;
  dueDate: Date | null;
  deliverableUrl: string | null;
  order: number;
  assignees: { user: { id: string; name: string | null; imageUrl: string | null } }[];
}): ProjectAssetTaskData {
  return {
    id: task.id,
    title: task.title,
    done: task.done,
    status: task.status,
    dueDate: task.dueDate === null ? null : task.dueDate.toISOString(),
    deliverableUrl: task.deliverableUrl,
    order: task.order,
    assignees: task.assignees.map((assignee) => ({
      userId: assignee.user.id,
      name: assignee.user.name,
      imageUrl: assignee.user.imageUrl,
    })),
  };
}

function toAsset(asset: {
  id: string;
  title: string;
  assetTemplateId: string | null;
  order: number;
  tasks: Parameters<typeof toAssetTask>[0][];
}): ProjectAssetData {
  return {
    id: asset.id,
    title: asset.title,
    assetTemplateId: asset.assetTemplateId,
    order: asset.order,
    tasks: asset.tasks.map(toAssetTask),
  };
}

function toCollaborator(collaborator: {
  user: {
    id: string;
    username: string | null;
    name: string | null;
    imageUrl: string | null;
    headline: string | null;
  };
}): CollabCollaboratorSummary {
  return {
    id: collaborator.user.id,
    username: collaborator.user.username,
    name: collaborator.user.name,
    imageUrl: collaborator.user.imageUrl,
    headline: collaborator.user.headline,
  };
}

function toProject(project: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  clientNotes: string | null;
  quoteAmount: { toString(): string } | null;
  quoteCurrency: string;
  quoteNotes: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  logoUrl: string | null;
  projectType: string | null;
  projectSubtype: string | null;
  connectionId: string;
  createdAt: Date;
  updatedAt: Date;
  tasks: Parameters<typeof toTask>[0][];
  links: Parameters<typeof toLink>[0][];
  assets: Parameters<typeof toAsset>[0][];
  collaborators: Parameters<typeof toCollaborator>[0][];
}): CollabProjectData {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    status: project.status,
    clientNotes: project.clientNotes,
    quoteAmount: project.quoteAmount === null ? null : Number(project.quoteAmount),
    quoteCurrency: project.quoteCurrency,
    quoteNotes: project.quoteNotes,
    startDate: project.startDate === null ? null : project.startDate.toISOString(),
    dueDate: project.dueDate === null ? null : project.dueDate.toISOString(),
    logoUrl: project.logoUrl,
    projectType: project.projectType,
    projectSubtype: project.projectSubtype,
    connectionId: project.connectionId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    tasks: project.tasks.map(toTask),
    links: project.links.map(toLink),
    assets: project.assets.map(toAsset),
    collaborators: project.collaborators.map(toCollaborator),
  };
}

function toResource(resource: {
  id: string;
  label: string;
  url: string;
  provider: string;
  description: string | null;
  sharedWith: string[];
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}): ClientResourceData {
  return {
    id: resource.id,
    label: resource.label,
    url: resource.url,
    provider: resource.provider,
    description: resource.description,
    sharedWith: resource.sharedWith,
    ownerId: resource.ownerId,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

const PROJECT_INCLUDE = {
  tasks: {
    orderBy: { order: "asc" as const },
    include: {
      assignee: { select: { id: true, name: true, username: true, imageUrl: true } },
      asset: { select: { id: true, title: true } },
      dependencies: { include: { dependsOn: { select: { id: true, title: true } } } },
    },
  },
  links: { orderBy: { createdAt: "asc" as const } },
  assets: {
    include: {
      tasks: {
        orderBy: { order: "asc" as const },
        include: {
          assignees: {
            include: { user: { select: { id: true, name: true, imageUrl: true } } },
          },
        },
      },
    },
    orderBy: { order: "asc" as const },
  },
  collaborators: {
    include: {
      user: { select: { id: true, username: true, name: true, imageUrl: true, headline: true } },
    },
  },
};

const FREELANCER_SELECT = {
  id: true,
  username: true,
  name: true,
  imageUrl: true,
  whatsapp: true,
  shareWhatsapp: true,
};

const CLIENT_SELECT = {
  id: true,
  username: true,
  name: true,
  imageUrl: true,
};

/* ══ Queries ═══════════════════════════════════════════════════════════ */

// Todo lo que un client ve en su panel de colaboración: sus solicitudes de
// contacto (con datos públicos del freelancer), sus proyectos conjuntos con
// tareas/links, y sus propios recursos ("Mis recursos").
export async function getClientCollabData(userId: string): Promise<ClientCollabData> {
  const connections = await prisma.connection.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      freelancer: { select: FREELANCER_SELECT },
      projects: { include: PROJECT_INCLUDE, orderBy: { createdAt: "desc" } },
    },
  });

  const resources = await prisma.clientResource.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
  });

  return {
    connections: connections.map((connection) => ({
      id: connection.id,
      status: connection.status,
      message: connection.message,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      freelancer: toFreelancerSummary(connection.freelancer),
    })),
    projects: connections.flatMap((connection) => connection.projects.map(toProject)),
    resources: resources.map(toResource),
  };
}

// Todo lo que un freelancer ve en su panel de colaboración: solicitudes
// pendientes por responder, connections ya aceptadas, proyectos conjuntos
// con tareas/links, y recursos de clients que le compartieron acceso.
export async function getFreelancerCollabData(userId: string): Promise<FreelancerCollabData> {
  const [pending, accepted, sharedResources, collaboratorProjects] = await Promise.all([
    prisma.connection.findMany({
      where: { freelancerId: userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { client: { select: CLIENT_SELECT } },
    }),
    prisma.connection.findMany({
      where: { freelancerId: userId, status: "ACCEPTED" },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: CLIENT_SELECT },
        projects: { include: PROJECT_INCLUDE, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.clientResource.findMany({
      where: { sharedWith: { has: userId } },
      orderBy: { createdAt: "desc" },
      include: { owner: { select: CLIENT_SELECT } },
    }),
    // Proyectos donde el usuario participa como ProjectCollaborator, aunque
    // no sea el freelancer "fundador" de ninguna Connection con ese client
    // (multi-colaborador: varios freelancers en un mismo CollabProject).
    prisma.collabProject.findMany({
      where: { collaborators: { some: { userId } } },
      include: PROJECT_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const foundingProjects = accepted.flatMap((connection) => connection.projects.map(toProject));
  const dedupedCollaboratorProjects = collaboratorProjects
    .map(toProject)
    .filter((project) => !foundingProjects.some((existing) => existing.id === project.id));

  return {
    pendingRequests: pending.map((connection) => ({
      id: connection.id,
      status: connection.status,
      message: connection.message,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      client: toClientSummary(connection.client),
    })),
    connections: accepted.map((connection) => ({
      id: connection.id,
      status: connection.status,
      message: connection.message,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
      client: toClientSummary(connection.client),
    })),
    projects: [...foundingProjects, ...dedupedCollaboratorProjects],
    sharedResources: sharedResources.map((resource) => ({
      ...toResource(resource),
      owner: toClientSummary(resource.owner),
    })),
  };
}

// Proyecto individual con tareas ordenadas y links; solo si userId es parte
// del proyecto: client, freelancer "fundador" de la Connection, o colaborador
// adicional (ProjectCollaborator). null si no existe o el usuario no está
// autorizado a verlo.
export async function getCollabProject(
  projectId: string,
  userId: string,
): Promise<CollabProjectData | null> {
  const project = await prisma.collabProject.findUnique({
    where: { id: projectId },
    include: {
      ...PROJECT_INCLUDE,
      connection: { select: { clientId: true, freelancerId: true } },
    },
  });

  if (!project) return null;

  const isClient = project.connection.clientId === userId;
  const isFreelancer = project.connection.freelancerId === userId;
  const isCollaborator = project.collaborators.some(
    (collaborator) => collaborator.userId === userId,
  );
  if (!isClient && !isFreelancer && !isCollaborator) {
    return null;
  }

  return toProject(project);
}

/* ══ Sugerencias de asignación (Fase 6) ═══════════════════════════════ */

export interface AssigneeSuggestion {
  userId: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  // Afinidad con la categoría solicitada: 3 = coincide con el rol principal,
  // 2 = coincide con un rol secundario, 1 = coincide con un
  // ProjectRoleAssignment del proyecto, 0 = sin match (o sin categoría).
  score: number;
  // Tareas activas (no approved/rejected) que ya tiene asignadas en este
  // proyecto; desempata a igualdad de score (menor carga primero).
  activeTaskCount: number;
}

const INACTIVE_TASK_STATUSES = ["approved", "rejected"];

// Miembros del proyecto (freelancer fundador + colaboradores adicionales)
// ordenados por afinidad con `category` (User.primaryRole/secondaryRoles y
// ProjectRoleAssignment del proyecto) y, a igualdad de score, por menor
// número de tareas activas ya asignadas en este proyecto. Puro read, no
// escribe nada; pensado para alimentar un selector de responsable al crear
// o editar una tarea.
export async function suggestAssignees(
  projectId: string,
  category?: string | null,
): Promise<AssigneeSuggestion[]> {
  const project = await prisma.collabProject.findUnique({
    where: { id: projectId },
    select: {
      connection: { select: { freelancerId: true } },
      collaborators: { select: { userId: true } },
      roleAssignments: { select: { userId: true, role: true } },
    },
  });
  if (!project) return [];

  const memberIds = [
    ...new Set([project.connection.freelancerId, ...project.collaborators.map((c) => c.userId)]),
  ];
  if (memberIds.length === 0) return [];

  const [members, activeTasks] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: {
        id: true,
        name: true,
        username: true,
        imageUrl: true,
        primaryRole: true,
        secondaryRoles: true,
      },
    }),
    prisma.projectTask.findMany({
      where: {
        projectId,
        assigneeId: { in: memberIds },
        status: { notIn: INACTIVE_TASK_STATUSES },
      },
      select: { assigneeId: true },
    }),
  ]);

  const activeTaskCountByUser = new Map<string, number>();
  for (const task of activeTasks) {
    if (!task.assigneeId) continue;
    activeTaskCountByUser.set(
      task.assigneeId,
      (activeTaskCountByUser.get(task.assigneeId) ?? 0) + 1,
    );
  }

  const rolesByUser = new Map<string, Set<ProjectMemberRole>>();
  for (const assignment of project.roleAssignments) {
    const roles = rolesByUser.get(assignment.userId) ?? new Set<ProjectMemberRole>();
    roles.add(assignment.role);
    rolesByUser.set(assignment.userId, roles);
  }

  const normalizedCategory = category?.trim().toLowerCase() || null;

  function affinityScore(member: (typeof members)[number]): number {
    if (!normalizedCategory) return 0;
    if (member.primaryRole?.trim().toLowerCase() === normalizedCategory) return 3;
    if (member.secondaryRoles.some((role) => role.trim().toLowerCase() === normalizedCategory))
      return 2;
    const assignedRoles = rolesByUser.get(member.id);
    if (
      assignedRoles &&
      [...assignedRoles].some((role) => role.toLowerCase() === normalizedCategory)
    )
      return 1;
    return 0;
  }

  return members
    .map((member) => ({
      userId: member.id,
      name: member.name,
      username: member.username,
      imageUrl: member.imageUrl,
      score: affinityScore(member),
      activeTaskCount: activeTaskCountByUser.get(member.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.activeTaskCount - b.activeTaskCount);
}

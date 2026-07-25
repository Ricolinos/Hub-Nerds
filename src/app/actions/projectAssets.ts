"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectAuth } from "@/app/actions/collab";

/* ══ Activos del proyecto: catálogo reutilizable de plantillas (Categoría ══
   ══ → Activo → checklist) que se clona como instancia editable al ══
   ══ agregarse a un CollabProject real. Sistema paralelo a "Tareas" ══
   ══ (ProjectTask), que sigue existiendo sin cambios. ══════════════════ */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireAuth(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

function revalidateUsernames(...usernames: (string | null | undefined)[]): void {
  for (const username of usernames) {
    if (username) revalidatePath(`/${username}`);
  }
}

/* ══ Catálogo (contenido de referencia global, no atado a un proyecto) ══ */

export interface AssetCategoryData {
  id: string;
  name: string;
  templates: {
    id: string;
    name: string;
    taskTemplates: { id: string; title: string }[];
  }[];
}

// Solo requiere estar logueado; el catálogo es contenido de referencia del
// estudio, no pertenece a ningún proyecto ni client en particular.
export async function getAssetCatalog(): Promise<AssetCategoryData[]> {
  const userId = await requireAuth();
  if (!userId) return [];

  const categories = await prisma.assetCategory.findMany({
    orderBy: { order: "asc" },
    include: {
      templates: {
        orderBy: { order: "asc" },
        include: {
          taskTemplates: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    templates: category.templates.map((template) => ({
      id: template.id,
      name: template.name,
      taskTemplates: template.taskTemplates.map((task) => ({ id: task.id, title: task.title })),
    })),
  }));
}

/* ══ Activos del proyecto ═════════════════════════════════════════════ */

// Client o freelancer pueden agregar Activos, clonando la plantilla
// elegida (título + checklist) en una sola transacción.
export async function addProjectAsset(
  projectId: string,
  assetTemplateId: string,
): Promise<Result<{ assetId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const auth = await getProjectAuth(projectId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isClient && !auth.isFreelancer) return { ok: false, error: "No autorizado" };

  const template = await prisma.assetTemplate.findUnique({
    where: { id: assetTemplateId },
    include: { taskTemplates: { orderBy: { order: "asc" } } },
  });
  if (!template) return { ok: false, error: "Plantilla de activo no encontrada." };

  const assetCount = await prisma.projectAsset.count({ where: { projectId } });

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.projectAsset.create({
      data: {
        projectId,
        title: template.name,
        assetTemplateId: template.id,
        order: assetCount,
      },
      select: { id: true },
    });

    if (template.taskTemplates.length > 0) {
      await tx.projectAssetTask.createMany({
        data: template.taskTemplates.map((taskTemplate, index) => ({
          assetId: created.id,
          title: taskTemplate.title,
          order: index,
          done: false,
        })),
      });
    }

    return created;
  });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true, assetId: asset.id };
}

// Igual que addProjectAsset pero sin plantilla: permite crear un Activo
// libre cuando ninguna plantilla del catálogo aplica. Sin checklist inicial.
export async function addCustomProjectAsset(projectId: string, title: string): Promise<Result<{ assetId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "El título del activo es obligatorio." };

  const auth = await getProjectAuth(projectId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isClient && !auth.isFreelancer) return { ok: false, error: "No autorizado" };

  const assetCount = await prisma.projectAsset.count({ where: { projectId } });

  const asset = await prisma.projectAsset.create({
    data: {
      projectId,
      title: trimmedTitle,
      assetTemplateId: null,
      order: assetCount,
    },
    select: { id: true },
  });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true, assetId: asset.id };
}

// Resuelve el proyecto dueño de un Activo para reutilizar getProjectAuth.
async function getAssetProjectAuth(assetId: string, userId: string) {
  const asset = await prisma.projectAsset.findUnique({
    where: { id: assetId },
    select: { projectId: true },
  });
  if (!asset) return { projectId: null, auth: { ok: false as const, error: "Activo no encontrado." } };

  const auth = await getProjectAuth(asset.projectId, userId);
  return { projectId: asset.projectId, auth };
}

// Solo el freelancer renombra el activo.
export async function renameProjectAsset(assetId: string, title: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "El título del activo es obligatorio." };

  const { auth } = await getAssetProjectAuth(assetId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isFreelancer) return { ok: false, error: "Solo el freelancer puede editar activos." };

  await prisma.projectAsset.update({ where: { id: assetId }, data: { title: trimmedTitle } });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true };
}

// Solo el freelancer elimina el activo (y su checklist, en cascada).
export async function deleteProjectAsset(assetId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { auth } = await getAssetProjectAuth(assetId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isFreelancer) return { ok: false, error: "Solo el freelancer puede eliminar activos." };

  await prisma.projectAsset.delete({ where: { id: assetId } });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true };
}

/* ══ Checklist de un activo ═══════════════════════════════════════════ */

// Resuelve el proyecto dueño de una tarea de activo (vía su Activo) para
// reutilizar getProjectAuth.
async function getAssetTaskProjectAuth(taskId: string, userId: string) {
  const task = await prisma.projectAssetTask.findUnique({
    where: { id: taskId },
    select: { assetId: true, asset: { select: { projectId: true } } },
  });
  if (!task) return { assetId: null, auth: { ok: false as const, error: "Tarea no encontrada." } };

  const auth = await getProjectAuth(task.asset.projectId, userId);
  return { assetId: task.assetId, auth };
}

// Solo el freelancer agrega tareas al checklist.
export async function addProjectAssetTask(assetId: string, title: string): Promise<Result<{ taskId: string }>> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "El título de la tarea es obligatorio." };

  const { auth } = await getAssetProjectAuth(assetId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isFreelancer) return { ok: false, error: "Solo el freelancer puede editar el checklist." };

  const taskCount = await prisma.projectAssetTask.count({ where: { assetId } });

  const task = await prisma.projectAssetTask.create({
    data: { assetId, title: trimmedTitle, order: taskCount, done: false },
    select: { id: true },
  });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true, taskId: task.id };
}

// Solo el freelancer renombra tareas del checklist.
export async function renameProjectAssetTask(taskId: string, title: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { ok: false, error: "El título de la tarea es obligatorio." };

  const { auth } = await getAssetTaskProjectAuth(taskId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isFreelancer) return { ok: false, error: "Solo el freelancer puede editar el checklist." };

  await prisma.projectAssetTask.update({ where: { id: taskId }, data: { title: trimmedTitle } });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true };
}

// Solo el freelancer elimina tareas del checklist.
export async function deleteProjectAssetTask(taskId: string): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { auth } = await getAssetTaskProjectAuth(taskId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };
  if (!auth.isFreelancer) return { ok: false, error: "Solo el freelancer puede editar el checklist." };

  await prisma.projectAssetTask.delete({ where: { id: taskId } });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true };
}

// Client O freelancer: cualquier autorizado del proyecto puede
// marcar/desmarcar checkboxes (varios pasos, como "Feedback de bocetos" o
// "Aprobación final", son responsabilidad del client).
export async function toggleProjectAssetTask(taskId: string, done: boolean): Promise<Result> {
  const userId = await requireAuth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { auth } = await getAssetTaskProjectAuth(taskId, userId);
  if (!auth.ok) return { ok: false, error: auth.error ?? "No autorizado" };

  await prisma.projectAssetTask.update({ where: { id: taskId }, data: { done } });

  revalidateUsernames(auth.clientUsername, auth.freelancerUsername);
  return { ok: true };
}

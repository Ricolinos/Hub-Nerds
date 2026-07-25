"use server";

import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/projectStatus";
import { isFreelancerRole } from "@/lib/roles";

// Solo el freelancer (rol interno "freelancer") puede cambiar el estatus
// de cualquier proyecto/cotización.
export async function updateProjectStatus(projectId: string, status: string): Promise<void> {
  if (!PROJECT_STATUSES.includes(status as ProjectStatus)) {
    throw new Error(`Estatus inválido: ${status}`);
  }

  const user = await currentUser();
  if (!user) throw new Error("No autenticado");
  if (!isFreelancerRole(user.publicMetadata?.role as string | undefined)) {
    throw new Error("No autorizado: se requiere rol de freelancer");
  }

  await prisma.projectQuote.update({
    where: { id: projectId },
    data: { status },
  });

  revalidatePath("/dashboard/client/projects");
  revalidatePath("/dashboard/freelancer");
}

import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getCollabProject } from "@/lib/collab";
import { getAssetCatalog } from "@/app/actions/projectAssets";
import { CollabProjectView } from "@/components/collab/CollabProjectView";

interface CollabProjectPageProps {
  params: Promise<{ id: string }>;
}

// Detalle de un proyecto colaborativo client↔freelancer: activos con checklist,
// links de archivos externos y configuración del proyecto. Ver
// src/lib/collab.ts (getCollabProject) y src/app/actions/collab.ts.
export default async function CollabProjectPage({ params }: CollabProjectPageProps) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [project, assetCatalog] = await Promise.all([getCollabProject(id, userId), getAssetCatalog()]);
  if (!project) notFound();

  // getCollabProject no proyecta client/freelancer (solo connectionId): se
  // resuelven aquí para la cabecera y para decidir el rol del viewer.
  const connection = await prisma.connection.findUnique({
    where: { id: project.connectionId },
    select: {
      client: { select: { id: true, username: true, name: true, imageUrl: true } },
      freelancer: { select: { id: true, username: true, name: true, imageUrl: true } },
    },
  });
  if (!connection) notFound();

  const viewerRole = connection.client.id === userId ? "client" : "freelancer";

  // Candidatos a agregar como colaborador adicional: freelancers con Connection
  // ACCEPTED con el mismo client, excluyendo al freelancer fundador y a los
  // que ya sean colaboradores del proyecto.
  const availableConnections = await prisma.connection.findMany({
    where: {
      clientId: connection.client.id,
      status: "ACCEPTED",
      freelancerId: { notIn: [connection.freelancer.id, ...project.collaborators.map((c) => c.id)] },
    },
    include: {
      freelancer: { select: { id: true, username: true, name: true, imageUrl: true, headline: true } },
    },
  });
  const availableFreelancers = availableConnections.map((c) => c.freelancer);

  return (
    <CollabProjectView
      project={project}
      client={connection.client}
      freelancer={connection.freelancer}
      viewerRole={viewerRole}
      viewerId={userId}
      assetCatalog={assetCatalog}
      availableFreelancers={availableFreelancers}
    />
  );
}

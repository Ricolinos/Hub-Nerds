import { auth, currentUser } from "@clerk/nextjs/server";
import { Button, Column, Grid, Row } from "@once-ui-system/core";
import { redirect } from "next/navigation";
import { ChangelogWidget } from "@/components/dashboard/ChangelogWidget";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";
import { PendingRequestsWidget } from "@/components/dashboard/PendingRequestsWidget";
import { ProfileStrengthWidget } from "@/components/dashboard/ProfileStrengthWidget";
import { ProjectListWidget } from "@/components/dashboard/ProjectListWidget";
import { getFreelancerCollabData } from "@/lib/collab";
import { prisma } from "@/lib/prisma";
import { computeProfileStrength } from "@/lib/profileStrength";
import { getOrCreateUser } from "@/lib/syncUser";
import { isFreelancerRole } from "@/lib/roles";

export default async function FreelancerDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  if (!isFreelancerRole(user?.publicMetadata?.role as string | undefined)) redirect("/dashboard");

  // getOrCreateUser (no findUniqueOrThrow): el layout siembra el User en
  // paralelo, sin garantía de orden frente al render de esta page (Next no
  // secuencia layout antes que page) — llamarlo aquí también evita la
  // condición de carrera para altas nuevas (p. ej. login con Google).
  const [dbUser, { pendingRequests, projects }, publicPieceCount] = await Promise.all([
    getOrCreateUser(),
    getFreelancerCollabData(userId),
    // Solo piezas públicas: un borrador no le sirve a nadie que esté mirando
    // el perfil, así que tampoco debe contar como progreso.
    prisma.portfolioPiece.count({ where: { userId, isPublic: true } }),
  ]);
  const username = dbUser?.username ?? null;

  // Sin username no hay a dónde enlazar (las sugerencias abren modales de
  // /[username]), así que el widget se omite hasta que lo tenga.
  const profileStrength =
    dbUser && username
      ? computeProfileStrength({
          imageUrl: dbUser.imageUrl,
          headline: dbUser.headline,
          bio: dbUser.bio,
          primaryRole: dbUser.primaryRole,
          featuredImageUrl: dbUser.featuredImageUrl,
          cardQuote: dbUser.cardQuote,
          publicPieceCount,
        })
      : null;

  const activeProjects = projects.filter((project) => project.status === "active");
  const finishedProjects = projects.filter((project) => project.status !== "active");
  const pendingTasks = projects.reduce(
    (total, project) => total + project.tasks.filter((task) => task.status === "pending").length,
    0,
  );

  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">
      <DashboardHero name={dbUser?.name ?? null} viewerRole="freelancer" />

      {profileStrength && username && (
        <ProfileStrengthWidget strength={profileStrength} username={username} />
      )}

      <DashboardMetrics
        metrics={[
          { label: "Proyectos activos", value: activeProjects.length, icon: "briefcase" },
          { label: "Proyectos finalizados", value: finishedProjects.length, icon: "check" },
          { label: "Solicitudes pendientes", value: pendingRequests.length, icon: "person" },
          { label: "Tareas pendientes", value: pendingTasks, icon: "sparkles" },
        ]}
      />

      <Row gap="12" wrap>
        {username && (
          <Button variant="primary" size="m" prefixIcon="plus" href={`/${username}`}>
            Agregar proyecto
          </Button>
        )}
      </Row>

      {pendingRequests.length > 0 && <PendingRequestsWidget requests={pendingRequests} />}

      <ProjectListWidget
        title="Proyectos en curso"
        projects={activeProjects}
        emptyMessage="Aún no tienes proyectos activos."
        limit={5}
      />

      <ProjectListWidget
        title="Proyectos finalizados"
        projects={finishedProjects}
        emptyMessage="Todavía no tienes proyectos finalizados."
        limit={5}
      />

      <Grid columns="2" s={{ columns: 1 }} fillWidth gap="24">
        <NotificationsWidget />
        <ChangelogWidget />
      </Grid>
    </Column>
  );
}

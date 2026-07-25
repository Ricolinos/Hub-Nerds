import { auth, currentUser } from "@clerk/nextjs/server";
import { Button, Column, Feedback, Grid, Row } from "@once-ui-system/core";
import { redirect } from "next/navigation";
import { isFreelancerRole } from "@/lib/roles";
import { ChangelogWidget } from "@/components/dashboard/ChangelogWidget";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";
import { ProjectListWidget } from "@/components/dashboard/ProjectListWidget";
import { getClientCollabData } from "@/lib/collab";
import { getOrCreateUser } from "@/lib/syncUser";

export default async function ClientDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  if (isFreelancerRole(user?.publicMetadata?.role as string | undefined)) redirect("/dashboard/freelancer");

  // getOrCreateUser (no findUniqueOrThrow): el layout siembra el User en
  // paralelo, sin garantía de orden frente al render de esta page (Next no
  // secuencia layout antes que page) — llamarlo aquí también evita la
  // condición de carrera para altas nuevas (p. ej. login con Google).
  const [dbUser, { connections, projects }] = await Promise.all([
    getOrCreateUser(),
    getClientCollabData(userId),
  ]);
  const username = dbUser?.username ?? null;

  const activeProjects = projects.filter((project) => project.status === "active");
  const finishedProjects = projects.filter((project) => project.status !== "active");
  const tasksToApprove = projects.reduce(
    (total, project) => total + project.tasks.filter((task) => task.status === "in_review").length,
    0,
  );
  const pendingConnections = connections.filter((connection) => connection.status === "PENDING");

  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">
      <DashboardHero name={dbUser?.name ?? null} viewerRole="client" />

      {pendingConnections.map((connection) => (
        <Feedback
          key={connection.id}
          variant="info"
          fillWidth
          description={`Esperando respuesta de ${connection.freelancer.name ?? connection.freelancer.username ?? "el freelancer"}.`}
        />
      ))}

      <DashboardMetrics
        metrics={[
          { label: "Proyectos activos", value: activeProjects.length, icon: "briefcase" },
          { label: "Proyectos finalizados", value: finishedProjects.length, icon: "check" },
          { label: "Tareas por aprobar", value: tasksToApprove, icon: "sparkles" },
        ]}
      />

      <Row gap="12" wrap>
        {username && (
          <>
            <Button variant="primary" size="m" prefixIcon="plus" href={`/${username}`}>
              Crear nuevo proyecto
            </Button>
            <Button variant="secondary" size="m" prefixIcon="folder" href={`/${username}`}>
              Mis recursos
            </Button>
          </>
        )}
      </Row>

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

import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Column, Heading, Text } from "@once-ui-system/core";
import { getClientCollabData } from "@/lib/collab";
import { ProjectListWidget } from "@/components/dashboard/ProjectListWidget";
import { isFreelancerRole } from "@/lib/roles";

export default async function ClientActiveProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const user = await currentUser();
  if (isFreelancerRole(user?.publicMetadata?.role as string | undefined)) redirect("/dashboard/freelancer");

  const { projects } = await getClientCollabData(userId);
  const activeProjects = projects.filter((project) => project.status === "active");

  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">
      <Column gap="4" fillWidth>
        <Heading variant="heading-strong-l">Proyectos en curso</Heading>
        <Text onBackground="neutral-weak" variant="body-default-m">
          Todos tus proyectos conjuntos activos.
        </Text>
      </Column>

      <ProjectListWidget
        projects={activeProjects}
        emptyMessage="Aún no tienes proyectos activos."
      />
    </Column>
  );
}

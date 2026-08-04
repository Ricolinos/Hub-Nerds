import { redirect } from "next/navigation";
import { Button, Column, Feedback, Heading, Text } from "@once-ui-system/core";
import { ContestManagementPanel } from "@/components/contests/ContestManagementPanel";
import { getMyContestsManagement } from "@/lib/contests";
import { getOrCreateUser } from "@/lib/syncUser";

export const metadata = {
  title: "Gestionar mis convocatorias",
  description: "Cupo, borradores, publicación y prórrogas de todas tus convocatorias en un solo panel.",
};

// Consulta la BD (rol del usuario logueado + convocatorias propias): evita
// congelar el fetch en build. Mismo patrón que /convocatorias/nueva.
export const dynamic = "force-dynamic";

export default async function ContestManagementPage() {
  const dbUser = await getOrCreateUser();

  if (!dbUser) {
    return (
      <Column fillWidth maxWidth="s" paddingY="80" paddingX="24" gap="16" horizontal="center" align="center">
        <Heading variant="heading-strong-l">Gestionar mis convocatorias</Heading>
        <Feedback
          variant="info"
          fillWidth
          description="Inicia sesión como client para gestionar tus convocatorias."
        />
        <Button variant="primary" size="m" href="/sign-in">
          Iniciar sesión
        </Button>
      </Column>
    );
  }

  if (dbUser.role !== "client") {
    return (
      <Column fillWidth maxWidth="s" paddingY="80" paddingX="24" gap="16" horizontal="center" align="center">
        <Heading variant="heading-strong-l">Gestionar mis convocatorias</Heading>
        <Feedback variant="info" fillWidth description="Solo un client puede gestionar convocatorias." />
        <Button variant="secondary" size="m" href="/convocatorias">
          Volver a convocatorias
        </Button>
      </Column>
    );
  }

  // Defensivo: getMyContestsManagement resuelve su propia auth y ya valida
  // rol client, pero por diseño puede devolver null (p.ej. carrera con el
  // gate de arriba); ante ese caso, redirigir en vez de romper el render.
  const data = await getMyContestsManagement();
  if (!data) redirect("/convocatorias");

  return (
    <Column fillWidth maxWidth="l" paddingY="48" paddingX="24" gap="24" horizontal="center">
      <Column gap="4" fillWidth maxWidth="m">
        <Heading variant="display-strong-xs">Gestionar mis convocatorias</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Cupo, borradores, publicación y prórrogas de todas tus convocatorias.
        </Text>
      </Column>
      <ContestManagementPanel data={data} />
    </Column>
  );
}

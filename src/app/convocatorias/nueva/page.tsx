import { Button, Column, Feedback, Heading, Text } from "@once-ui-system/core";
import { ContestWizardForm } from "@/components/contests/ContestWizardForm";
import { getOrCreateUser } from "@/lib/syncUser";

export const metadata = {
  title: "Nueva convocatoria",
  description: "Publica un concurso creativo justo: premio, fee de Terna garantizado y fechas claras.",
};

// Consulta la BD (rol del usuario logueado): evita congelar el fetch en build.
export const dynamic = "force-dynamic";

export default async function NewContestPage() {
  const dbUser = await getOrCreateUser();

  if (!dbUser) {
    return (
      <Column fillWidth maxWidth="s" paddingY="80" paddingX="24" gap="16" horizontal="center" align="center">
        <Heading variant="heading-strong-l">Nueva convocatoria</Heading>
        <Feedback
          variant="info"
          fillWidth
          description="Inicia sesión como client para publicar una convocatoria."
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
        <Heading variant="heading-strong-l">Nueva convocatoria</Heading>
        <Feedback
          variant="info"
          fillWidth
          description="Solo un client puede publicar convocatorias."
        />
        <Button variant="secondary" size="m" href="/convocatorias">
          Volver a convocatorias
        </Button>
      </Column>
    );
  }

  return (
    <Column fillWidth maxWidth="l" paddingY="48" paddingX="24" gap="24" horizontal="center">
      <Column gap="4" fillWidth maxWidth="m">
        <Heading variant="display-strong-xs">Nueva convocatoria</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          La transparencia es el feature: premio, fee de Terna garantizado y fechas visibles desde el inicio.
        </Text>
      </Column>
      <ContestWizardForm />
    </Column>
  );
}

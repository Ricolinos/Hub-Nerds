import { Button, Column, Grid, Heading, Row, Text } from "@once-ui-system/core";
import type { User } from "@/generated/prisma/client";
import { ContestApplicationCard } from "@/components/contests/ContestApplicationCard";
import { ContestCard } from "@/components/contests/ContestCard";
import { ContestRecordSection } from "@/components/contests/ContestRecordSection";
import {
  getApplicationsForFreelancer,
  getClosedContests,
  getContestsForClient,
  getPublishedContests,
} from "@/lib/contests";
import { getOrCreateUser } from "@/lib/syncUser";
import { isFreelancerRole } from "@/lib/roles";

export const metadata = {
  title: "Convocatorias",
  description: "Concursos creativos justos: premio, fee de Terna garantizado y fechas transparentes.",
};

// Consulta la BD (convocatorias + rol del usuario logueado): evita congelar el fetch en build.
export const dynamic = "force-dynamic";

type ContestsView = "recientes" | "mias" | "cerradas";

// Submenús del grupo "Convocatorias" en el MegaMenu (Header.tsx): sin ?vista
// = recientes (comportamiento original), ?vista=mias = panel personal,
// ?vista=cerradas = terminadas (AWARDED/CANCELLED/BREACHED).
function resolveView(vista: string | undefined): ContestsView {
  if (vista === "mias") return "mias";
  if (vista === "cerradas") return "cerradas";
  return "recientes";
}

export default async function ContestsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  const { vista } = await searchParams;
  const view = resolveView(vista);
  const dbUser = await getOrCreateUser();

  return (
    <Column fillWidth maxWidth="l" paddingY="48" paddingX="24" gap="40" horizontal="center">
      {view === "recientes" && <RecentContestsView dbUser={dbUser} />}
      {view === "mias" && <MyContestsView dbUser={dbUser} />}
      {view === "cerradas" && <ClosedContestsView />}
    </Column>
  );
}

async function RecentContestsView({ dbUser }: { dbUser: User | null }) {
  const [published, clientContests, myApplications] = await Promise.all([
    getPublishedContests(),
    dbUser?.role === "client" ? getContestsForClient(dbUser.id) : Promise.resolve([]),
    dbUser && isFreelancerRole(dbUser.role)
      ? getApplicationsForFreelancer(dbUser.id)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Row fillWidth horizontal="between" vertical="center" wrap gap="16">
        <Column gap="4">
          <Heading variant="display-strong-xs">Convocatorias</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Concursos creativos justos: premio, fee de Terna garantizado y fechas claras desde el inicio.
          </Text>
        </Column>
        {dbUser?.role === "client" && (
          <Button variant="primary" size="m" prefixIcon="plus" href="/convocatorias/nueva">
            Nueva convocatoria
          </Button>
        )}
      </Row>

      {dbUser?.role === "client" && clientContests.length > 0 && (
        <Column fillWidth gap="16">
          <Heading variant="heading-strong-s">Mis convocatorias</Heading>
          <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
            {clientContests.map((contest) => (
              <ContestCard
                key={contest.id}
                contest={contest}
                client={{
                  id: dbUser.id,
                  username: dbUser.username,
                  name: dbUser.name,
                  imageUrl: dbUser.imageUrl,
                  headline: dbUser.headline,
                }}
              />
            ))}
          </Grid>
        </Column>
      )}

      {isFreelancerRole(dbUser?.role) && myApplications.length > 0 && (
        <Column fillWidth gap="16">
          <Heading variant="heading-strong-s">Mis postulaciones</Heading>
          <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
            {myApplications.map((application) => (
              <ContestApplicationCard key={application.id} application={application} />
            ))}
          </Grid>
        </Column>
      )}

      <Column fillWidth gap="16">
        <Heading variant="heading-strong-s">Abiertas</Heading>
        {published.length === 0 ? (
          <Text variant="body-default-m" onBackground="neutral-weak">
            Todavía no hay convocatorias publicadas. Vuelve pronto.
          </Text>
        ) : (
          <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
            {published.map((contest) => (
              <ContestCard key={contest.id} contest={contest} />
            ))}
          </Grid>
        )}
      </Column>

      {dbUser && <ContestRecordSection userId={dbUser.id} role={dbUser.role} />}
    </>
  );
}

async function MyContestsView({ dbUser }: { dbUser: User | null }) {
  if (!dbUser) {
    return (
      <>
        <Column gap="4">
          <Heading variant="display-strong-xs">Mis convocatorias</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Inicia sesión para ver tus convocatorias o tus postulaciones.
          </Text>
        </Column>
        <Button variant="primary" size="m" href="/sign-in">
          Iniciar sesión
        </Button>
      </>
    );
  }

  if (isFreelancerRole(dbUser.role)) {
    const myApplications = await getApplicationsForFreelancer(dbUser.id);
    return (
      <>
        <Column gap="4">
          <Heading variant="display-strong-xs">Mis postulaciones</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Convocatorias a las que te postulaste, con su estado más reciente.
          </Text>
        </Column>
        {myApplications.length === 0 ? (
          <Text variant="body-default-m" onBackground="neutral-weak">
            Todavía no te has postulado a ninguna convocatoria.
          </Text>
        ) : (
          <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
            {myApplications.map((application) => (
              <ContestApplicationCard key={application.id} application={application} />
            ))}
          </Grid>
        )}
        <ContestRecordSection userId={dbUser.id} role={dbUser.role} />
      </>
    );
  }

  // Client (o rol sin postulaciones/convocatorias propias): incluye
  // borradores, a diferencia de la vista "Abiertas" de recientes.
  const clientContests = await getContestsForClient(dbUser.id);
  return (
    <>
      <Row fillWidth horizontal="between" vertical="center" wrap gap="16">
        <Column gap="4">
          <Heading variant="display-strong-xs">Mis convocatorias</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Todas tus convocatorias, incluidos los borradores.
          </Text>
        </Column>
        <Button variant="primary" size="m" prefixIcon="plus" href="/convocatorias/nueva">
          Nueva convocatoria
        </Button>
      </Row>
      {clientContests.length === 0 ? (
        <Text variant="body-default-m" onBackground="neutral-weak">
          Todavía no has creado ninguna convocatoria.
        </Text>
      ) : (
        <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
          {clientContests.map((contest) => (
            <ContestCard
              key={contest.id}
              contest={contest}
              client={{
                id: dbUser.id,
                username: dbUser.username,
                name: dbUser.name,
                imageUrl: dbUser.imageUrl,
                headline: dbUser.headline,
              }}
            />
          ))}
        </Grid>
      )}
      <ContestRecordSection userId={dbUser.id} role={dbUser.role} />
    </>
  );
}

async function ClosedContestsView() {
  const closed = await getClosedContests();

  return (
    <>
      <Column gap="4">
        <Heading variant="display-strong-xs">Convocatorias cerradas</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Concursos con fallo emitido, cancelados o incumplidos.
        </Text>
      </Column>
      {closed.length === 0 ? (
        <Text variant="body-default-m" onBackground="neutral-weak">
          Todavía no hay convocatorias cerradas.
        </Text>
      ) : (
        <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
          {closed.map((contest) => (
            <ContestCard key={contest.id} contest={contest} />
          ))}
        </Grid>
      )}
    </>
  );
}

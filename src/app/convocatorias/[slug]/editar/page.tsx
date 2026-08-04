import { notFound, redirect } from "next/navigation";
import { Column, Heading, Text } from "@once-ui-system/core";
import { ContestWizardForm } from "@/components/contests/ContestWizardForm";
import { toContestBlocks } from "@/lib/contestBrief";
import { getContestBySlug } from "@/lib/contests";
import { isPro } from "@/lib/plan";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/syncUser";

export const dynamic = "force-dynamic";

interface EditContestPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EditContestPageProps) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug);
  if (!contest) return {};
  return { title: `Editar · ${contest.title}` };
}

// Solo el client dueño, y solo mientras la convocatoria siga DRAFT (mismo
// guard que updateContest, src/app/actions/contests.ts): cualquier otro caso
// redirige al detalle público en vez de 404, porque la ruta en sí es válida
// una vez publicada, solo que deja de ser editable por aquí.
export default async function EditContestPage({ params }: EditContestPageProps) {
  const { slug } = await params;
  const [contest, dbUser] = await Promise.all([getContestBySlug(slug), getOrCreateUser()]);
  if (!contest) notFound();

  const isOwner = dbUser?.id === contest.clientId;
  if (!isOwner || contest.status !== "DRAFT") redirect(`/convocatorias/${slug}`);

  // Premio en especie (prizeType/prizeDescription/responsibilityAcceptedAt):
  // getContestBySlug (src/lib/contests.ts) no los expone en ContestDetail
  // todavía, así que se completan aquí con una lectura puntual por id, sin
  // tocar esa lib compartida (mismo patrón de lectura directa que otras
  // server pages, ej. src/app/[username]/page.tsx).
  const prizeFields = await prisma.contest.findUnique({
    where: { id: contest.id },
    select: { prizeType: true, prizeDescription: true, responsibilityAcceptedAt: true },
  });

  return (
    <Column fillWidth maxWidth="l" paddingY="48" paddingX="24" gap="24" horizontal="center">
      <Column gap="4" fillWidth maxWidth="m">
        <Heading variant="display-strong-xs">Editar convocatoria</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Ajusta los datos de tu borrador antes de publicarlo.
        </Text>
      </Column>
      <ContestWizardForm
        isPro={isPro(dbUser)}
        initialContest={{
          id: contest.id,
          slug: contest.slug,
          title: contest.title,
          projectType: contest.projectType,
          projectSubtype: contest.projectSubtype,
          prizeAmount: contest.prizeAmount,
          shortlistFee: contest.shortlistFee,
          shortlistSize: contest.shortlistSize,
          maxApplicants: contest.maxApplicants,
          applyDeadline: contest.applyDeadline,
          submitDeadline: contest.submitDeadline,
          resultsDate: contest.resultsDate,
          rightsPolicy: contest.rightsPolicy,
          briefBlocks: toContestBlocks(contest.brief),
          termsBlocks: toContestBlocks(contest.terms),
          prizeType: prizeFields?.prizeType ?? "MONETARY",
          prizeDescription: prizeFields?.prizeDescription ?? null,
          responsibilityAcceptedAt: prizeFields?.responsibilityAcceptedAt?.toISOString() ?? null,
          stages: contest.stages,
        }}
      />
    </Column>
  );
}

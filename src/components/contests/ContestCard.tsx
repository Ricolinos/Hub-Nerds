import { Avatar, Card, Column, Row, Tag, Text } from "@once-ui-system/core";
import type { ContestSummary, ContestUserSummary } from "@/lib/contests";
import { contestPhaseTag, daysUntilLabel, formatContestMoney } from "@/lib/contestPhaseUi";

/* ══ Tarjeta compartida de convocatoria ═══════════════════════════════════
   Mismo lenguaje visual que ShoutCard (src/components/explore/ExploreFeed.tsx):
   Card interactivo (href) + Column con paddingX/gap, chip de fase en vez de
   categoría. Reusada en /convocatorias (listado público + "Mis
   convocatorias") — la sección "Mis postulaciones" usa ContestApplicationCard
   (misma carpeta) porque trae un shape distinto (FreelancerApplicationDetail).
   ══════════════════════════════════════════════════════════════════════ */

export function ContestCard({
  contest,
  client,
}: {
  contest: ContestSummary;
  client?: ContestUserSummary;
}) {
  const phase = contestPhaseTag(contest.phase);
  const cupoRestante =
    contest.maxApplicants != null ? Math.max(contest.maxApplicants - contest.applicationCount, 0) : null;
  const brandName = client?.name ?? client?.username ?? "Client";
  const brandInitial = (brandName[0] ?? "C").toUpperCase();
  const avatarProps = client?.imageUrl ? { src: client.imageUrl } : { value: brandInitial };

  return (
    <Card fillWidth direction="column" radius="l" border="neutral-alpha-weak" background="neutral-alpha-weak" href={`/convocatorias/${contest.slug}`}>
      <Row fillWidth horizontal="between" vertical="center" paddingX="20" paddingY="16" gap="12">
        <Row gap="12" vertical="center" minWidth={0} flex={1}>
          <Avatar {...avatarProps} size="m" />
          <Text variant="label-strong-m" onBackground="neutral-strong" truncate>
            {brandName}
          </Text>
        </Row>
        <Tag size="s" variant={phase.variant} label={phase.label} />
      </Row>

      <Column fillWidth paddingX="20" paddingBottom="20" gap="16">
        <Column fillWidth gap="4">
          <Text variant="heading-strong-s" onBackground="neutral-strong" truncate>
            {contest.title}
          </Text>
          {contest.projectType && (
            <Text variant="body-default-s" onBackground="neutral-weak" truncate>
              {contest.projectType}
              {contest.projectSubtype ? ` · ${contest.projectSubtype}` : ""}
            </Text>
          )}
        </Column>

        <Row fillWidth gap="24" wrap>
          <Column gap="2">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Premio
            </Text>
            <Text variant="heading-strong-s" onBackground="brand-medium">
              {formatContestMoney(contest.prizeAmount, contest.currency)}
            </Text>
          </Column>
          <Column gap="2">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Fee de Terna
            </Text>
            <Text variant="label-strong-m" onBackground="neutral-strong">
              {formatContestMoney(contest.shortlistFee, contest.currency)}
            </Text>
          </Column>
        </Row>

        <Row fillWidth horizontal="between" vertical="center">
          <Text variant="body-default-s" onBackground="neutral-weak">
            {contest.phase === "applications" ? daysUntilLabel(contest.applyDeadline) : phase.label}
          </Text>
          {cupoRestante != null && (
            <Text variant="body-default-s" onBackground="neutral-weak">
              {cupoRestante === 0
                ? "Cupo lleno"
                : cupoRestante === 1
                  ? "1 lugar"
                  : `${cupoRestante} lugares`}
            </Text>
          )}
        </Row>
      </Column>
    </Card>
  );
}

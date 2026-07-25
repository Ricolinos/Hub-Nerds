import { Card, Column, Row, Tag, Text } from "@once-ui-system/core";
import type { FreelancerApplicationDetail } from "@/lib/contests";
import { contestApplicationStatusTag, contestPhaseTag, formatContestMoney } from "@/lib/contestPhaseUi";

/* ══ Tarjeta de "Mis postulaciones" (panel del freelancer) ══════════════════
   Distinta de ContestCard: el dato central es el ESTADO de la postulación
   propia (contestApplicationStatusTag), no la fase pública de la
   convocatoria (que igual se muestra, más discreta). ══════════════════ */

export function ContestApplicationCard({ application }: { application: FreelancerApplicationDetail }) {
  const status = contestApplicationStatusTag(application.status);
  const phase = contestPhaseTag(application.contest.phase);

  return (
    <Card
      fillWidth
      direction="column"
      radius="l"
      border="neutral-alpha-weak"
      background="neutral-alpha-weak"
      href={`/convocatorias/${application.contest.slug}`}
    >
      <Column fillWidth padding="20" gap="12">
        <Row fillWidth horizontal="between" vertical="center" gap="12">
          <Text variant="heading-strong-s" onBackground="neutral-strong" truncate>
            {application.contest.title}
          </Text>
          <Tag size="s" variant={status.variant} label={status.label} />
        </Row>
        <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Premio {formatContestMoney(application.contest.prizeAmount, application.contest.currency)} · Fee{" "}
            {formatContestMoney(application.contest.shortlistFee, application.contest.currency)}
          </Text>
          <Tag size="s" variant={phase.variant} label={phase.label} />
        </Row>
      </Column>
    </Card>
  );
}

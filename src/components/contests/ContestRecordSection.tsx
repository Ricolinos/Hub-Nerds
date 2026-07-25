import { Column, IconButton, Line, Row, Text } from "@once-ui-system/core";
import { getClientContestRecord, getFreelancerContestRecord } from "@/lib/contestStats";
import { formatContestMoney } from "@/lib/contestPhaseUi";
import { isFreelancerRole } from "@/lib/roles";

/* ══ "Mi récord" privado, al pie de /convocatorias ═══════════════════════
   Mínima info visible (preferencia del usuario): solo números + labels
   cortas, con un IconButton "info" (tooltip nativo al hover, sin overlay
   propio) que explica cada métrica. Nunca visible a otro usuario ni al
   visitante anónimo (el caller solo la monta si hay dbUser). ═══════════ */

function Stat({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <Column gap="4">
      <Row gap="4" vertical="center">
        <Text variant="label-default-s" onBackground="neutral-weak">
          {label}
        </Text>
        <IconButton icon="info" variant="ghost" size="s" tooltip={tooltip} aria-label={`Qué significa ${label}`} />
      </Row>
      <Text variant="heading-strong-m" onBackground="neutral-strong">
        {value}
      </Text>
    </Column>
  );
}

export async function ContestRecordSection({ userId, role }: { userId: string; role: string | null }) {
  if (role !== "client" && !isFreelancerRole(role)) return null;

  return (
    <Column fillWidth gap="16">
      <Line background="neutral-alpha-weak" />
      <Text variant="label-strong-s" onBackground="neutral-weak">
        Mi récord
      </Text>
      {isFreelancerRole(role) ? <FreelancerRecord userId={userId} /> : <ClientRecord userId={userId} />}
      <Text variant="body-default-xs" onBackground="neutral-weak">
        Solo tú puedes ver estos datos.
      </Text>
    </Column>
  );
}

async function FreelancerRecord({ userId }: { userId: string }) {
  const record = await getFreelancerContestRecord(userId);
  return (
    <Row gap="32" wrap>
      <Stat label="Participaciones" value={String(record.participated)} tooltip="Postulaciones enviadas, sin contar las retiradas." />
      <Stat label="Clasificaciones a Terna" value={String(record.shortlisted)} tooltip="Postulaciones que llegaron a la Terna de finalistas." />
      <Stat label="Finalista" value={String(record.finalist)} tooltip="Terna en la que no ganaste, pero quedaste destacado como runner-up." />
      <Stat label="Triunfos" value={String(record.won)} tooltip="Convocatorias que ganaste." />
    </Row>
  );
}

async function ClientRecord({ userId }: { userId: string }) {
  const record = await getClientContestRecord(userId);
  return (
    <Row gap="32" wrap>
      <Stat label="Creadas" value={String(record.created)} tooltip="Convocatorias publicadas (fuera de borrador y sin cancelar)." />
      <Stat label="Falladas a tiempo" value={String(record.awarded)} tooltip="Convocatorias con fallo emitido." />
      <Stat label="Máx. simultáneas" value={String(record.maxConcurrent)} tooltip="El mayor número de convocatorias que tuviste abiertas al mismo tiempo." />
      <Stat
        label="Inversión total"
        value={formatContestMoney(record.totalInvested)}
        tooltip="Suma de premios pagados más fees de Terna comprometidos en tus convocatorias falladas."
      />
      <Stat
        label="Cumplimiento"
        value={record.complianceRate == null ? "—" : `${Math.round(record.complianceRate * 100)}%`}
        tooltip="Proporción de tus convocatorias falladas a tiempo, sobre falladas + incumplidas."
      />
    </Row>
  );
}

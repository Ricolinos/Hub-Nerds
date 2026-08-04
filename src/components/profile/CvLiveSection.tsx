"use client";

import { useState } from "react";
import {
  Button,
  Column,
  Flex,
  Icon,
  IconButton,
  Row,
  Tag,
  Text,
  Timeline,
  type TimelineItem,
} from "@once-ui-system/core";
import { DEFAULT_CV_DATA, type CvData, type CvExperience } from "@/lib/cvData";
import { isPro } from "@/lib/plan";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";

const CV_LIVE_UPSELL_BENEFITS = [
  "CV Live editable con tu experiencia real",
  "Página de CV compartible y descargable en PDF",
  "Prioridad en búsquedas y el feed",
];

// ── CV Live — ventaja Freelancer Pro (ver src/lib/proPlans.ts) ─────────────
// Tarjeta compacta del perfil: recibe `cvData` (User.cvData ya resuelto vía
// getCvData(), ver src/lib/cvData.ts) desde ProfileView → [username]/page.tsx.
// `cvData` es opcional y cae al mock histórico (DEFAULT_CV_DATA) para no
// romper a otros llamadores que aún no lo pasen. El gate de "es Pro" vive en
// ProfileView.tsx (CV_LIVE_PREVIEW) — este componente siempre renderiza si
// se lo invoca.
//
// Cada experiencia va toda en `item.children` de Timeline (no en
// `item.label`/`item.description`): esos dos slots nativos envuelven su
// contenido en <Text> (span), y anidar ahí un Row con onClick generaría un
// <div> dentro de <span> (nesting inválido). `children` en cambio se
// inserta tal cual, sin wrapper, así que el header clicable + descripción
// expandible viven ahí completos.

function formatRange(exp: CvExperience): string {
  return `${exp.startLabel} – ${exp.endLabel ?? "Presente"}`;
}

function ExperienceEntry({
  exp,
  expanded,
  onToggle,
}: {
  exp: CvExperience;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Column gap="4" fillWidth minWidth={0}>
      <Row
        fillWidth
        gap="8"
        vertical="center"
        horizontal="between"
        style={{ cursor: "pointer", minWidth: 0 }}
        onClick={onToggle}
      >
        <Text
          variant="label-default-m"
          style={{ minWidth: 0, overflowWrap: "break-word" }}
        >
          {exp.role}
        </Text>
        <Icon
          name={expanded ? "chevronUp" : "chevronDown"}
          size="xs"
          onBackground="neutral-weak"
        />
      </Row>
      <Row fillWidth gap="4" wrap vertical="center">
        <Text
          variant="label-default-s"
          onBackground="neutral-weak"
          style={{ overflowWrap: "break-word" }}
        >
          {exp.company}
        </Text>
        <Text variant="label-default-s" onBackground="neutral-weak">
          ·
        </Text>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {formatRange(exp)}
        </Text>
      </Row>
      {expanded && (
        <Text
          variant="body-default-s"
          onBackground="neutral-weak"
          style={{ overflowWrap: "anywhere" }}
        >
          {exp.description}
        </Text>
      )}
    </Column>
  );
}

interface CvLiveSectionProps {
  // Usado para enlazar a la página "CV Live" completa (/<username>/cv, ver
  // src/components/profile/CvLivePage.tsx). Opcional: si no llega, se omite
  // el botón (defensivo, no debería pasar en uso real desde ProfileView).
  username?: string;
  // CV real del dueño del perfil (ver src/lib/cvData.ts). Opcional para no
  // romper llamadores que todavía no lo resuelven: cae al mock histórico.
  cvData?: CvData;
  // Gate de "es Pro" del DUEÑO del perfil (no del viewer): plan/planStatus
  // viajan desde profileUser (ver src/app/[username]/page.tsx → ProfileView).
  // Con isOwnProfile && !isPro(owner) se muestra el CTA de upsell; el resto
  // de la tarjeta (Timeline, skills, formación) siempre es visible para todos.
  isOwnProfile?: boolean;
  ownerPlan?: string | null;
  ownerPlanStatus?: string | null;
}

export function CvLiveSection({
  username,
  cvData = DEFAULT_CV_DATA,
  isOwnProfile = false,
  ownerPlan,
  ownerPlanStatus,
}: CvLiveSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const ownerIsPro = isPro({ plan: ownerPlan, planStatus: ownerPlanStatus });
  const showUpsellCta = isOwnProfile && !ownerIsPro;

  const items: TimelineItem[] = cvData.experiences.map((exp, index) => ({
    state: index === 0 ? "active" : "default",
    children: (
      <ExperienceEntry
        exp={exp}
        expanded={expandedId === exp.id}
        onToggle={() => setExpandedId((current) => (current === exp.id ? null : exp.id))}
      />
    ),
  }));

  return (
    <Column
      background="neutral-alpha-weak"
      border="brand-alpha-medium"
      padding="16"
      radius="m"
      gap="16"
      fillWidth
      minWidth={0}
    >
      <Row fillWidth horizontal="between" vertical="center">
        <Row gap="8" vertical="center">
          <Text variant="label-strong-s">CV Live</Text>
          <Tag variant="gradient" size="s" prefixIcon="shield">
            Pro
          </Tag>
        </Row>
        {username && (
          <IconButton
            icon="arrowUpRightFromSquare"
            size="s"
            variant="tertiary"
            href={`/${username}/cv`}
            tooltip="Ver CV completo"
            tooltipPosition="left"
          />
        )}
      </Row>

      <Column fillWidth gap="8" minWidth={0}>
        <Row gap="8" vertical="center">
          <Icon name="briefcase" size="s" onBackground="neutral-weak" />
          <Text variant="label-default-s" onBackground="neutral-weak">
            Experiencia
          </Text>
        </Row>
        <Timeline size="xs" fillWidth items={items} />
      </Column>

      <Column fillWidth gap="8">
        <Row gap="8" vertical="center">
          <Icon name="sparkles" size="s" onBackground="neutral-weak" />
          <Text variant="label-default-s" onBackground="neutral-weak">
            Skills
          </Text>
        </Row>
        <Row fillWidth gap="8" wrap>
          {cvData.skills.map((skill) => (
            <Row
              key={skill.name}
              gap="4"
              vertical="center"
              background="neutral-weak"
              border="neutral-alpha-medium"
              radius="s"
              paddingX="8"
              paddingY="4"
            >
              <Text variant="label-default-s">{skill.name}</Text>
              <Row gap="2" vertical="center">
                {[1, 2, 3, 4, 5].map((dot) => (
                  <Flex
                    key={dot}
                    width="4"
                    height="4"
                    radius="full"
                    background={dot <= skill.level ? "brand-strong" : "neutral-alpha-medium"}
                  />
                ))}
              </Row>
            </Row>
          ))}
        </Row>
      </Column>

      <Column fillWidth gap="8">
        <Row gap="8" vertical="center">
          <Icon name="book" size="s" onBackground="neutral-weak" />
          <Text variant="label-default-s" onBackground="neutral-weak">
            Formación
          </Text>
        </Row>
        <Column gap="4" fillWidth>
          {cvData.education.map((entry) => (
            <Row
              key={entry.id}
              fillWidth
              gap="8"
              horizontal="between"
              vertical="start"
              style={{ minWidth: 0 }}
            >
              <Text
                variant="label-default-s"
                style={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {entry.title} · {entry.institution}
              </Text>
              <Text
                variant="label-default-s"
                onBackground="neutral-weak"
                style={{ whiteSpace: "nowrap" }}
              >
                {entry.year}
              </Text>
            </Row>
          ))}
        </Column>
      </Column>

      {showUpsellCta && (
        <Button
          variant="secondary"
          size="s"
          prefixIcon="edit"
          fillWidth
          onClick={() => setUpsellOpen(true)}
        >
          Edita tu experiencia laboral
        </Button>
      )}

      <ProUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        title="Completa tu CV Live"
        message="Completa tu CV, compártelo y ten más difusión con una suscripción Pro"
        benefits={CV_LIVE_UPSELL_BENEFITS}
      />
    </Column>
  );
}

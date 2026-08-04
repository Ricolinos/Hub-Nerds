"use client";

import {
  Button,
  Card,
  Column,
  DateInput,
  Feedback,
  Heading,
  Icon,
  IconButton,
  Input,
  Row,
  Tag,
  Text,
  Textarea,
} from "@once-ui-system/core";
import { useState, useTransition } from "react";
import { saveContestStages } from "@/app/actions/contests";
import type { ContestStageSummary } from "@/lib/contests";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";

/* ══ Editor de etapas del timeline (Fase 4, solo Client Pro) ══════════════
   Mismo patrón de "candado" que las modalidades de premio en especie de
   ContestWizardForm: un usuario free ve la sección con un Card clicable que
   abre ProUpsellModal en vez del editor real. La lista vive en estado local
   (replace-all al guardar, igual que saveContestStages en el server) y usa
   `key` propia (id real de BD o un id temporal) para reordenar/eliminar sin
   depender del índice. `ensureContestId` reusa el `saveDraft` transparente
   del wizard (mismo patrón que la carta de responsabilidad): si el borrador
   todavía no existe, se guarda antes de persistir las etapas. ═══════════════ */

const CONTEST_STAGES_UPSELL_BENEFITS = [
  "Estructura tu convocatoria en etapas con fechas propias",
  "Comunica un cronograma claro a los postulantes",
  "Publicaciones destacadas en el listado",
];

const MAX_STAGES = 6;
const STAGE_TITLE_MAX_LENGTH = 120;
const STAGE_DESCRIPTION_MAX_LENGTH = 500;

let tempKeySeq = 0;
function nextTempKey(): string {
  tempKeySeq += 1;
  return `new-stage-${tempKeySeq}`;
}

interface StageDraft {
  key: string;
  title: string;
  description: string;
  dueDate: Date | null;
}

function fromSummary(stage: ContestStageSummary): StageDraft {
  return {
    key: stage.id,
    title: stage.title,
    description: stage.description ?? "",
    dueDate: stage.dueDate ? new Date(stage.dueDate) : null,
  };
}

export interface ContestStagesEditorProps {
  // Gate de "es Pro" del client dueño del borrador (misma prop `isPro` que
  // recibe ContestWizardForm de sus server pages).
  isPro: boolean;
  initialStages: ContestStageSummary[];
  // Devuelve el contestId vigente, guardando el borrador primero si hace
  // falta. Ver ContestWizardForm.saveDraft (mismo patrón que
  // handleOpenResponsibilityDialog para la carta de responsabilidad).
  ensureContestId: () => Promise<string | null>;
}

export function ContestStagesEditor({ isPro, initialStages, ensureContestId }: ContestStagesEditorProps) {
  const [stages, setStages] = useState<StageDraft[]>(() => initialStages.map(fromSummary));
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, startSaving] = useTransition();

  if (!isPro) {
    return (
      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Etapas de la convocatoria</Heading>
        <Card
          fillWidth
          padding="16"
          radius="m"
          border="neutral-alpha-weak"
          background="neutral-alpha-weak"
          onClick={() => setUpsellOpen(true)}
        >
          <Row fillWidth gap="12" vertical="center" horizontal="between" wrap>
            <Row gap="12" vertical="center">
              <Icon name="shield" size="s" onBackground="neutral-weak" />
              <Text variant="body-default-s" onBackground="neutral-strong">
                Estructura tu convocatoria en etapas con Client Pro
              </Text>
            </Row>
            <Tag size="s" variant="neutral" prefixIcon="shield" label="Client Pro" />
          </Row>
        </Card>

        <ProUpsellModal
          isOpen={upsellOpen}
          onClose={() => setUpsellOpen(false)}
          title="Estructura tu convocatoria"
          message="Organiza tu convocatoria en etapas con fechas propias y compártelas con los postulantes."
          benefits={CONTEST_STAGES_UPSELL_BENEFITS}
        />
      </Column>
    );
  }

  const updateStage = (key: string, patch: Partial<StageDraft>) => {
    setStages((current) => current.map((stage) => (stage.key === key ? { ...stage, ...patch } : stage)));
  };

  const addStage = () => {
    if (stages.length >= MAX_STAGES) return;
    setStages((current) => [...current, { key: nextTempKey(), title: "", description: "", dueDate: null }]);
  };

  const removeStage = (key: string) => {
    setStages((current) => current.filter((stage) => stage.key !== key));
  };

  const moveStage = (key: string, direction: -1 | 1) => {
    setStages((current) => {
      const index = current.findIndex((stage) => stage.key === key);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    setSuccess(false);
    startSaving(async () => {
      const contestId = await ensureContestId();
      if (!contestId) {
        setError("Guarda el borrador antes de configurar las etapas.");
        return;
      }
      const result = await saveContestStages(
        contestId,
        stages.map((stage) => ({
          title: stage.title,
          description: stage.description.trim() || null,
          dueDate: stage.dueDate ? stage.dueDate.toISOString() : null,
        })),
      );
      if (!result.ok) {
        if (result.error === "PRO_REQUIRED") {
          setUpsellOpen(true);
          return;
        }
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  };

  return (
    <Column gap="16" fillWidth>
      <Row fillWidth horizontal="between" vertical="center" wrap gap="8">
        <Heading variant="heading-strong-s">Etapas de la convocatoria</Heading>
        <Tag variant="gradient" size="s" prefixIcon="shield" label="Pro" />
      </Row>
      <Text variant="body-default-s" onBackground="neutral-weak">
        Las etapas son informativas para los participantes; no sustituyen las fechas límite oficiales.
      </Text>

      {stages.length > 0 && (
        <Column gap="12" fillWidth>
          {stages.map((stage, index) => (
            <Column
              key={stage.key}
              fillWidth
              gap="12"
              padding="16"
              radius="m"
              border="neutral-alpha-weak"
              background="neutral-alpha-weak"
            >
              <Row fillWidth gap="8" vertical="center" horizontal="between">
                <Text variant="label-default-s" onBackground="neutral-weak">
                  Etapa {index + 1}
                </Text>
                <Row gap="4">
                  <IconButton
                    icon="chevronUp"
                    size="s"
                    variant="tertiary"
                    tooltip="Subir"
                    onClick={() => moveStage(stage.key, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    icon="chevronDown"
                    size="s"
                    variant="tertiary"
                    tooltip="Bajar"
                    onClick={() => moveStage(stage.key, 1)}
                    disabled={index === stages.length - 1}
                  />
                  <IconButton
                    icon="trash"
                    size="s"
                    variant="tertiary"
                    tooltip="Eliminar etapa"
                    onClick={() => removeStage(stage.key)}
                  />
                </Row>
              </Row>
              <Input
                id={`stage-title-${stage.key}`}
                label="Título"
                value={stage.title}
                onChange={(e) => updateStage(stage.key, { title: e.target.value.slice(0, STAGE_TITLE_MAX_LENGTH) })}
              />
              <Textarea
                id={`stage-description-${stage.key}`}
                label="Descripción (opcional)"
                value={stage.description}
                onChange={(e) => updateStage(stage.key, { description: e.target.value })}
                lines={2}
                maxLength={STAGE_DESCRIPTION_MAX_LENGTH}
                characterCount
              />
              <Row fillWidth gap="8" vertical="end" wrap>
                <Column style={{ flex: 1, minWidth: 180 }}>
                  <DateInput
                    id={`stage-due-date-${stage.key}`}
                    label="Fecha objetivo (opcional)"
                    value={stage.dueDate ?? undefined}
                    onChange={(date) => updateStage(stage.key, { dueDate: date })}
                  />
                </Column>
                {stage.dueDate && (
                  <Button variant="tertiary" size="s" onClick={() => updateStage(stage.key, { dueDate: null })}>
                    Quitar fecha
                  </Button>
                )}
              </Row>
            </Column>
          ))}
        </Column>
      )}

      <Row fillWidth gap="12" horizontal="between" wrap vertical="center">
        <Button
          variant="secondary"
          size="s"
          prefixIcon="plus"
          onClick={addStage}
          disabled={stages.length >= MAX_STAGES}
        >
          Añadir etapa
        </Button>
        <Button variant="primary" size="s" onClick={handleSave} loading={saving}>
          Guardar etapas
        </Button>
      </Row>

      {error && <Feedback variant="danger" description={error} />}
      {success && <Feedback variant="success" description="Etapas guardadas." />}

      <ProUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        title="Guarda tus etapas"
        message="Configurar el cronograma de tu convocatoria es una ventaja de Client Pro."
        benefits={CONTEST_STAGES_UPSELL_BENEFITS}
      />
    </Column>
  );
}

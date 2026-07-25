"use client";

import {
  Avatar,
  Button,
  Chip,
  Column,
  type DateRange,
  DateRangeInput,
  Icon,
  IconButton,
  Input,
  NumberInput,
  Row,
  Select,
  Tag,
  Text,
} from "@once-ui-system/core";
import { LinearGauge } from "@once-ui-system/core/modules";
import { useState } from "react";
import {
  addTaskDependency,
  removeTaskDependency,
  type UpdateTaskDetailsInput,
  updateTaskDetails,
} from "@/app/actions/collab";
import type { TaskPriority } from "@/generated/prisma/client";
import type { CollabTask } from "@/lib/collab";
import { TASK_STATUS_LABELS, TASK_STATUS_VARIANTS } from "@/lib/projectStatus";

/* ══ Fila de tarea con atributos ricos (Fase 6b): avance (LinearGauge),  ══
   ══ prioridad, categoría, rango de fechas y dependencias cruzadas.      ══
   ══ Solo el freelancer edita (canEdit), igual que AssetTaskRow: toggle     ══
   ══ "Editar detalles" + guardado explícito por campo. ═══════════════════ */

const MAX_CATEGORY_CHARS = 40;

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const PRIORITY_VARIANTS: Record<TaskPriority, "neutral" | "brand" | "warning" | "danger"> = {
  LOW: "neutral",
  MEDIUM: "brand",
  HIGH: "warning",
  URGENT: "danger",
};

const PRIORITY_OPTIONS = (Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => ({
  value,
  label: PRIORITY_LABELS[value],
}));

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString() : null;
}

interface ProjectTaskRowProps {
  task: CollabTask;
  allTasks: CollabTask[];
  canEdit: boolean;
  onChanged: () => void;
}

export function ProjectTaskRow({ task, allTasks, canEdit, onChanged }: ProjectTaskRowProps) {
  const [editingDetails, setEditingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [progressDraft, setProgressDraft] = useState(task.progress);
  const [categoryDraft, setCategoryDraft] = useState(task.category ?? "");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: task.startDate ? new Date(task.startDate) : undefined,
    endDate: task.dueDate ? new Date(task.dueDate) : undefined,
  });
  const [dependsOnDraft, setDependsOnDraft] = useState("");
  const [busyDependencyId, setBusyDependencyId] = useState<string | null>(null);

  const gaugeHue: "success" | "neutral" = task.progress >= 100 ? "success" : "neutral";

  const candidateTasks = allTasks.filter(
    (candidate) =>
      candidate.id !== task.id &&
      !task.dependencies.some((dependency) => dependency.dependsOnId === candidate.id),
  );
  const dependencyOptions = candidateTasks.map((candidate) => ({
    value: candidate.id,
    label: candidate.title,
  }));

  const commit = async (data: UpdateTaskDetailsInput) => {
    setSaving(true);
    setError(null);
    const result = await updateTaskDetails(task.id, data);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleSaveProgress = () => {
    if (progressDraft === task.progress) return;
    void commit({ progress: progressDraft });
  };

  const handleSelectPriority = (value: string) => {
    void commit({ priority: value as TaskPriority });
  };

  const handleSaveCategory = () => {
    const trimmed = categoryDraft.trim();
    if (trimmed === (task.category ?? "")) return;
    void commit({ category: trimmed || null });
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    void commit({
      startDate: range.startDate ? range.startDate.toISOString() : null,
      dueDate: range.endDate ? range.endDate.toISOString() : null,
    });
  };

  const handleAddDependency = async () => {
    if (!dependsOnDraft) return;
    setSaving(true);
    setError(null);
    const result = await addTaskDependency(task.id, dependsOnDraft);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDependsOnDraft("");
    onChanged();
  };

  const handleRemoveDependency = async (dependsOnId: string) => {
    setBusyDependencyId(dependsOnId);
    setError(null);
    const result = await removeTaskDependency(task.id, dependsOnId);
    setBusyDependencyId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  return (
    <Column fillWidth gap="8" paddingX="16" paddingY="12">
      <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
        <Text
          variant="label-default-m"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {task.title}
        </Text>
        <Row gap="8" vertical="center">
          <Tag
            size="s"
            variant={PRIORITY_VARIANTS[task.priority]}
            label={PRIORITY_LABELS[task.priority]}
          />
          <Tag
            size="s"
            variant={TASK_STATUS_VARIANTS[task.status] ?? "neutral"}
            label={TASK_STATUS_LABELS[task.status] ?? task.status}
          />
          {canEdit && (
            <IconButton
              icon={editingDetails ? "chevronUp" : "edit"}
              size="s"
              variant="tertiary"
              tooltip={editingDetails ? "Ocultar edición" : "Editar detalles"}
              tooltipPosition="top"
              onClick={() => setEditingDetails((current) => !current)}
            />
          )}
        </Row>
      </Row>

      <Row gap="16" vertical="center" wrap>
        <Row gap="8" vertical="center" style={{ minWidth: 160, flex: 1 }}>
          <Column flex={1} height="32">
            <LinearGauge value={task.progress} hue={gaugeHue} line={{ count: 24, length: 20 }} />
          </Column>
          <Text variant="label-default-s" onBackground="neutral-weak">
            {task.progress}%
          </Text>
        </Row>

        {task.assignee && (
          <Row gap="8" vertical="center">
            <Avatar
              size="xs"
              {...(task.assignee.imageUrl
                ? { src: task.assignee.imageUrl }
                : {
                    value: (
                      task.assignee.name?.[0] ??
                      task.assignee.username?.[0] ??
                      "U"
                    ).toUpperCase(),
                  })}
            />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {task.assignee.name ?? task.assignee.username ?? "Sin asignar"}
            </Text>
          </Row>
        )}

        {(task.startDate || task.dueDate) && (
          <Row gap="4" vertical="center">
            <Icon name="calendar" size="xs" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {task.startDate ? formatDate(task.startDate) : "Sin inicio"}
              {" → "}
              {task.dueDate ? formatDate(task.dueDate) : "Sin límite"}
            </Text>
          </Row>
        )}

        {task.asset && (
          <Row gap="4" vertical="center">
            <Icon name="shapes" size="xs" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {task.asset.title}
            </Text>
          </Row>
        )}

        {task.category && <Chip label={task.category} prefixIcon="folder" />}
      </Row>

      {task.dependencies.length > 0 && (
        <Row gap="8" vertical="center" wrap>
          <Text variant="label-default-s" onBackground="neutral-weak">
            Depende de:
          </Text>
          {task.dependencies.map((dependency) => (
            <Chip
              key={dependency.id}
              label={dependency.dependsOnTitle}
              {...(canEdit
                ? {
                    onRemove: () => handleRemoveDependency(dependency.dependsOnId),
                    iconButtonProps: { loading: busyDependencyId === dependency.dependsOnId },
                  }
                : {})}
            />
          ))}
        </Row>
      )}

      {error && (
        <Text variant="label-default-s" onBackground="danger-weak">
          {error}
        </Text>
      )}

      {canEdit && editingDetails && (
        <Column
          gap="12"
          fillWidth
          padding="12"
          background="neutral-alpha-weak"
          radius="m"
          style={{ minWidth: 0 }}
        >
          <Row fillWidth gap="8" wrap>
            <Column style={{ flex: 1, minWidth: 140 }}>
              <NumberInput
                id={`task-progress-${task.id}`}
                label="Avance (%)"
                value={progressDraft}
                onChange={setProgressDraft}
                onBlur={handleSaveProgress}
                min={0}
                max={100}
                step={5}
              />
            </Column>
            <Column style={{ flex: 1, minWidth: 140 }}>
              <Select
                id={`task-priority-${task.id}`}
                label="Prioridad"
                value={task.priority}
                onSelect={handleSelectPriority}
                options={PRIORITY_OPTIONS}
              />
            </Column>
          </Row>

          <Row fillWidth gap="8" wrap>
            <Column style={{ flex: 1, minWidth: 140 }}>
              <Input
                id={`task-category-${task.id}`}
                label="Categoría"
                value={categoryDraft}
                maxLength={MAX_CATEGORY_CHARS}
                onChange={(e) => setCategoryDraft(e.target.value)}
                onBlur={handleSaveCategory}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCategory();
                }}
              />
            </Column>
          </Row>

          <DateRangeInput
            id={`task-dates-${task.id}`}
            startLabel="Inicio"
            endLabel="Entrega"
            value={dateRange}
            onChange={handleDateRangeChange}
          />

          <Column gap="8" fillWidth>
            <Text variant="label-default-s" onBackground="neutral-weak">
              Dependencias
            </Text>
            <Row fillWidth gap="8" wrap>
              <Column style={{ flex: 1, minWidth: 160 }}>
                <Select
                  id={`task-dependency-${task.id}`}
                  placeholder="Seleccionar tarea"
                  value={dependsOnDraft}
                  onSelect={(value) => setDependsOnDraft(value as string)}
                  options={dependencyOptions}
                  emptyState="Sin otras tareas disponibles"
                />
              </Column>
              <Button
                variant="secondary"
                size="s"
                prefixIcon="plus"
                loading={saving}
                disabled={!dependsOnDraft || saving}
                onClick={handleAddDependency}
              >
                Agregar
              </Button>
            </Row>
          </Column>
        </Column>
      )}
    </Column>
  );
}

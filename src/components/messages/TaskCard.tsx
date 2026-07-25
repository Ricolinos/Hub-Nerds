"use client";

import {
  Avatar,
  Button,
  Chip,
  Column,
  DateInput,
  Icon,
  Modal,
  Row,
  Select,
  Tag,
  Text,
  Textarea,
  useToast,
} from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createTaskFromMessage, resolveTaskApproval } from "@/app/actions/channels";
import { getAssigneeSuggestions } from "@/app/actions/collab";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import type { AssigneeSuggestion } from "@/lib/collab";
import {
  personInitial,
  personLabel,
  TASK_STATUS_LABELS,
  TASK_STATUS_VARIANTS,
} from "./messengerUtils";

/* ══ Tarjeta de tarea + modal de creación (adaptado de ProjectChat.tsx) ══
   Reutilizado tanto en la burbuja del stream (mensaje con tarea vinculada)
   como en el accordion "Gestión de tareas" del panel derecho. ═══════════ */

const modalBackdrop = <BrandModalBackdrop />;

export interface TaskParticipant {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
}

export interface TaskCardData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assignee: TaskParticipant | null;
  asset: { id: string; title: string } | null;
}

export function TaskCard({
  task,
  viewerId,
  onResolved,
  variant = "bubble",
}: {
  task: TaskCardData;
  viewerId: string;
  onResolved: () => void;
  variant?: "bubble" | "row";
}) {
  const router = useRouter();
  const { addToast } = useToast();
  const [resolving, setResolving] = useState(false);

  const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status;
  const statusVariant = TASK_STATUS_VARIANTS[task.status] ?? "neutral";
  const canResolve = task.status === "pending_approval" && task.assignee?.id === viewerId;

  const handleResolve = async (approve: boolean) => {
    setResolving(true);
    const result = await resolveTaskApproval(task.id, approve);
    setResolving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: approve ? "Tarea aprobada." : "Tarea rechazada." });
    onResolved();
    router.refresh();
  };

  return (
    <Column
      gap="8"
      padding="12"
      radius="m"
      border="neutral-alpha-medium"
      background="surface"
      fillWidth={variant === "row"}
      style={variant === "bubble" ? { maxWidth: "70%", minWidth: 0 } : { minWidth: 0 }}
    >
      <Row fillWidth gap="8" horizontal="between" vertical="center" wrap>
        <Text
          variant="label-strong-s"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {task.title}
        </Text>
        <Tag size="s" variant={statusVariant} label={statusLabel} />
      </Row>

      {task.assignee && (
        <Row gap="8" vertical="center">
          <Avatar
            size="xs"
            {...(task.assignee.imageUrl
              ? { src: task.assignee.imageUrl }
              : { value: personInitial(task.assignee) })}
          />
          <Text variant="label-default-s" onBackground="neutral-weak">
            {personLabel(task.assignee)}
          </Text>
        </Row>
      )}

      <Row gap="16" wrap>
        {task.dueDate && (
          <Row gap="4" vertical="center">
            <Icon name="calendar" size="xs" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {new Date(task.dueDate).toLocaleDateString()}
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
      </Row>

      {canResolve && (
        <Row fillWidth gap="8" horizontal="end">
          <Button
            variant="danger"
            size="s"
            prefixIcon="xCircle"
            onClick={() => handleResolve(false)}
            loading={resolving}
            disabled={resolving}
          >
            Rechazar
          </Button>
          <Button
            variant="primary"
            size="s"
            prefixIcon="check"
            onClick={() => handleResolve(true)}
            loading={resolving}
            disabled={resolving}
          >
            Aprobar
          </Button>
        </Row>
      )}
    </Column>
  );
}

export function CreateTaskModal({
  isOpen,
  onClose,
  messageId,
  messageBody,
  freelancerParticipants,
  assets,
  onCreated,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  messageId: string | null;
  messageBody: string;
  freelancerParticipants: TaskParticipant[];
  assets: { id: string; title: string }[];
  onCreated: () => void;
  // Proyecto del canal, para pedir sugerencias de responsable (Fase 6b).
  // Opcional: si no llega, simplemente no se muestran sugerencias.
  projectId?: string | null;
}) {
  const { addToast } = useToast();
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<AssigneeSuggestion[]>([]);

  useEffect(() => {
    if (isOpen && messageId) {
      setDescription(messageBody);
      setAssigneeId("");
      setAssetId("");
      setDueDate(undefined);
    }
  }, [isOpen, messageId, messageBody]);

  useEffect(() => {
    if (!isOpen || !projectId) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    getAssigneeSuggestions(projectId).then((result) => {
      if (!cancelled && result.ok) setSuggestions(result.suggestions.slice(0, 3));
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!messageId) return;
    if (!assigneeId) {
      addToast({ variant: "danger", message: "Selecciona un responsable." });
      return;
    }
    setSaving(true);
    const result = await createTaskFromMessage(messageId, {
      description: description.trim() || undefined,
      assigneeId,
      assetId: assetId || undefined,
      dueDate: dueDate ? dueDate.toISOString() : undefined,
    });
    setSaving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Tarea creada. Queda pendiente de aprobación." });
    onCreated();
    onClose();
  };

  const assetOptions = [
    { value: "", label: "Sin activo" },
    ...assets.map((asset) => ({ value: asset.id, label: asset.title })),
  ];
  const assigneeOptions = freelancerParticipants.map((freelancer) => ({
    value: freelancer.id,
    label: personLabel(freelancer),
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Convertir mensaje en tarea"
      backdrop={modalBackdrop}
    >
      <Column gap="16" fillWidth paddingTop="12">
        <Textarea
          id="task-from-message-description"
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          lines={4}
        />
        {suggestions.length > 0 && (
          <Column gap="8">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Sugeridos
            </Text>
            <Row gap="8" wrap>
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion.userId}
                  label={suggestion.name ?? suggestion.username ?? "Sin nombre"}
                  prefixIcon="sparkles"
                  selected={assigneeId === suggestion.userId}
                  onClick={() => setAssigneeId(suggestion.userId)}
                />
              ))}
            </Row>
          </Column>
        )}
        <Select
          id="task-from-message-assignee"
          label="Responsable"
          placeholder="Selecciona un responsable"
          value={assigneeId}
          onSelect={(value) => setAssigneeId(value as string)}
          options={assigneeOptions}
        />
        <Select
          id="task-from-message-asset"
          label="Activo del proyecto"
          value={assetId}
          onSelect={(value) => setAssetId(value as string)}
          options={assetOptions}
        />
        <DateInput
          id="task-from-message-due-date"
          label="Fecha límite"
          value={dueDate}
          onChange={setDueDate}
        />
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="m"
            onClick={handleSubmit}
            loading={saving}
            disabled={!assigneeId}
          >
            Crear tarea
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

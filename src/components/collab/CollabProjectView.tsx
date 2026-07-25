"use client";

import {
  Avatar,
  AvatarGroup,
  Button,
  Checkbox,
  Column,
  DateInput,
  DropdownWrapper,
  Feedback,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Modal,
  NumberInput,
  Option,
  ProgressBar,
  Row,
  Select,
  Tag,
  Text,
  Textarea,
} from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type ChannelData, getChannels } from "@/app/actions/channels";
import {
  addProjectCollaborator,
  addProjectLink,
  deleteProjectLink,
  removeProjectCollaborator,
  requestAssetTaskApproval,
  resolveAssetTaskApproval,
  setAssetTaskAssignees,
  updateAssetTaskDetails,
  updateCollabProject,
  updateProjectLogo,
} from "@/app/actions/collab";
import type { AssetCategoryData } from "@/app/actions/projectAssets";
import {
  addCustomProjectAsset,
  addProjectAsset,
  addProjectAssetTask,
  deleteProjectAsset,
  deleteProjectAssetTask,
  renameProjectAsset,
  renameProjectAssetTask,
  toggleProjectAssetTask,
} from "@/app/actions/projectAssets";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { CollaboratorSearchModal } from "@/components/collab/CollaboratorSearchModal";
import { ProjectLogoControl } from "@/components/collab/ProjectLogoControl";
import type {
  CollabCollaboratorSummary,
  CollabLink,
  CollabProjectData,
  ProjectAssetData,
  ProjectAssetTaskData,
} from "@/lib/collab";
import { validateExternalUrl } from "@/lib/externalLink";
import { TASK_STATUS_LABELS, TASK_STATUS_VARIANTS } from "@/lib/projectStatus";
import {
  FILE_SUBTYPE_LABELS,
  FILE_SUBTYPES,
  PROJECT_SUBTYPES,
  PROJECT_TYPES,
} from "@/lib/projectTypes";

type ViewerRole = "client" | "freelancer";

interface CollabPersonSummary {
  id: string;
  username: string | null;
  name: string | null;
  imageUrl: string | null;
}

interface CollabProjectViewProps {
  project: CollabProjectData;
  client: CollabPersonSummary;
  freelancer: CollabPersonSummary;
  viewerRole: ViewerRole;
  viewerId: string;
  assetCatalog: AssetCategoryData[];
  availableFreelancers: CollabCollaboratorSummary[];
}

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
};

const PROJECT_STATUS_VARIANTS: Record<string, "neutral" | "warning" | "success"> = {
  active: "warning",
  completed: "success",
  archived: "neutral",
};

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "completed", label: "Completado" },
  { value: "archived", label: "Archivado" },
];

const QUOTE_CURRENCY_OPTIONS = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
];

const PROVIDER_LABELS: Record<string, string> = {
  drive: "Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  wetransfer: "WeTransfer",
  other: "Link",
};

const PROJECT_TYPE_OPTIONS = PROJECT_TYPES.map((type) => ({ value: type, label: type }));

const FILE_SUBTYPE_OPTIONS = FILE_SUBTYPES.map((subtype) => ({
  value: subtype,
  label: FILE_SUBTYPE_LABELS[subtype],
}));

// Miembro del proyecto (client, freelancer fundador o freelancer adicional):
// unificado para el multi-select de "Responsables" de una tarea de activo.
interface ProjectMemberSummary {
  id: string;
  name: string | null;
  imageUrl: string | null;
}

const modalBackdrop = <BrandModalBackdrop />;

function PersonBadge({ label, person }: { label: string; person: CollabPersonSummary }) {
  const initials = (person.name?.[0] ?? person.username?.[0] ?? "U").toUpperCase();

  return (
    <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
      <Avatar size="s" {...(person.imageUrl ? { src: person.imageUrl } : { value: initials })} />
      <Column gap="2" style={{ minWidth: 0 }}>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {label}
        </Text>
        <Text
          variant="label-default-s"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {person.name ?? person.username ?? "Sin nombre"}
        </Text>
      </Column>
      {person.username && (
        <IconButton
          icon="person"
          size="s"
          variant="tertiary"
          href={`/${person.username}`}
          tooltip="Ver perfil"
          tooltipPosition="top"
        />
      )}
    </Row>
  );
}

// Badge de colaborador para la fila "Freelancers": freelancer fundador (sin
// botón de quitar) o ProjectCollaborator adicional (con botón de quitar si
// el viewer está autorizado).
function CollaboratorBadge({
  person,
  headline,
  canRemove,
  busy,
  onRemove,
}: {
  person: CollabPersonSummary;
  headline?: string | null;
  canRemove: boolean;
  busy: boolean;
  onRemove?: () => void;
}) {
  const initials = (person.name?.[0] ?? person.username?.[0] ?? "U").toUpperCase();

  return (
    <Row
      gap="8"
      vertical="center"
      paddingX="12"
      paddingY="8"
      background="neutral-alpha-weak"
      radius="full"
      wrap
      style={{ minWidth: 0 }}
    >
      <Avatar size="xs" {...(person.imageUrl ? { src: person.imageUrl } : { value: initials })} />
      {/* wrap en el Row (arriba): con nombre + headline + 2 IconButton en una
          sola línea, en móvil el nombre se comía todo el shrink (minWidth 0 +
          overflowWrap anywhere) y terminaba partido letra por letra. Con wrap
          el headline/IconButtons bajan a una segunda línea de la píldora en
          vez de aplastar el nombre. */}
      <Text
        variant="label-default-s"
        onBackground="neutral-strong"
        style={{ minWidth: 0, overflowWrap: "anywhere" }}
      >
        {person.name ?? person.username ?? "Sin nombre"}
      </Text>
      {headline && <Tag size="s" variant="neutral" label={headline} />}
      {person.username && (
        <IconButton
          icon="person"
          size="s"
          variant="tertiary"
          href={`/${person.username}`}
          tooltip="Ver perfil"
          tooltipPosition="top"
        />
      )}
      {canRemove && onRemove && (
        <IconButton
          icon="close"
          size="s"
          variant="tertiary"
          tooltip="Quitar del proyecto"
          tooltipPosition="top"
          loading={busy}
          disabled={busy}
          onClick={onRemove}
        />
      )}
    </Row>
  );
}

// Buscador de colaborador (CollaboratorSearchModal, compartido con el panel
// de client) para elegir entre los freelancers aceptados por el client que
// aún no están en este proyecto.
function AddCollaboratorSearch({
  projectId,
  availableFreelancers,
  onError,
}: {
  projectId: string;
  availableFreelancers: CollabCollaboratorSummary[];
  onError: (message: string | null) => void;
}) {
  const router = useRouter();

  const handleSelect = async (freelancerId: string) => {
    onError(null);
    const result = await addProjectCollaborator(projectId, freelancerId);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <CollaboratorSearchModal
      people={availableFreelancers}
      onSelect={handleSelect}
      trigger={
        <Button variant="tertiary" size="s" prefixIcon="plus">
          Agregar colaborador
        </Button>
      }
      emptyHint="El client no tiene otros colaboradores aceptados."
    />
  );
}

function LinkRow({
  link,
  canDelete,
  busy,
  onDelete,
  assetTaskTitle,
}: {
  link: CollabLink;
  canDelete: boolean;
  busy: boolean;
  onDelete: () => void;
  // Título de la tarea de activo a la que quedó ligado este adjunto, si aplica.
  assetTaskTitle?: string | null;
}) {
  return (
    <Row fillWidth paddingX="20" paddingY="12" horizontal="between" vertical="center" gap="16" wrap>
      <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
        <Icon name="attach" size="s" onBackground="neutral-weak" />
        <Column gap="2" style={{ minWidth: 0 }}>
          <Text
            variant="label-default-m"
            onBackground="neutral-strong"
            style={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {link.label}
          </Text>
          {assetTaskTitle && (
            <Text variant="label-default-s" onBackground="neutral-weak">
              Tarea: {assetTaskTitle}
            </Text>
          )}
        </Column>
      </Row>

      <Row gap="8" vertical="center">
        {link.subtype && (
          <Tag
            size="s"
            variant="brand"
            label={
              FILE_SUBTYPE_LABELS[link.subtype as keyof typeof FILE_SUBTYPE_LABELS] ?? link.subtype
            }
          />
        )}
        <Tag size="s" variant="neutral" label={PROVIDER_LABELS[link.provider] ?? "Link"} />
        <IconButton
          icon="arrowUpRightFromSquare"
          size="s"
          variant="tertiary"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          tooltip="Abrir en nueva pestaña"
          tooltipPosition="top"
        />
        {canDelete && (
          <IconButton
            icon="trash"
            size="s"
            variant="tertiary"
            tooltip="Eliminar link"
            tooltipPosition="top"
            loading={busy}
            disabled={busy}
            onClick={onDelete}
          />
        )}
      </Row>
    </Row>
  );
}

function ProjectSettingsDialog({
  isOpen,
  onClose,
  project,
  viewerRole,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: CollabProjectData;
  viewerRole: ViewerRole;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState(project.status);
  const [clientNotes, setClientNotes] = useState(project.clientNotes ?? "");
  const [quoteAmount, setQuoteAmount] = useState<number | undefined>(
    project.quoteAmount ?? undefined,
  );
  const [quoteCurrency, setQuoteCurrency] = useState(project.quoteCurrency || "MXN");
  const [quoteNotes, setQuoteNotes] = useState(project.quoteNotes ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    project.startDate ? new Date(project.startDate) : undefined,
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    project.dueDate ? new Date(project.dueDate) : undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateCollabProject(project.id, {
      title,
      description,
      status,
      ...(viewerRole === "client" ? { clientNotes } : {}),
      quoteAmount,
      quoteCurrency,
      quoteNotes,
      startDate: startDate ? startDate.toISOString() : null,
      dueDate: dueDate ? dueDate.toISOString() : null,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
    router.refresh();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configuración del proyecto"
      backdrop={modalBackdrop}
    >
      <Column gap="16" fillWidth paddingTop="12">
        <Input
          id="collab-project-title"
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          id="collab-project-description"
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          lines={3}
        />
        <Select
          id="collab-project-status"
          label="Estatus"
          value={status}
          onSelect={(value) => setStatus(value as string)}
          options={PROJECT_STATUS_OPTIONS}
        />
        <Line background="neutral-alpha-weak" />

        <Column gap="12" fillWidth>
          <Text variant="label-strong-s">Cotización y calendario</Text>
          <Row fillWidth gap="8" wrap>
            <Column style={{ flex: 2, minWidth: 160 }}>
              <NumberInput
                id="collab-project-quote-amount"
                label="Monto"
                value={quoteAmount}
                onChange={setQuoteAmount}
                min={0}
              />
            </Column>
            <Column style={{ flex: 1, minWidth: 100 }}>
              <Select
                id="collab-project-quote-currency"
                label="Moneda"
                value={quoteCurrency}
                onSelect={(value) => setQuoteCurrency(value as string)}
                options={QUOTE_CURRENCY_OPTIONS}
              />
            </Column>
          </Row>
          <Textarea
            id="collab-project-quote-notes"
            label="Notas de cotización"
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
            lines={3}
          />
          <Row fillWidth gap="8" wrap>
            <Column style={{ flex: 1, minWidth: 160 }}>
              <DateInput
                id="collab-project-start-date"
                label="Fecha de inicio"
                value={startDate}
                onChange={setStartDate}
              />
            </Column>
            <Column style={{ flex: 1, minWidth: 160 }}>
              <DateInput
                id="collab-project-due-date"
                label="Fecha de entrega"
                value={dueDate}
                onChange={setDueDate}
              />
            </Column>
          </Row>
        </Column>

        {viewerRole === "client" && (
          <Textarea
            id="collab-project-client-notes"
            label="Tus notas"
            value={clientNotes}
            onChange={(e) => setClientNotes(e.target.value)}
            lines={3}
            description="Notas privadas del proyecto, solo visibles para ti."
          />
        )}

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleSave} loading={saving}>
            Guardar cambios
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

// Tipo/subtipo de proyecto (catálogo del cotizador, src/lib/projectTypes.ts):
// se muestra como Tag cuando ya están elegidos; el editor con los dos Selects
// aparece al click del icono, solo para quien puede editar el proyecto.
function ProjectTypeEditor({ project, canEdit }: { project: CollabProjectData; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [typeDraft, setTypeDraft] = useState(project.projectType ?? "");
  const [subtypeDraft, setSubtypeDraft] = useState(project.projectSubtype ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtypeOptions =
    typeDraft && typeDraft in PROJECT_SUBTYPES
      ? PROJECT_SUBTYPES[typeDraft as keyof typeof PROJECT_SUBTYPES].map((subtype) => ({
          value: subtype,
          label: subtype,
        }))
      : [];

  const handleEdit = () => {
    setTypeDraft(project.projectType ?? "");
    setSubtypeDraft(project.projectSubtype ?? "");
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await updateCollabProject(project.id, {
      projectType: typeDraft || null,
      projectSubtype: subtypeDraft || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <Row gap="8" vertical="center" wrap>
        {project.projectType ? (
          <Tag size="s" variant="brand" label={project.projectType} />
        ) : (
          <Text variant="label-default-s" onBackground="neutral-weak">
            Sin tipo de proyecto
          </Text>
        )}
        {project.projectSubtype && (
          <Tag size="s" variant="neutral" label={project.projectSubtype} />
        )}
        {canEdit && (
          <IconButton
            icon="edit"
            size="s"
            variant="tertiary"
            tooltip="Editar tipo de proyecto"
            tooltipPosition="top"
            onClick={handleEdit}
          />
        )}
      </Row>
    );
  }

  return (
    <Column gap="8" fillWidth>
      <Row fillWidth gap="8" wrap>
        <Column style={{ flex: 1, minWidth: 180 }}>
          <Select
            id="collab-project-type"
            label="Tipo de proyecto"
            placeholder="Selecciona un tipo"
            value={typeDraft}
            onSelect={(value) => {
              setTypeDraft(value as string);
              setSubtypeDraft("");
            }}
            options={PROJECT_TYPE_OPTIONS}
          />
        </Column>
        <Column style={{ flex: 1, minWidth: 180 }}>
          <Select
            id="collab-project-subtype"
            label="Subtipo"
            placeholder="Selecciona un subtipo"
            value={subtypeDraft}
            onSelect={(value) => setSubtypeDraft(value as string)}
            options={subtypeOptions}
            disabled={!typeDraft}
          />
        </Column>
      </Row>
      {error && (
        <Text variant="label-default-s" onBackground="danger-weak">
          {error}
        </Text>
      )}
      <Row gap="8">
        <Button variant="secondary" size="s" onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" size="s" onClick={handleSave} loading={saving}>
          Guardar
        </Button>
      </Row>
    </Column>
  );
}

// Menú "..." de una tarea de activo: responsables (multi-select), fecha de
// entrega, liga de entregables, solicitar/resolver aprobación y adjuntar
// archivo — todo dentro de un único DropdownWrapper (Once UI solo intercepta
// clicks de los hijos directos del prop `dropdown` con value/data-value, así
// que envolver todo en una sola Column evita que el menú se cierre al
// interactuar con los campos).
function AssetTaskMenu({
  task,
  projectId,
  viewerRole,
  isFreelancer,
  projectMembers,
  onChanged,
}: {
  task: ProjectAssetTaskData;
  projectId: string;
  viewerRole: ViewerRole;
  isFreelancer: boolean;
  projectMembers: ProjectMemberSummary[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined,
  );
  const [deliverableUrl, setDeliverableUrl] = useState(task.deliverableUrl ?? "");
  const [attachLabel, setAttachLabel] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachSubtype, setAttachSubtype] = useState<string>("");
  const [attaching, setAttaching] = useState(false);

  const assigneeIds = new Set(task.assignees.map((assignee) => assignee.userId));

  const handleToggleAssignee = async (userId: string) => {
    setBusy(true);
    setError(null);
    const nextIds = assigneeIds.has(userId)
      ? task.assignees.map((a) => a.userId).filter((id) => id !== userId)
      : [...task.assignees.map((a) => a.userId), userId];
    const result = await setAssetTaskAssignees(task.id, nextIds);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleSaveDueDate = async (value: Date | undefined) => {
    setDueDate(value);
    setBusy(true);
    setError(null);
    const result = await updateAssetTaskDetails(task.id, {
      dueDate: value ? value.toISOString() : null,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleSaveDeliverableUrl = async () => {
    const trimmed = deliverableUrl.trim();
    if (trimmed === (task.deliverableUrl ?? "")) return;
    setBusy(true);
    setError(null);
    const result = await updateAssetTaskDetails(task.id, { deliverableUrl: trimmed || null });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleRequestApproval = async () => {
    setBusy(true);
    setError(null);
    const result = await requestAssetTaskApproval(task.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleResolveApproval = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    const result = await resolveAssetTaskApproval(task.id, approve);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChanged();
  };

  const handleAttach = async () => {
    if (!attachLabel.trim() || !attachUrl.trim()) return;
    if (!validateExternalUrl(attachUrl)) {
      setError("La URL no es válida.");
      return;
    }
    setAttaching(true);
    setError(null);
    const result = await addProjectLink(projectId, attachLabel, attachUrl, {
      ...(attachSubtype ? { subtype: attachSubtype } : {}),
      assetTaskId: task.id,
    });
    setAttaching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAttachLabel("");
    setAttachUrl("");
    setAttachSubtype("");
    onChanged();
  };

  return (
    <DropdownWrapper
      isOpen={open}
      onOpenChange={setOpen}
      placement="bottom-end"
      // El Dropdown interno delega el click en cualquier descendiente con
      // data-value (los Option de "Responsables"), sin importar su
      // profundidad: sin closeAfterClick=false, marcar un responsable
      // cerraría todo el menú en vez de permitir seguir editando.
      closeAfterClick={false}
      trigger={
        <IconButton
          icon="moreVertical"
          size="s"
          variant="tertiary"
          tooltip="Opciones de la tarea"
          tooltipPosition="top"
        />
      }
      dropdown={
        <Column
          minWidth={18}
          maxWidth={22}
          padding="16"
          gap="16"
          style={{ maxHeight: 420, overflowY: "auto" }}
        >
          <Column gap="8" fillWidth>
            <Text variant="label-strong-s">Responsables</Text>
            <Column gap="2" fillWidth>
              {projectMembers.map((member) => (
                <Option
                  key={member.id}
                  value={member.id}
                  label={member.name ?? "Sin nombre"}
                  selected={assigneeIds.has(member.id)}
                  disabled={!isFreelancer || busy}
                  hasPrefix={
                    <Avatar
                      size="xs"
                      {...(member.imageUrl
                        ? { src: member.imageUrl }
                        : { value: (member.name?.[0] ?? "U").toUpperCase() })}
                    />
                  }
                  onClick={() => isFreelancer && handleToggleAssignee(member.id)}
                />
              ))}
            </Column>
          </Column>

          <Line background="neutral-alpha-weak" />

          <DateInput
            id={`asset-task-due-${task.id}`}
            label="Fecha de entrega"
            value={dueDate}
            onChange={handleSaveDueDate}
            disabled={!isFreelancer || busy}
          />

          <Column gap="4" fillWidth>
            <Input
              id={`asset-task-deliverable-${task.id}`}
              label="Liga de entregables"
              value={deliverableUrl}
              placeholder="https://drive.google.com/..."
              onChange={(e) => setDeliverableUrl(e.target.value)}
              onBlur={handleSaveDeliverableUrl}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveDeliverableUrl();
              }}
              disabled={busy}
            />
          </Column>

          <Line background="neutral-alpha-weak" />

          {isFreelancer && task.status === "pending" && (
            <Button
              variant="secondary"
              size="s"
              prefixIcon="check"
              onClick={handleRequestApproval}
              loading={busy}
            >
              Solicitar aprobación
            </Button>
          )}

          {viewerRole === "client" && task.status === "in_review" && (
            <Row fillWidth gap="8">
              <Button
                variant="primary"
                size="s"
                prefixIcon="check"
                onClick={() => handleResolveApproval(true)}
                loading={busy}
                style={{ flex: 1 }}
              >
                Aprobar
              </Button>
              <Button
                variant="danger"
                size="s"
                prefixIcon="xCircle"
                onClick={() => handleResolveApproval(false)}
                loading={busy}
                style={{ flex: 1 }}
              >
                Rechazar
              </Button>
            </Row>
          )}

          <Line background="neutral-alpha-weak" />

          <Column gap="8" fillWidth>
            <Text variant="label-strong-s">Adjuntar archivo</Text>
            <Input
              id={`asset-task-attach-label-${task.id}`}
              label="Etiqueta"
              value={attachLabel}
              onChange={(e) => setAttachLabel(e.target.value)}
              placeholder="Ej. Boceto v2"
            />
            <Input
              id={`asset-task-attach-url-${task.id}`}
              label="URL"
              value={attachUrl}
              onChange={(e) => setAttachUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <Select
              id={`asset-task-attach-subtype-${task.id}`}
              label="Etiqueta de archivo"
              placeholder="Selecciona una opción"
              value={attachSubtype}
              onSelect={(value) => setAttachSubtype(value as string)}
              options={FILE_SUBTYPE_OPTIONS}
            />
            <Button
              variant="secondary"
              size="s"
              prefixIcon="plus"
              onClick={handleAttach}
              loading={attaching}
              disabled={!attachLabel.trim() || !attachUrl.trim()}
            >
              Adjuntar
            </Button>
          </Column>

          {error && (
            <Text variant="label-default-s" onBackground="danger-weak">
              {error}
            </Text>
          )}
        </Column>
      }
    />
  );
}

function AssetTaskRow({
  task,
  canEdit,
  projectId,
  viewerRole,
  isFreelancer,
  projectMembers,
}: {
  task: ProjectAssetTaskData;
  canEdit: boolean;
  projectId: string;
  viewerRole: ViewerRole;
  isFreelancer: boolean;
  projectMembers: ProjectMemberSummary[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [savingTitle, setSavingTitle] = useState(false);

  const handleToggle = async () => {
    setBusy(true);
    const result = await toggleProjectAssetTask(task.id, !task.done);
    setBusy(false);
    if (result.ok) router.refresh();
  };

  const handleDelete = async () => {
    setBusy(true);
    const result = await deleteProjectAssetTask(task.id);
    setBusy(false);
    if (result.ok) router.refresh();
  };

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === task.title) {
      setEditingTitle(false);
      setTitleDraft(task.title);
      return;
    }
    setSavingTitle(true);
    const result = await renameProjectAssetTask(task.id, titleDraft);
    setSavingTitle(false);
    if (!result.ok) return;
    setEditingTitle(false);
    router.refresh();
  };

  return (
    <Column fillWidth paddingX="16" paddingY="8" gap="8">
      <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
        <Row gap="12" vertical="center" style={{ minWidth: 0, flex: 1 }}>
          <Checkbox isChecked={task.done} onToggle={handleToggle} disabled={busy} />
          {editingTitle ? (
            <Column style={{ flex: 1, minWidth: 160 }}>
              <Input
                id={`asset-task-title-${task.id}`}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") {
                    setEditingTitle(false);
                    setTitleDraft(task.title);
                  }
                }}
              />
            </Column>
          ) : (
            <Text
              variant="label-default-s"
              onBackground={task.done ? "neutral-weak" : "neutral-strong"}
              style={{
                minWidth: 0,
                overflowWrap: "anywhere",
                textDecoration: task.done ? "line-through" : undefined,
              }}
            >
              {task.title}
            </Text>
          )}
        </Row>
        <Row gap="4" vertical="center">
          {editingTitle ? (
            <>
              <IconButton
                icon="check"
                size="s"
                variant="tertiary"
                tooltip="Guardar"
                tooltipPosition="top"
                loading={savingTitle}
                disabled={savingTitle}
                onClick={handleSaveTitle}
              />
              <IconButton
                icon="xCircle"
                size="s"
                variant="tertiary"
                tooltip="Cancelar"
                tooltipPosition="top"
                disabled={savingTitle}
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(task.title);
                }}
              />
            </>
          ) : (
            <>
              {canEdit && (
                <>
                  <IconButton
                    icon="edit"
                    size="s"
                    variant="tertiary"
                    tooltip="Editar tarea"
                    tooltipPosition="top"
                    onClick={() => setEditingTitle(true)}
                  />
                  <IconButton
                    icon="trash"
                    size="s"
                    variant="tertiary"
                    tooltip="Eliminar tarea"
                    tooltipPosition="top"
                    loading={busy}
                    disabled={busy}
                    onClick={handleDelete}
                  />
                </>
              )}
              <AssetTaskMenu
                task={task}
                projectId={projectId}
                viewerRole={viewerRole}
                isFreelancer={isFreelancer}
                projectMembers={projectMembers}
                onChanged={() => router.refresh()}
              />
            </>
          )}
        </Row>
      </Row>

      <Row gap="12" vertical="center" wrap>
        <Tag
          size="s"
          variant={TASK_STATUS_VARIANTS[task.status] ?? "neutral"}
          label={TASK_STATUS_LABELS[task.status] ?? task.status}
        />
        {task.dueDate && (
          <Row gap="4" vertical="center">
            <Icon name="calendar" size="xs" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          </Row>
        )}
        {task.deliverableUrl && (
          <IconButton
            icon="link"
            size="s"
            variant="tertiary"
            href={task.deliverableUrl}
            target="_blank"
            rel="noopener noreferrer"
            tooltip="Ver entregable"
            tooltipPosition="top"
          />
        )}
        {task.assignees.length > 0 && (
          <AvatarGroup
            size="xs"
            avatars={task.assignees.map((assignee) => ({
              ...(assignee.imageUrl
                ? { src: assignee.imageUrl }
                : { value: (assignee.name?.[0] ?? "U").toUpperCase() }),
            }))}
          />
        )}
      </Row>
    </Column>
  );
}

function AssetCard({
  asset,
  viewerRole,
  projectId,
  projectMembers,
}: {
  asset: ProjectAssetData;
  viewerRole: ViewerRole;
  projectId: string;
  projectMembers: ProjectMemberSummary[];
}) {
  const router = useRouter();
  const isFreelancer = viewerRole === "freelancer";

  const [collapsed, setCollapsed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(asset.title);
  const [savingTitle, setSavingTitle] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const total = asset.tasks.length;
  const done = asset.tasks.filter((task) => task.done).length;

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === asset.title) {
      setEditingTitle(false);
      setTitleDraft(asset.title);
      return;
    }
    setSavingTitle(true);
    setError(null);
    const result = await renameProjectAsset(asset.id, titleDraft);
    setSavingTitle(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingTitle(false);
    router.refresh();
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    setError(null);
    const result = await addProjectAssetTask(asset.id, newTaskTitle);
    setAddingTask(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewTaskTitle("");
    router.refresh();
  };

  const handleDeleteAsset = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeletingAsset(true);
    setError(null);
    const result = await deleteProjectAsset(asset.id);
    setDeletingAsset(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <Column
      fillWidth
      border="neutral-alpha-medium"
      radius="l"
      padding="16"
      gap={collapsed ? "0" : "12"}
    >
      <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
        <Row gap="8" vertical="center" style={{ minWidth: 0, flex: 1 }}>
          <IconButton
            icon={collapsed ? "chevronRight" : "chevronDown"}
            size="s"
            variant="tertiary"
            tooltip={collapsed ? "Expandir activo" : "Colapsar activo"}
            tooltipPosition="top"
            onClick={() => setCollapsed((current) => !current)}
          />
          {editingTitle ? (
            <>
              <Column style={{ flex: 1, minWidth: 160 }}>
                <Input
                  id={`asset-title-${asset.id}`}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") {
                      setEditingTitle(false);
                      setTitleDraft(asset.title);
                    }
                  }}
                />
              </Column>
              <IconButton
                icon="check"
                size="s"
                variant="tertiary"
                tooltip="Guardar"
                tooltipPosition="top"
                loading={savingTitle}
                disabled={savingTitle}
                onClick={handleSaveTitle}
              />
              <IconButton
                icon="xCircle"
                size="s"
                variant="tertiary"
                tooltip="Cancelar"
                tooltipPosition="top"
                disabled={savingTitle}
                onClick={() => {
                  setEditingTitle(false);
                  setTitleDraft(asset.title);
                }}
              />
            </>
          ) : (
            <>
              <Text
                variant="heading-strong-s"
                onBackground="neutral-strong"
                style={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {asset.title}
              </Text>
              {isFreelancer && (
                <IconButton
                  icon="edit"
                  size="s"
                  variant="tertiary"
                  tooltip="Renombrar activo"
                  tooltipPosition="top"
                  onClick={() => setEditingTitle(true)}
                />
              )}
            </>
          )}
        </Row>

        <Row gap="8" vertical="center">
          {total > 0 && (
            <Tag
              size="s"
              variant={done === total ? "success" : "neutral"}
              label={`${done}/${total}`}
            />
          )}
          {isFreelancer && (
            <IconButton
              icon="trash"
              size="s"
              variant={confirmDelete ? "danger" : "tertiary"}
              tooltip={confirmDelete ? "Confirmar eliminación" : "Eliminar activo"}
              tooltipPosition="top"
              loading={deletingAsset}
              disabled={deletingAsset}
              onClick={handleDeleteAsset}
            />
          )}
          {confirmDelete && isFreelancer && (
            <IconButton
              icon="xCircle"
              size="s"
              variant="tertiary"
              tooltip="Cancelar"
              tooltipPosition="top"
              disabled={deletingAsset}
              onClick={() => setConfirmDelete(false)}
            />
          )}
        </Row>
      </Row>

      {!collapsed && (
        <>
          {error && (
            <Feedback
              variant="danger"
              description={error}
              onClose={() => setError(null)}
              showCloseButton
              fillWidth
            />
          )}

          {asset.tasks.length > 0 && (
            <Column fillWidth border="neutral-alpha-weak" radius="m" overflow="hidden">
              {asset.tasks.map((task, index) => (
                <Column key={task.id} fillWidth>
                  {index > 0 && <Line background="neutral-alpha-weak" />}
                  <AssetTaskRow
                    task={task}
                    canEdit={isFreelancer}
                    projectId={projectId}
                    viewerRole={viewerRole}
                    isFreelancer={isFreelancer}
                    projectMembers={projectMembers}
                  />
                </Column>
              ))}
            </Column>
          )}

          {isFreelancer && (
            <Row fillWidth gap="8" vertical="end" wrap paddingTop="12">
              <Column style={{ flex: 1, minWidth: 160 }}>
                <Input
                  id={`asset-new-task-${asset.id}`}
                  label="Nueva tarea del checklist"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ej. Enviar boceto inicial"
                />
              </Column>
              <Button
                variant="secondary"
                size="s"
                prefixIcon="plus"
                onClick={handleAddTask}
                loading={addingTask}
                disabled={!newTaskTitle.trim()}
              >
                Agregar tarea
              </Button>
            </Row>
          )}
        </>
      )}
    </Column>
  );
}

// Diálogo de dos columnas (categorías a la izquierda, búsqueda de activos a
// la derecha) para agregar un Activo desde el catálogo o uno personalizado.
function AddAssetSearch({
  isOpen,
  onClose,
  projectId,
  assetCatalog,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  assetCatalog: AssetCategoryData[];
}) {
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = assetCatalog.find((category) => category.id === selectedCategoryId);
  const filteredTemplates =
    selectedCategory?.templates.filter((template) =>
      template.name.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];

  const handleClose = () => {
    if (saving) return;
    setSelectedCategoryId("");
    setQuery("");
    setShowCustom(false);
    setCustomTitle("");
    setError(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, saving]);

  const handleAddFromTemplate = async (templateId: string) => {
    setSaving(true);
    setError(null);
    const result = await addProjectAsset(projectId, templateId);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  };

  const handleAddCustom = async () => {
    if (!customTitle.trim()) return;
    setSaving(true);
    setError(null);
    const result = await addCustomProjectAsset(projectId, customTitle);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <Row
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      zIndex={10}
      center
      background="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <Row
        maxWidth="s"
        fillWidth
        background="surface"
        radius="l-4"
        border="neutral-alpha-medium"
        shadow="l"
        overflow="hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "70vh" }}
      >
        {/* Columna izquierda: categorías del catálogo */}
        <Column
          gap="2"
          padding="8"
          background="surface"
          overflowY="auto"
          style={{ minWidth: 160, flexShrink: 0 }}
        >
          <Row paddingX="12" paddingTop="8" paddingBottom="4">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Categorías
            </Text>
          </Row>
          {assetCatalog.map((category) => {
            const active = category.id === selectedCategoryId;
            return (
              <Row
                key={category.id}
                paddingX="12"
                paddingY="8"
                radius="m"
                cursor="pointer"
                background={active ? "neutral-alpha-weak" : undefined}
                onClick={() => {
                  setSelectedCategoryId(category.id);
                  setQuery("");
                  setShowCustom(false);
                }}
              >
                <Text
                  variant="label-default-s"
                  onBackground={active ? "neutral-strong" : "neutral-weak"}
                >
                  {category.name}
                </Text>
              </Row>
            );
          })}
        </Column>

        <Line background="neutral-alpha-weak" vert />

        {/* Columna derecha: búsqueda de activos de la categoría elegida */}
        <Column fillWidth padding="8" gap="4" overflowY="auto" style={{ minHeight: 0 }}>
          <Row fillWidth paddingX="8" paddingTop="4" horizontal="end">
            <IconButton
              icon="close"
              size="s"
              variant="tertiary"
              tooltip="Cerrar"
              tooltipPosition="left"
              onClick={handleClose}
            />
          </Row>

          {!selectedCategory ? (
            <Row fillWidth center paddingY="64">
              <Text variant="body-default-m" onBackground="neutral-weak">
                Selecciona una categoría
              </Text>
            </Row>
          ) : (
            <>
              <Row fillWidth padding="8">
                <Input
                  id="asset-search"
                  placeholder="Buscar activo..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  hasPrefix={<Icon name="search" size="xs" onBackground="neutral-weak" />}
                />
              </Row>

              <Column fillWidth gap="2" paddingX="4">
                {filteredTemplates.length === 0 ? (
                  <Row fillWidth center paddingY="32">
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Sin resultados en esta categoría.
                    </Text>
                  </Row>
                ) : (
                  filteredTemplates.map((template) => (
                    <Row
                      key={template.id}
                      fillWidth
                      gap="8"
                      vertical="center"
                      paddingX="12"
                      paddingY="8"
                      radius="m"
                      cursor="pointer"
                      onClick={() => handleAddFromTemplate(template.id)}
                    >
                      <Icon name="sparkles" size="xs" onBackground="neutral-weak" />
                      <Text variant="label-default-s" onBackground="neutral-strong">
                        {template.name}
                      </Text>
                    </Row>
                  ))
                )}
              </Column>
            </>
          )}

          {error && (
            <Row fillWidth paddingX="8">
              <Feedback variant="danger" description={error} />
            </Row>
          )}

          <Row fillWidth paddingX="12" paddingTop="8">
            {!showCustom ? (
              <Text
                variant="label-default-s"
                onBackground="neutral-weak"
                style={{ cursor: "pointer" }}
                onClick={() => setShowCustom(true)}
              >
                ¿No encuentras el activo? Crea uno personalizado
              </Text>
            ) : (
              <Row fillWidth gap="8" vertical="end" wrap>
                <Column style={{ flex: 1, minWidth: 160 }}>
                  <Input
                    id="asset-custom-title"
                    label="Título del activo"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ej. Guión de video"
                  />
                </Column>
                <Button
                  variant="primary"
                  size="m"
                  onClick={handleAddCustom}
                  loading={saving}
                  disabled={!customTitle.trim()}
                >
                  Agregar
                </Button>
              </Row>
            )}
          </Row>
        </Column>
      </Row>
    </Row>
  );
}

export function CollabProjectView({
  project,
  client,
  freelancer,
  viewerRole,
  viewerId,
  assetCatalog,
  availableFreelancers,
}: CollabProjectViewProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addAssetOpen, setAddAssetOpen] = useState(false);

  const [busyCollaboratorId, setBusyCollaboratorId] = useState<string | null>(null);

  const [brandLinkLabel, setBrandLinkLabel] = useState("");
  const [brandLinkUrl, setBrandLinkUrl] = useState("");
  const [brandLinkSubtype, setBrandLinkSubtype] = useState("");
  const [brandLinkError, setBrandLinkError] = useState<string | null>(null);
  const [addingBrandLink, setAddingBrandLink] = useState(false);

  const [finalLinkLabel, setFinalLinkLabel] = useState("");
  const [finalLinkUrl, setFinalLinkUrl] = useState("");
  const [finalLinkSubtype, setFinalLinkSubtype] = useState("");
  const [finalLinkError, setFinalLinkError] = useState<string | null>(null);
  const [addingFinalLink, setAddingFinalLink] = useState(false);

  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);

  const [channels, setChannels] = useState<ChannelData[]>([]);

  // Accesos directos a las salas del chat del proyecto (punto 3): se cargan
  // aparte porque CollabProjectData no trae ProjectChannel (viven en
  // src/app/actions/channels.ts, reutilizado también por /mensajes).
  useEffect(() => {
    let cancelled = false;
    if (project.status !== "active") return;
    (async () => {
      const result = await getChannels(project.id);
      if (!cancelled && result.ok) setChannels(result.channels);
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id, project.status]);

  // Miembros del proyecto (client + freelancer fundador + colaboradores) para
  // el multi-select de "Responsables" de las tareas de activo.
  const projectMembers: ProjectMemberSummary[] = [
    { id: client.id, name: client.name ?? client.username, imageUrl: client.imageUrl },
    { id: freelancer.id, name: freelancer.name ?? freelancer.username, imageUrl: freelancer.imageUrl },
    ...project.collaborators.map((collaborator) => ({
      id: collaborator.id,
      name: collaborator.name ?? collaborator.username,
      imageUrl: collaborator.imageUrl,
    })),
  ];

  // Título de la tarea de activo a la que quedó ligado cada link (punto 5).
  const assetTaskTitleById = new Map<string, string>();
  for (const asset of project.assets) {
    for (const task of asset.tasks) {
      assetTaskTitleById.set(task.id, task.title);
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    setBusyCollaboratorId(collaboratorId);
    setError(null);
    const result = await removeProjectCollaborator(project.id, collaboratorId);
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusyCollaboratorId(null);
  };

  const handleAddBrandLink = async () => {
    if (!brandLinkLabel.trim() || !brandLinkUrl.trim()) return;
    if (!validateExternalUrl(brandLinkUrl)) {
      setBrandLinkError("La URL no es válida.");
      return;
    }
    setBrandLinkError(null);
    setAddingBrandLink(true);
    setError(null);
    const result = await addProjectLink(project.id, brandLinkLabel, brandLinkUrl, {
      ...(brandLinkSubtype ? { subtype: brandLinkSubtype } : {}),
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setBrandLinkLabel("");
      setBrandLinkUrl("");
      setBrandLinkSubtype("");
      router.refresh();
    }
    setAddingBrandLink(false);
  };

  const handleAddFinalLink = async () => {
    if (!finalLinkLabel.trim() || !finalLinkUrl.trim()) return;
    if (!validateExternalUrl(finalLinkUrl)) {
      setFinalLinkError("La URL no es válida.");
      return;
    }
    setFinalLinkError(null);
    setAddingFinalLink(true);
    setError(null);
    const result = await addProjectLink(project.id, finalLinkLabel, finalLinkUrl, {
      ...(finalLinkSubtype ? { subtype: finalLinkSubtype } : {}),
    });
    if (!result.ok) {
      setError(result.error);
    } else {
      setFinalLinkLabel("");
      setFinalLinkUrl("");
      setFinalLinkSubtype("");
      router.refresh();
    }
    setAddingFinalLink(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    setBusyLinkId(linkId);
    setError(null);
    const result = await deleteProjectLink(linkId);
    if (!result.ok) setError(result.error);
    else router.refresh();
    setBusyLinkId(null);
  };

  const totalAssetTasks = project.assets.reduce((sum, asset) => sum + asset.tasks.length, 0);
  const doneAssetTasks = project.assets.reduce(
    (sum, asset) => sum + asset.tasks.filter((task) => task.done).length,
    0,
  );
  const assetProgressPercent =
    totalAssetTasks > 0 ? Math.round((doneAssetTasks / totalAssetTasks) * 100) : 0;

  const brandLinks = project.links.filter((link) => link.type === "brand");
  const finalLinks = project.links.filter((link) => link.type === "final");

  return (
    <Column
      fillWidth
      maxWidth="l"
      horizontal="center"
      paddingX="32"
      paddingTop="40"
      paddingBottom="80"
      gap="24"
    >
      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="24"
        gap="16"
        fillWidth
      >
        <Row fillWidth gap="16" horizontal="between" vertical="start" wrap>
          <Row
            gap="16"
            vertical="start"
            fillWidth
            s={{ direction: "column" }}
            style={{ minWidth: 0 }}
          >
            <ProjectLogoControl
              logoUrl={project.logoUrl}
              title={project.title}
              canEdit
              onUpload={(dataUrl) => updateProjectLogo(project.id, dataUrl)}
              onSaved={() => router.refresh()}
            />
            {/* fillWidth: en móvil el Row de arriba pasa a columna (avatar
                "xl" fijo ~150px + este bloque de texto ya no caben en la
                misma fila) — sin fillWidth el Column heredaba solo el ancho
                sobrante junto al avatar (~88px) y forzaba overflowWrap
                "anywhere" a partir texto por caracter, ej. nombre de client. */}
            <Column gap="12" fillWidth style={{ minWidth: 0 }}>
              <Row gap="8" vertical="center" wrap>
                <Heading
                  variant="heading-strong-l"
                  style={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  {project.title}
                </Heading>
                <Tag
                  size="m"
                  variant={PROJECT_STATUS_VARIANTS[project.status] ?? "neutral"}
                  label={PROJECT_STATUS_LABELS[project.status] ?? project.status}
                />
              </Row>
              {project.description && (
                <Text
                  variant="body-default-m"
                  onBackground="neutral-weak"
                  style={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  {project.description}
                </Text>
              )}
              <ProjectTypeEditor project={project} canEdit />
              <Row gap="16" wrap style={{ minWidth: 0 }}>
                <PersonBadge label="Client" person={client} />
              </Row>
            </Column>
          </Row>
          <IconButton
            icon="settings"
            size="m"
            variant="tertiary"
            tooltip="Configuración del proyecto"
            tooltipPosition="left"
            onClick={() => setSettingsOpen(true)}
          />
        </Row>

        <Line background="neutral-alpha-weak" />

        <Column gap="8" fillWidth>
          <Text variant="label-default-s" onBackground="neutral-weak">
            Freelancers
          </Text>
          <Row gap="12" vertical="center" wrap>
            <CollaboratorBadge person={freelancer} canRemove={false} busy={false} />
            {project.collaborators.map((collaborator) => (
              <CollaboratorBadge
                key={collaborator.id}
                person={collaborator}
                headline={collaborator.headline}
                canRemove={viewerRole === "client" || collaborator.id === viewerId}
                busy={busyCollaboratorId === collaborator.id}
                onRemove={() => handleRemoveCollaborator(collaborator.id)}
              />
            ))}
            <AddCollaboratorSearch
              projectId={project.id}
              availableFreelancers={availableFreelancers}
              onError={setError}
            />
          </Row>
        </Column>

        {viewerRole === "client" && project.clientNotes && (
          <Column background="neutral-alpha-weak" padding="12" radius="m" gap="4">
            <Text variant="label-strong-s">Tus notas</Text>
            <Text
              variant="body-default-s"
              onBackground="neutral-weak"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {project.clientNotes}
            </Text>
          </Column>
        )}
      </Column>

      {error && (
        <Feedback
          variant="danger"
          description={error}
          onClose={() => setError(null)}
          showCloseButton
          fillWidth
        />
      )}

      {/* ── Chat del proyecto (centralizado en /mensajes) ────────────────── */}
      {project.status === "active" && (
        <Column
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="24"
          gap="12"
          fillWidth
        >
          <Heading variant="heading-strong-m">Chat del proyecto</Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            La conversación del proyecto ahora vive en el centro de mensajes.
          </Text>
          {channels.length > 0 && (
            <Row fillWidth gap="8" wrap>
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  variant="tertiary"
                  size="s"
                  prefixIcon="chat"
                  href={`/mensajes?project=${project.id}&channel=${channel.id}`}
                >
                  {channel.name}
                </Button>
              ))}
            </Row>
          )}
          <Row fillWidth horizontal="start">
            <Button
              variant="secondary"
              size="m"
              prefixIcon="email"
              href={`/mensajes?project=${project.id}`}
            >
              Ir a mensajes
            </Button>
          </Row>
        </Column>
      )}

      {/* ── Activos del proyecto ─────────────────────────────────────────── */}
      <Column gap="16" fillWidth>
        <Row fillWidth horizontal="between" vertical="center">
          <Heading variant="heading-strong-m">Activos del proyecto</Heading>
          <Text variant="label-default-s" onBackground="neutral-weak">
            {project.assets.length} {project.assets.length === 1 ? "activo" : "activos"}
          </Text>
        </Row>

        {totalAssetTasks > 0 && (
          <Column gap="8" fillWidth>
            <ProgressBar value={assetProgressPercent} label={false} />
            <Text variant="label-default-s" onBackground="neutral-weak" align="center">
              {doneAssetTasks} de {totalAssetTasks} completados ({assetProgressPercent}%)
            </Text>
          </Column>
        )}

        {project.assets.length === 0 ? (
          <Column
            fillWidth
            horizontal="center"
            gap="12"
            padding="32"
            border="neutral-alpha-medium"
            radius="l"
          >
            <Icon name="sparkles" size="l" onBackground="neutral-weak" />
            <Text variant="body-default-m" onBackground="neutral-weak" align="center">
              Aún no hay activos en este proyecto.
            </Text>
          </Column>
        ) : (
          <Column gap="12" fillWidth>
            {project.assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                viewerRole={viewerRole}
                projectId={project.id}
                projectMembers={projectMembers}
              />
            ))}
          </Column>
        )}

        <Row fillWidth horizontal="end">
          <Button
            variant="secondary"
            size="m"
            prefixIcon="plus"
            onClick={() => setAddAssetOpen(true)}
          >
            Agregar activo
          </Button>
        </Row>
      </Column>

      {/* ── Archivos ─────────────────────────────────────────────────────── */}
      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-m">Archivos del proyecto</Heading>

        <Feedback
          variant="info"
          description="Aquí no se guardan archivos pesados: sube tus materiales a tu servicio de nube (Google Drive, Dropbox, OneDrive, WeTransfer...) con permisos de acceso para compartir, y pega el link abajo."
        />

        <Row fillWidth gap="24" wrap>
          <Column gap="16" style={{ flex: 1, minWidth: 280 }}>
            <Heading variant="heading-strong-s">Activos finales</Heading>

            {finalLinks.length === 0 ? (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Todavía no se han compartido activos finales.
              </Text>
            ) : (
              <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
                {finalLinks.map((link, index) => (
                  <Column key={link.id} fillWidth>
                    {index > 0 && <Line background="neutral-alpha-weak" />}
                    <LinkRow
                      link={link}
                      canDelete={viewerRole === "client" || link.addedById === viewerId}
                      busy={busyLinkId === link.id}
                      onDelete={() => handleDeleteLink(link.id)}
                      assetTaskTitle={
                        link.assetTaskId ? assetTaskTitleById.get(link.assetTaskId) : null
                      }
                    />
                  </Column>
                ))}
              </Column>
            )}

            {viewerRole === "freelancer" && (
              <Column gap="8" fillWidth>
                <Row fillWidth gap="8" wrap>
                  <Column style={{ flex: 1, minWidth: 160 }}>
                    <Input
                      id="collab-new-final-link-label"
                      label="Etiqueta"
                      value={finalLinkLabel}
                      onChange={(e) => setFinalLinkLabel(e.target.value)}
                      placeholder="Ej. Fotos finales"
                    />
                  </Column>
                  <Column style={{ flex: 2, minWidth: 220 }}>
                    <Input
                      id="collab-new-final-link-url"
                      label="URL"
                      value={finalLinkUrl}
                      onChange={(e) => {
                        setFinalLinkUrl(e.target.value);
                        setFinalLinkError(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      error={Boolean(finalLinkError)}
                      errorMessage={finalLinkError ?? undefined}
                    />
                  </Column>
                  <Column style={{ flex: 1, minWidth: 160 }}>
                    <Select
                      id="collab-new-final-link-subtype"
                      label="Etiqueta de archivo"
                      placeholder="Selecciona una opción"
                      value={finalLinkSubtype}
                      onSelect={(value) => setFinalLinkSubtype(value as string)}
                      options={FILE_SUBTYPE_OPTIONS}
                    />
                  </Column>
                </Row>
                <Row fillWidth horizontal="end">
                  <Button
                    variant="secondary"
                    size="m"
                    prefixIcon="plus"
                    onClick={handleAddFinalLink}
                    loading={addingFinalLink}
                    disabled={!finalLinkLabel.trim() || !finalLinkUrl.trim()}
                  >
                    Agregar link
                  </Button>
                </Row>
              </Column>
            )}
          </Column>

          <Column gap="16" style={{ flex: 1, minWidth: 280 }}>
            <Heading variant="heading-strong-s">Assets de marca</Heading>

            {brandLinks.length === 0 ? (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Todavía no se han compartido assets de marca.
              </Text>
            ) : (
              <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
                {brandLinks.map((link, index) => (
                  <Column key={link.id} fillWidth>
                    {index > 0 && <Line background="neutral-alpha-weak" />}
                    <LinkRow
                      link={link}
                      canDelete={viewerRole === "client" || link.addedById === viewerId}
                      busy={busyLinkId === link.id}
                      onDelete={() => handleDeleteLink(link.id)}
                      assetTaskTitle={
                        link.assetTaskId ? assetTaskTitleById.get(link.assetTaskId) : null
                      }
                    />
                  </Column>
                ))}
              </Column>
            )}

            {viewerRole === "client" && (
              <Column gap="8" fillWidth>
                <Row fillWidth gap="8" wrap>
                  <Column style={{ flex: 1, minWidth: 160 }}>
                    <Input
                      id="collab-new-brand-link-label"
                      label="Etiqueta"
                      value={brandLinkLabel}
                      onChange={(e) => setBrandLinkLabel(e.target.value)}
                      placeholder="Ej. Manual de marca"
                    />
                  </Column>
                  <Column style={{ flex: 2, minWidth: 220 }}>
                    <Input
                      id="collab-new-brand-link-url"
                      label="URL"
                      value={brandLinkUrl}
                      onChange={(e) => {
                        setBrandLinkUrl(e.target.value);
                        setBrandLinkError(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      error={Boolean(brandLinkError)}
                      errorMessage={brandLinkError ?? undefined}
                    />
                  </Column>
                  <Column style={{ flex: 1, minWidth: 160 }}>
                    <Select
                      id="collab-new-brand-link-subtype"
                      label="Etiqueta de archivo"
                      placeholder="Selecciona una opción"
                      value={brandLinkSubtype}
                      onSelect={(value) => setBrandLinkSubtype(value as string)}
                      options={FILE_SUBTYPE_OPTIONS}
                    />
                  </Column>
                </Row>
                <Row fillWidth horizontal="end">
                  <Button
                    variant="secondary"
                    size="m"
                    prefixIcon="plus"
                    onClick={handleAddBrandLink}
                    loading={addingBrandLink}
                    disabled={!brandLinkLabel.trim() || !brandLinkUrl.trim()}
                  >
                    Agregar link
                  </Button>
                </Row>
              </Column>
            )}
          </Column>
        </Row>
      </Column>

      <ProjectSettingsDialog
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
        viewerRole={viewerRole}
      />

      <AddAssetSearch
        isOpen={addAssetOpen}
        onClose={() => setAddAssetOpen(false)}
        projectId={project.id}
        assetCatalog={assetCatalog}
      />
    </Column>
  );
}

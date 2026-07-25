"use client";

import {
  Accordion,
  Avatar,
  Button,
  Column,
  Grid,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Media,
  Modal,
  Row,
  SmartLink,
  Switch,
  Tag,
  Text,
  Textarea,
  useToast,
} from "@once-ui-system/core";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  assignProjectRole,
  type ChannelMemberData,
  createChannel,
  deleteChannel,
  getChannelMembers,
  removeProjectRole,
  renameChannel,
  setChannelAdmin,
  setChannelMembers,
  updateChannelInfo,
} from "@/app/actions/channels";
import type {
  ChannelContextData,
  ChannelContextParticipant,
  ConversationSummary,
} from "@/app/actions/inbox";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { CollaboratorSearchModal } from "@/components/collab/CollaboratorSearchModal";
import { ProjectLogoControl } from "@/components/collab/ProjectLogoControl";
import type { ProjectMemberRole } from "@/generated/prisma/enums";
import {
  parseMessageBody,
  personInitial,
  personLabel,
  ROLE_LABELS,
  ROLE_OPTIONS,
  type StreamMessage,
} from "./messengerUtils";
import { TaskCard } from "./TaskCard";

/* ══ Panel derecho: metadatos del chat y gestión de proyecto (2.3) ══════ */

const modalBackdrop = <BrandModalBackdrop />;

/* ── Sección: Roles del proyecto ─────────────────────────────────────── */
// Exportado para reutilizarse en el overlay de ajustes de proyecto de
// ConversationList (mismo patrón de asignación, sin duplicar la UI).

export function RolesSection({
  context,
  onChanged,
}: {
  context: ChannelContextData;
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const freelancerSet = new Set(context.freelancerParticipants);
  const freelancers = context.participants.filter((person) => freelancerSet.has(person.id));
  const withoutRole = freelancers.filter((person) => person.roles.length === 0);

  const hasRole = (userId: string, role: ProjectMemberRole) =>
    freelancers.find((person) => person.id === userId)?.roles.includes(role) ?? false;

  const handleToggle = async (userId: string, role: ProjectMemberRole) => {
    const key = `${userId}-${role}`;
    if (busyKey) return;
    setBusyKey(key);
    const active = hasRole(userId, role);
    const result = active
      ? await removeProjectRole(context.project.id, userId, role)
      : await assignProjectRole(context.project.id, userId, role);
    if (!result.ok) addToast({ variant: "danger", message: result.error });
    setBusyKey(null);
    onChanged();
  };

  return (
    <Column gap="16" fillWidth>
      {freelancers.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Todavía no hay freelancers en este proyecto.
        </Text>
      ) : (
        <>
          {ROLE_OPTIONS.map((role) => {
            const withRole = freelancers.filter((person) => person.roles.includes(role));
            return (
              <Column key={role} gap="8" fillWidth>
                <Text variant="label-strong-s" onBackground="neutral-strong">
                  {ROLE_LABELS[role]}
                </Text>
                {withRole.length === 0 ? (
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Nadie asignado.
                  </Text>
                ) : (
                  <Row gap="8" wrap>
                    {withRole.map((person) => (
                      <Row key={person.id} gap="8" vertical="center">
                        <Avatar
                          size="xs"
                          {...(person.imageUrl
                            ? { src: person.imageUrl }
                            : { value: personInitial(person) })}
                        />
                        <Text variant="body-default-s" onBackground="neutral-weak">
                          {personLabel(person)}
                        </Text>
                      </Row>
                    ))}
                  </Row>
                )}
              </Column>
            );
          })}

          <Column gap="8" fillWidth>
            <Text variant="label-strong-s" onBackground="neutral-strong">
              Sin rol
            </Text>
            {withoutRole.length === 0 ? (
              <Text variant="body-default-s" onBackground="neutral-weak">
                Todos los freelancers tienen al menos un rol.
              </Text>
            ) : (
              <Row gap="8" wrap>
                {withoutRole.map((person) => (
                  <Row key={person.id} gap="8" vertical="center">
                    <Avatar
                      size="xs"
                      {...(person.imageUrl
                        ? { src: person.imageUrl }
                        : { value: personInitial(person) })}
                    />
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      {personLabel(person)}
                    </Text>
                  </Row>
                ))}
              </Row>
            )}
          </Column>

          {context.isAdmin && (
            <Column gap="12" fillWidth paddingTop="8" borderTop="neutral-alpha-weak">
              <Text variant="label-strong-s" onBackground="neutral-strong">
                Asignar roles
              </Text>
              {freelancers.map((freelancer) => (
                <Column key={freelancer.id} gap="8" fillWidth>
                  <Row gap="8" vertical="center">
                    <Avatar
                      size="xs"
                      {...(freelancer.imageUrl
                        ? { src: freelancer.imageUrl }
                        : { value: personInitial(freelancer) })}
                    />
                    <Text variant="body-default-s" onBackground="neutral-strong">
                      {personLabel(freelancer)}
                    </Text>
                  </Row>
                  <Row gap="8" wrap>
                    {ROLE_OPTIONS.map((role) => {
                      const active = hasRole(freelancer.id, role);
                      return (
                        <Tag
                          key={role}
                          size="s"
                          variant={active ? "brand" : "neutral"}
                          label={ROLE_LABELS[role]}
                          prefixIcon={active ? "check" : undefined}
                          cursor="interactive"
                          onClick={() => handleToggle(freelancer.id, role)}
                        />
                      );
                    })}
                  </Row>
                </Column>
              ))}
            </Column>
          )}
        </>
      )}
    </Column>
  );
}

/* ── Sección: Acceso a la sala (ChannelMember) ────────────────────────── */
// Solo la ve quien puede configurarla (client dueño o admin de la sala —
// canManage viene ya resuelto por el caller a partir de isAdmin/
// viewerIsRoomAdmin). Una sala sin ChannelMember queda "abierta a todos".
// members/restricted/loading vienen del fetch centralizado en DetailsPanel
// (evita duplicar getChannelMembers con RoomInfoSection, que necesita los
// mismos datos para el editor de miembros y el flag de admin propio).

function AccessSection({
  channelId,
  freelancers,
  canManage,
  members,
  restricted,
  loading,
  onChanged,
}: {
  channelId: string;
  freelancers: ChannelContextParticipant[];
  canManage: boolean;
  members: ChannelMemberData[];
  restricted: boolean;
  loading: boolean;
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!canManage) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Solo el client dueño del proyecto o un admin de la sala pueden configurar el acceso a esta
        sala.
      </Text>
    );
  }
  if (loading) {
    return (
      <Text variant="label-default-s" onBackground="neutral-weak">
        Cargando...
      </Text>
    );
  }

  const memberIds = new Set(members.map((entry) => entry.userId));
  const hasAccess = (userId: string) => !restricted || memberIds.has(userId);

  const applyMemberIds = async (nextUserIds: string[]) => {
    const result = await setChannelMembers(channelId, nextUserIds);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return false;
    }
    onChanged();
    return true;
  };

  const handleToggle = async (userId: string) => {
    if (busyKey) return;
    setBusyKey(userId);
    // Al pasar de "abierta" a restringida por primera vez, se parte del set
    // completo de freelancers actuales y se quita solo al que se está tocando.
    const base = restricted ? members.map((entry) => entry.userId) : freelancers.map((p) => p.id);
    const next = hasAccess(userId)
      ? base.filter((id) => id !== userId)
      : Array.from(new Set([...base, userId]));
    await applyMemberIds(next);
    setBusyKey(null);
  };

  const handleOpenToAll = async () => {
    if (busyKey) return;
    setBusyKey("__all__");
    await applyMemberIds([]);
    setBusyKey(null);
  };

  return (
    <Column gap="12" fillWidth>
      <Text variant="body-default-s" onBackground="neutral-weak">
        {restricted
          ? "Sala restringida: solo entran los colaboradores marcados abajo (el client siempre tiene acceso)."
          : "Sala abierta a todo el equipo del proyecto."}
      </Text>
      {restricted && (
        <Button
          variant="secondary"
          size="s"
          onClick={handleOpenToAll}
          loading={busyKey === "__all__"}
        >
          Abrir a todo el equipo
        </Button>
      )}
      {freelancers.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Todavía no hay freelancers en este proyecto.
        </Text>
      ) : (
        freelancers.map((person) => (
          <Row key={person.id} fillWidth gap="8" vertical="center" horizontal="between">
            <Row gap="8" vertical="center" style={{ minWidth: 0 }}>
              <Avatar
                size="xs"
                {...(person.imageUrl ? { src: person.imageUrl } : { value: personInitial(person) })}
              />
              <Text variant="body-default-s" onBackground="neutral-strong" truncate>
                {personLabel(person)}
              </Text>
            </Row>
            <Switch
              isChecked={hasAccess(person.id)}
              onToggle={() => handleToggle(person.id)}
              loading={busyKey === person.id}
              disabled={busyKey !== null}
              ariaLabel={`Acceso de ${personLabel(person)} a la sala`}
            />
          </Row>
        ))
      )}
    </Column>
  );
}

/* ── Sección: Información editable de la sala (imagen/descripción/miembros) ──
   Visible a todos los miembros de la sala (imagen + descripción en modo
   lectura); los admins de la sala (ChannelMember.isAdmin) o el client dueño
   pueden editar ambas vía updateChannelInfo y agregar/quitar colaboradores
   del proyecto vía setChannelMembers (mismo mecanismo que "Acceso a la
   sala" — aquí se presenta como roster editable en vez de switches). Un
   admin de sala (no el client) puede auto-quitarse la administración. ── */

function RoomInfoSection({
  channelId,
  channel,
  viewerId,
  canManage,
  isRoomAdmin,
  projectFreelancers,
  members,
  restricted,
  onChannelUpdated,
  onSelfDemoted,
}: {
  channelId: string;
  channel: ChannelContextData["channel"];
  viewerId: string;
  canManage: boolean;
  isRoomAdmin: boolean;
  projectFreelancers: ChannelContextParticipant[];
  members: ChannelMemberData[];
  restricted: boolean;
  onChannelUpdated: () => void;
  onSelfDemoted: () => void;
}) {
  const { addToast } = useToast();
  const [description, setDescription] = useState(channel.description ?? "");
  const [savingDescription, setSavingDescription] = useState(false);
  const [confirmDemote, setConfirmDemote] = useState(false);
  const [demoting, setDemoting] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  useEffect(() => {
    setDescription(channel.description ?? "");
  }, [channel.description]);

  const handleSaveDescription = async () => {
    setSavingDescription(true);
    const result = await updateChannelInfo(channelId, { description: description.trim() || null });
    setSavingDescription(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Descripción actualizada." });
    onChannelUpdated();
  };

  const handleUploadImage = (dataUrl: string | null) =>
    updateChannelInfo(channelId, { imageUrl: dataUrl });

  const handleSelfDemote = async () => {
    if (!confirmDemote) {
      setConfirmDemote(true);
      return;
    }
    setDemoting(true);
    const result = await setChannelAdmin(channelId, viewerId, false);
    setDemoting(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Ya no eres admin de esta sala." });
    setConfirmDemote(false);
    onSelfDemoted();
  };

  const memberIds = new Set(members.map((entry) => entry.userId));
  const isInRoom = (id: string) => !restricted || memberIds.has(id);
  const currentMembers = projectFreelancers.filter((person) => isInRoom(person.id));
  const available = projectFreelancers.filter((person) => !isInRoom(person.id));

  const applyMemberIds = async (nextUserIds: string[]) => {
    const result = await setChannelMembers(channelId, nextUserIds);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    onChannelUpdated();
  };

  const handleAddMember = async (userId: string) => {
    setAddBusy(true);
    const base = restricted ? Array.from(memberIds) : projectFreelancers.map((p) => p.id);
    await applyMemberIds(Array.from(new Set([...base, userId])));
    setAddBusy(false);
  };

  const handleRemoveMember = async (userId: string) => {
    setRemoveBusyId(userId);
    const base = restricted ? Array.from(memberIds) : projectFreelancers.map((p) => p.id);
    await applyMemberIds(base.filter((id) => id !== userId));
    setRemoveBusyId(null);
  };

  const searchPeople = available.map((person) => ({
    id: person.id,
    name: person.name,
    username: person.username,
    headline: null,
  }));

  return (
    <Column gap="20" fillWidth>
      <Column gap="8" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Imagen de la sala
        </Text>
        <ProjectLogoControl
          logoUrl={channel.imageUrl}
          title={channel.name}
          canEdit={canManage}
          size="l"
          onUpload={handleUploadImage}
          onSaved={onChannelUpdated}
        />
      </Column>

      <Column gap="8" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Descripción
        </Text>
        {canManage ? (
          <Column gap="8" fillWidth>
            <Textarea
              id="room-description"
              placeholder="¿De qué trata esta sala?"
              lines={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Row fillWidth horizontal="end">
              <Button
                variant="secondary"
                size="s"
                onClick={handleSaveDescription}
                loading={savingDescription}
                disabled={description.trim() === (channel.description ?? "").trim()}
              >
                Guardar descripción
              </Button>
            </Row>
          </Column>
        ) : (
          <Text variant="body-default-s" onBackground="neutral-weak">
            {channel.description || "Esta sala no tiene descripción."}
          </Text>
        )}
      </Column>

      <Column gap="8" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Miembros de la sala
        </Text>
        {currentMembers.length === 0 ? (
          <Text variant="body-default-s" onBackground="neutral-weak">
            Nadie más en la sala todavía.
          </Text>
        ) : (
          currentMembers.map((person) => (
            <Row key={person.id} fillWidth gap="8" vertical="center" horizontal="between">
              <Row gap="8" vertical="center" style={{ minWidth: 0 }}>
                <Avatar
                  size="xs"
                  {...(person.imageUrl
                    ? { src: person.imageUrl }
                    : { value: personInitial(person) })}
                />
                <Text variant="body-default-s" onBackground="neutral-strong" truncate>
                  {personLabel(person)}
                </Text>
              </Row>
              {canManage && (
                <IconButton
                  icon="close"
                  size="s"
                  variant="tertiary"
                  tooltip="Quitar de la sala"
                  loading={removeBusyId === person.id}
                  disabled={removeBusyId !== null}
                  onClick={() => handleRemoveMember(person.id)}
                />
              )}
            </Row>
          ))
        )}
        {canManage && (
          <CollaboratorSearchModal
            people={searchPeople}
            onSelect={handleAddMember}
            trigger={
              <Button variant="secondary" size="s" prefixIcon="plus" disabled={addBusy}>
                Añadir colaborador
              </Button>
            }
            emptyHint="Todos los colaboradores del proyecto ya están en esta sala."
          />
        )}
      </Column>

      {isRoomAdmin && (
        <Column gap="8" fillWidth paddingTop="8" borderTop="neutral-alpha-weak">
          <Button
            variant={confirmDemote ? "danger" : "secondary"}
            size="s"
            onClick={handleSelfDemote}
            loading={demoting}
          >
            {confirmDemote ? "Confirmar: dejar de ser admin" : "Dejar de ser admin de esta sala"}
          </Button>
        </Column>
      )}
    </Column>
  );
}

/* ── Sección exclusiva del client: administradores de la sala ──────────
   Lista de colaboradores del proyecto con switch de admin (setChannelAdmin).
   Otorgar admin solo lo permite el client (regla del server action); este
   switch vive únicamente en la rama isAdmin de PrivacySection. ─────────── */

function RoomAdminsList({
  channelId,
  freelancers,
  members,
  onChanged,
}: {
  channelId: string;
  freelancers: ChannelContextParticipant[];
  members: ChannelMemberData[];
  onChanged: () => void;
}) {
  const { addToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const adminIds = new Set(members.filter((entry) => entry.isAdmin).map((entry) => entry.userId));

  const handleToggle = async (userId: string, next: boolean) => {
    if (busyId) return;
    setBusyId(userId);
    const result = await setChannelAdmin(channelId, userId, next);
    setBusyId(null);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    onChanged();
  };

  if (freelancers.length === 0) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Todavía no hay freelancers en este proyecto.
      </Text>
    );
  }

  return (
    <Column gap="8" fillWidth>
      {freelancers.map((person) => (
        <Row key={person.id} fillWidth gap="8" vertical="center" horizontal="between">
          <Row gap="8" vertical="center" style={{ minWidth: 0 }}>
            <Avatar
              size="xs"
              {...(person.imageUrl ? { src: person.imageUrl } : { value: personInitial(person) })}
            />
            <Text variant="body-default-s" onBackground="neutral-strong" truncate>
              {personLabel(person)}
            </Text>
          </Row>
          <Switch
            isChecked={adminIds.has(person.id)}
            onToggle={() => handleToggle(person.id, !adminIds.has(person.id))}
            loading={busyId === person.id}
            disabled={busyId !== null}
            ariaLabel={`Admin de la sala para ${personLabel(person)}`}
          />
        </Row>
      ))}
    </Column>
  );
}

/* ── Sección: Gestión de tareas ──────────────────────────────────────── */

function TasksSection({
  context,
  viewerId,
  onChanged,
}: {
  context: ChannelContextData;
  viewerId: string;
  onChanged: () => void;
}) {
  return (
    <Column gap="16" fillWidth>
      <Text variant="body-default-s" onBackground="neutral-weak">
        Convierte cualquier mensaje en tarea desde el chat.
      </Text>
      {context.tasks.length === 0 ? (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Sin tareas todavía.
        </Text>
      ) : (
        context.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            viewerId={viewerId}
            onResolved={onChanged}
            variant="row"
          />
        ))
      )}
    </Column>
  );
}

/* ── Sección: Multimedia y archivos ──────────────────────────────────── */

function MediaSection({ messages }: { messages: StreamMessage[] }) {
  const images: string[] = [];
  const links: string[] = [];

  for (const message of messages) {
    const { parts, images: messageImages } = parseMessageBody(message.body);
    images.push(...messageImages);
    for (const part of parts) {
      if (part.url) links.push(part.url);
    }
  }

  if (images.length === 0 && links.length === 0) {
    return (
      <Column fillWidth center gap="12" padding="24">
        <Icon name="gallery" size="l" onBackground="neutral-weak" />
        <Text variant="body-default-s" onBackground="neutral-weak" align="center">
          Sin imágenes ni enlaces compartidos todavía.
        </Text>
      </Column>
    );
  }

  return (
    <Column gap="16" fillWidth>
      {images.length > 0 && (
        <Grid columns={3} gap="8" fillWidth>
          {images.map((url) => (
            <Media
              key={url}
              src={url}
              alt="Imagen compartida"
              aspectRatio="1 / 1"
              radius="m"
              enlarge
            />
          ))}
        </Grid>
      )}
      {links.length > 0 && (
        <Column gap="8" fillWidth>
          {links.map((url) => (
            <SmartLink key={url} href={url} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {url}
            </SmartLink>
          ))}
        </Column>
      )}
    </Column>
  );
}

/* ── Sección: Privacidad y ayuda ─────────────────────────────────────── */

function PrivacySection({
  conversation,
  context,
  projectFreelancers,
  members,
  onAdminsChanged,
  onChannelsChanged,
  onChannelDeleted,
}: {
  conversation: ConversationSummary;
  context: ChannelContextData | null;
  projectFreelancers: ChannelContextParticipant[];
  members: ChannelMemberData[];
  onAdminsChanged: () => void;
  onChannelsChanged: (preferChannelId?: string) => void;
  onChannelDeleted: () => void;
}) {
  const { addToast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(context?.channel.name ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  if (conversation.kind === "direct" || !context) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Esta es una conversación privada 1 a 1. Hub-Nerds no comparte tus mensajes con terceros.
      </Text>
    );
  }

  if (!context.isAdmin) {
    return (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Este canal pertenece al proyecto {context.project.title}. Solo el client administrador
        puede renombrarlo o eliminarlo.
      </Text>
    );
  }

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed.length > 60) return;
    setSaving(true);
    const result = await renameChannel(context.channel.id, trimmed);
    setSaving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Canal renombrado." });
    setRenameOpen(false);
    onChannelsChanged(context.channel.id);
  };

  const handleCreate = async () => {
    const trimmed = createValue.trim();
    if (!trimmed || trimmed.length > 60) return;
    setSaving(true);
    const result = await createChannel(context.project.id, trimmed);
    setSaving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Canal creado." });
    setCreateOpen(false);
    setCreateValue("");
    onChannelsChanged(result.channelId);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    const result = await deleteChannel(context.channel.id);
    setSaving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      setConfirmDelete(false);
      return;
    }
    addToast({ variant: "success", message: "Canal eliminado." });
    onChannelDeleted();
  };

  return (
    <Column gap="12" fillWidth>
      <Column gap="8" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Administradores de la sala
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Los admins pueden editar la imagen, descripción y miembros de la sala, pero no pueden
          eliminarla.
        </Text>
        <RoomAdminsList
          channelId={context.channel.id}
          freelancers={projectFreelancers}
          members={members}
          onChanged={onAdminsChanged}
        />
      </Column>

      <Line background="neutral-alpha-weak" />

      <Button variant="secondary" size="s" prefixIcon="edit" onClick={() => setRenameOpen(true)}>
        Renombrar canal
      </Button>
      <Button variant="secondary" size="s" prefixIcon="plus" onClick={() => setCreateOpen(true)}>
        Crear nueva sala del proyecto
      </Button>
      <Button
        variant={confirmDelete ? "danger" : "secondary"}
        size="s"
        prefixIcon="trash"
        onClick={handleDelete}
        loading={saving && confirmDelete}
      >
        {confirmDelete ? "Confirmar eliminación" : "Eliminar canal"}
      </Button>

      <Modal
        isOpen={renameOpen}
        onClose={() => !saving && setRenameOpen(false)}
        title="Renombrar canal"
        backdrop={modalBackdrop}
      >
        <Column gap="16" fillWidth paddingTop="12">
          <Input
            id="details-rename-channel"
            label="Nombre del canal"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => setRenameOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleRename} loading={saving}>
              Guardar
            </Button>
          </Row>
        </Column>
      </Modal>

      <Modal
        isOpen={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Nueva sala"
        backdrop={modalBackdrop}
      >
        <Column gap="16" fillWidth paddingTop="12">
          <Input
            id="details-create-channel"
            label="Nombre del canal"
            value={createValue}
            onChange={(e) => setCreateValue(e.target.value)}
            placeholder="Ej. Revisión de assets"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleCreate} loading={saving}>
              Crear canal
            </Button>
          </Row>
        </Column>
      </Modal>
    </Column>
  );
}

/* ── Componente principal ─────────────────────────────────────────────── */

export function DetailsPanel({
  conversation,
  viewerId,
  channelContext,
  loadingContext,
  messages,
  mobileView,
  onBack,
  onContextRefresh,
  onChannelsChanged,
  onChannelDeleted,
}: {
  conversation: ConversationSummary;
  viewerId: string;
  channelContext: ChannelContextData | null;
  loadingContext: boolean;
  messages: StreamMessage[];
  mobileView: "list" | "conversation" | "info";
  onBack: () => void;
  onContextRefresh: () => void;
  onChannelsChanged: (preferChannelId?: string) => void;
  onChannelDeleted: () => void;
}) {
  const isGroup = conversation.kind === "group";
  const channelId = isGroup ? (conversation.channelId ?? null) : null;

  // Fetch centralizado de ChannelMember: alimenta tanto "Acceso a la sala"
  // (switches de restricción) como la nueva "Información de la sala"
  // (roster editable + flag de admin propio) sin duplicar getChannelMembers
  // entre ambas secciones (los Accordion de Once UI montan su contenido
  // siempre, aunque estén colapsados — ver gotcha más abajo).
  const [members, setMembers] = useState<ChannelMemberData[]>([]);
  const [restricted, setRestricted] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);

  const refetchMembers = useCallback(async () => {
    if (!channelId) return;
    const result = await getChannelMembers(channelId);
    if (result.ok) {
      setMembers(result.members);
      setRestricted(result.restricted);
    }
  }, [channelId]);

  useEffect(() => {
    if (!channelId) {
      setMembers([]);
      setRestricted(false);
      setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      await refetchMembers();
      if (!cancelled) setMembersLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId, refetchMembers]);

  const viewerIsRoomAdmin = members.find((entry) => entry.userId === viewerId)?.isAdmin ?? false;
  const canManageRoom = Boolean(channelContext?.isAdmin) || viewerIsRoomAdmin;
  const projectFreelancers = channelContext
    ? channelContext.participants.filter((person) =>
        channelContext.freelancerParticipants.includes(person.id),
      )
    : [];

  const profileName = isGroup ? conversation.title : conversation.title;
  const profileMeta = isGroup
    ? (conversation.project?.title ?? conversation.subtitle)
    : conversation.subtitle;

  const infoContent = isGroup ? (
    <Column gap="8" fillWidth>
      <Row gap="8" vertical="center">
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Canal
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          {channelContext?.channel.name ?? conversation.title}
        </Text>
      </Row>
      <Row gap="8" vertical="center">
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Proyecto
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          {conversation.project?.title ?? "—"}
        </Text>
      </Row>
      {channelContext && (
        <Row gap="8" vertical="center">
          <Text variant="label-strong-s" onBackground="neutral-strong">
            Estado
          </Text>
          <Tag size="s" variant="neutral" label={channelContext.project.status} />
        </Row>
      )}
    </Column>
  ) : (
    <Column gap="8" fillWidth>
      <Row gap="8" vertical="center">
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Usuario
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          @{conversation.participant?.username ?? "usuario"}
        </Text>
      </Row>
      {conversation.participant?.headline && (
        <Text variant="body-default-s" onBackground="neutral-weak">
          {conversation.participant.headline}
        </Text>
      )}
    </Column>
  );

  const items = [
    {
      title: isGroup ? "Información de la sala" : "Información del chat",
      content: (
        <Column gap="20" fillWidth>
          {infoContent}
          {isGroup && (
            <>
              <Line background="neutral-alpha-weak" />
              {!channelContext || !channelId || membersLoading ? (
                <Text variant="label-default-s" onBackground="neutral-weak">
                  Cargando...
                </Text>
              ) : (
                <RoomInfoSection
                  channelId={channelId}
                  channel={channelContext.channel}
                  viewerId={viewerId}
                  canManage={canManageRoom}
                  isRoomAdmin={viewerIsRoomAdmin}
                  projectFreelancers={projectFreelancers}
                  members={members}
                  restricted={restricted}
                  onChannelUpdated={() => {
                    onContextRefresh();
                    refetchMembers();
                  }}
                  onSelfDemoted={refetchMembers}
                />
              )}
            </>
          )}
        </Column>
      ),
    },
    ...(isGroup
      ? [
          {
            title: "Acceso a la sala",
            content:
              !channelContext || !conversation.channelId ? (
                <Text variant="label-default-s" onBackground="neutral-weak">
                  {loadingContext ? "Cargando..." : "Sin datos."}
                </Text>
              ) : (
                <AccessSection
                  channelId={conversation.channelId}
                  freelancers={projectFreelancers}
                  canManage={canManageRoom}
                  members={members}
                  restricted={restricted}
                  loading={membersLoading}
                  onChanged={refetchMembers}
                />
              ),
          },
          {
            title: "Gestión de tareas",
            content: !channelContext ? (
              <Text variant="label-default-s" onBackground="neutral-weak">
                {loadingContext ? "Cargando..." : "Sin datos."}
              </Text>
            ) : (
              <TasksSection
                context={channelContext}
                viewerId={viewerId}
                onChanged={onContextRefresh}
              />
            ),
          },
        ]
      : []),
    { title: "Multimedia y archivos", content: <MediaSection messages={messages} /> },
    {
      title: "Privacidad y ayuda",
      content: (
        <PrivacySection
          conversation={conversation}
          context={channelContext}
          projectFreelancers={projectFreelancers}
          members={members}
          onAdminsChanged={refetchMembers}
          onChannelsChanged={onChannelsChanged}
          onChannelDeleted={onChannelDeleted}
        />
      ),
    },
  ];

  return (
    <Column
      fillHeight
      gap="16"
      padding="16"
      overflowY="auto"
      background="surface"
      border="neutral-alpha-weak"
      radius="l"
      style={{ width: 320, minWidth: 0, flexShrink: 0 }}
      s={
        mobileView !== "info"
          ? { hide: true }
          : { style: { width: "auto", flexGrow: 1, flexShrink: 1 } }
      }
      xs={
        mobileView !== "info"
          ? { hide: true }
          : { style: { width: "auto", flexGrow: 1, flexShrink: 1 } }
      }
    >
      <Row fillWidth gap="8" vertical="center" paddingBottom="16" borderBottom="neutral-alpha-weak">
        <Row hide s={{ hide: false }} xs={{ hide: false }}>
          <IconButton
            icon="chevronLeft"
            size="s"
            variant="tertiary"
            tooltip="Volver a la conversación"
            onClick={onBack}
          />
        </Row>
        <Heading variant="heading-strong-s">Detalles</Heading>
      </Row>

      <Column fillWidth gap="12" horizontal="center">
        <Avatar
          size="xl"
          {...(conversation.avatarUrl
            ? { src: conversation.avatarUrl }
            : isGroup
              ? { icon: "userGroup" as const }
              : { value: personInitial({ name: profileName, username: null }) })}
        />
        <Column gap="2" horizontal="center">
          <Text variant="heading-strong-s" onBackground="neutral-strong" align="center">
            {profileName}
          </Text>
          {profileMeta && (
            <Text variant="label-default-s" onBackground="neutral-weak" align="center">
              {profileMeta}
            </Text>
          )}
        </Column>

        <Row gap="8">
          {isGroup && conversation.project ? (
            <IconButton
              icon="briefcase"
              size="s"
              variant="secondary"
              tooltip="Ir al proyecto"
              href={`/proyectos/${conversation.project.id}`}
            />
          ) : (
            conversation.participant?.username && (
              <IconButton
                icon="person"
                size="s"
                variant="secondary"
                tooltip="Ver perfil"
                href={`/${conversation.participant.username}`}
              />
            )
          )}
        </Row>
      </Column>

      {/* GOTCHA: no usar AccordionGroup con autoCollapse={false} — el group
          SIEMPRE pasa onToggle a cada Accordion (ver AccordionGroup.js), y
          Accordion en cuanto recibe onToggle se vuelve controlado
          (isAccordionOpen = onToggle ? open : isOpen); con autoCollapse=false
          el group pasa open=undefined y su handleAccordionToggle no hace
          nada, así que los acordeones nunca abren. Se apilan Accordions
          sueltos (sin open/onToggle) en modo no-controlado: cada uno abre y
          cierra de forma independiente y pueden quedar varios abiertos. */}
      <Column fillWidth radius="m" border="neutral-alpha-medium" overflow="hidden">
        {items.map((item, index) => (
          <Fragment key={item.title}>
            <Accordion title={item.title}>{item.content}</Accordion>
            {index < items.length - 1 && <Line background="neutral-alpha-medium" />}
          </Fragment>
        ))}
      </Column>
    </Column>
  );
}

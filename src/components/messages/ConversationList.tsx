"use client";

import {
  Avatar,
  Button,
  Column,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Row,
  SegmentedControl,
  Tag,
  Text,
  useToast,
} from "@once-ui-system/core";
import { useEffect, useMemo, useState } from "react";
import { createChannel } from "@/app/actions/channels";
import { addProjectLink, deleteProjectLink, updateProjectLogo } from "@/app/actions/collab";
import {
  type ChannelContextData,
  type ConversationSummary,
  getChannelContext,
} from "@/app/actions/inbox";
import { setPresenceStatus } from "@/app/actions/presence";
import { ProjectLogoControl } from "@/components/collab/ProjectLogoControl";
import { RolesSection } from "./DetailsPanel";
import { formatShortTime, presenceColor, presenceOf, type RailScope } from "./messengerUtils";

/* ══ Panel izquierdo: bandeja de conversaciones (2.1) ═══════════════════ */

type SegmentFilter = "all" | "unread" | "projects";

const BASE_SEGMENTS = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "No leídos" },
];
const DIRECT_SEGMENTS = [...BASE_SEGMENTS, { value: "projects", label: "Proyectos" }];

/* ══ Overlay de ajustes (engrane del panel) ══════════════════════════════
   Cubre el panel de lista (Column position="absolute" — Once UI ya pone
   position:relative por defecto en el Column padre, así que no hace falta
   declararlo). En modo proyecto administra la sala/roles/logo/recursos del
   proyecto en scope; en modo directos solo expone el estado de presencia
   propio (no hay ajustes de "usuario ajeno"). ══════════════════════════ */

function ProjectSettingsPanel({
  projectId,
  channelId,
  onLogoChanged,
  onChannelCreated,
}: {
  projectId: string;
  channelId: string;
  onLogoChanged: () => void;
  onChannelCreated: (channelId: string) => void;
}) {
  const { addToast } = useToast();
  const [context, setContext] = useState<ChannelContextData | null>(null);
  const [loading, setLoading] = useState(true);

  const [roomName, setRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [busyLinkId, setBusyLinkId] = useState<string | null>(null);

  const refetchContext = async () => {
    const result = await getChannelContext(channelId);
    if (result.ok) setContext(result);
    else addToast({ variant: "danger", message: result.error });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetchContext se recrea cada render; solo debe correr al cambiar de sala.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await refetchContext();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const handleCreateRoom = async () => {
    const trimmed = roomName.trim();
    if (!trimmed) return;
    setCreatingRoom(true);
    const result = await createChannel(projectId, trimmed);
    setCreatingRoom(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Sala creada." });
    setRoomName("");
    onChannelCreated(result.channelId);
  };

  const handleAddLink = async () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    setAddingLink(true);
    const result = await addProjectLink(projectId, linkLabel, linkUrl);
    setAddingLink(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    setLinkLabel("");
    setLinkUrl("");
    await refetchContext();
  };

  const handleDeleteLink = async (linkId: string) => {
    setBusyLinkId(linkId);
    const result = await deleteProjectLink(linkId);
    setBusyLinkId(null);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    await refetchContext();
  };

  if (loading || !context) {
    return (
      <Text variant="label-default-s" onBackground="neutral-weak">
        Cargando...
      </Text>
    );
  }

  return (
    <Column gap="24" fillWidth>
      <Column gap="8" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Imagen del proyecto
        </Text>
        <ProjectLogoControl
          logoUrl={context.project.logoUrl}
          title={context.project.title}
          canEdit
          size="l"
          onUpload={(dataUrl) => updateProjectLogo(projectId, dataUrl)}
          onSaved={() => {
            refetchContext();
            onLogoChanged();
          }}
        />
      </Column>

      <Line background="neutral-alpha-weak" />

      {context.isAdmin && (
        <>
          <Column gap="8" fillWidth>
            <Text variant="label-strong-s" onBackground="neutral-strong">
              Crear sala
            </Text>
            <Row gap="8" fillWidth>
              <Input
                id="settings-create-room"
                placeholder="Ej. Revisión de assets"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              />
              <Button
                variant="secondary"
                size="m"
                onClick={handleCreateRoom}
                loading={creatingRoom}
                disabled={!roomName.trim()}
              >
                Crear
              </Button>
            </Row>
          </Column>
          <Line background="neutral-alpha-weak" />
        </>
      )}

      <Column gap="12" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Asignar roles
        </Text>
        <RolesSection context={context} onChanged={refetchContext} />
      </Column>

      <Line background="neutral-alpha-weak" />

      <Column gap="12" fillWidth>
        <Text variant="label-strong-s" onBackground="neutral-strong">
          Conectar recursos
        </Text>
        {context.links.length === 0 ? (
          <Text variant="body-default-s" onBackground="neutral-weak">
            Sin recursos conectados todavía.
          </Text>
        ) : (
          context.links.map((link) => (
            <Row key={link.id} fillWidth gap="8" vertical="center" horizontal="between">
              <Column gap="0" style={{ minWidth: 0, flex: 1 }}>
                <Text variant="label-default-s" onBackground="neutral-strong" truncate>
                  {link.label}
                </Text>
                <Text
                  variant="body-default-s"
                  onBackground="neutral-weak"
                  truncate
                  style={{ minWidth: 0, overflowWrap: "anywhere" }}
                >
                  {link.url}
                </Text>
              </Column>
              <IconButton
                icon="trash"
                size="s"
                variant="tertiary"
                tooltip="Quitar recurso"
                loading={busyLinkId === link.id}
                disabled={busyLinkId !== null}
                onClick={() => handleDeleteLink(link.id)}
              />
            </Row>
          ))
        )}
        <Row gap="8" fillWidth wrap>
          <Input
            id="settings-link-label"
            placeholder="Etiqueta"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            style={{ flex: 1, minWidth: 120 }}
          />
          <Input
            id="settings-link-url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            style={{ flex: 2, minWidth: 160 }}
          />
          <Button
            variant="secondary"
            size="m"
            prefixIcon="plus"
            onClick={handleAddLink}
            loading={addingLink}
            disabled={!linkLabel.trim() || !linkUrl.trim()}
          >
            Agregar
          </Button>
        </Row>
      </Column>
    </Column>
  );
}

function UserSettingsPanel() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<"auto" | "busy">("auto");
  const [saving, setSaving] = useState(false);

  const handleToggle = async (next: "auto" | "busy") => {
    if (saving || next === status) return;
    setSaving(true);
    const result = await setPresenceStatus(next);
    setSaving(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    setStatus(next);
  };

  return (
    <Column gap="12" fillWidth>
      <Text variant="label-strong-s" onBackground="neutral-strong">
        Tu estado de presencia
      </Text>
      <Text variant="body-default-s" onBackground="neutral-weak">
        Automático te muestra en línea mientras tengas /mensajes abierto. Ocupado avisa a los demás
        que estás disponible pero prefieres no ser interrumpido.
      </Text>
      <SegmentedControl
        buttons={[
          { value: "auto", label: "Automático" },
          { value: "busy", label: "Ocupado" },
        ]}
        value={status}
        onChange={(value) => handleToggle(value as "auto" | "busy")}
      />
    </Column>
  );
}

function SettingsOverlay({
  scope,
  scopeProjectChannelId,
  onClose,
  onProjectSettingsChanged,
  onProjectLogoChanged,
}: {
  scope: RailScope;
  scopeProjectChannelId: string | null;
  onClose: () => void;
  onProjectSettingsChanged: (preferChannelId?: string) => void;
  onProjectLogoChanged: () => void;
}) {
  return (
    <Column
      position="absolute"
      top="0"
      left="0"
      fill
      // GOTCHA: el theme del sitio usa surface="translucent" (once-ui.config.ts),
      // así que background="surface" es semitransparente (--surface-background
      // resuelve a static-white/black-medium con alpha) — apilar dos paneles
      // "surface" (este overlay sobre el panel de lista, ambos translúcidos)
      // dejaba ver el contenido de atrás mezclado. "page" resuelve a un color
      // neutro sólido (--neutral-background-weak, sin alpha): opaco de verdad.
      background="page"
      zIndex={2}
      overflowY="auto"
      padding="16"
      gap="16"
      style={{ minWidth: 0 }}
    >
      <Row fillWidth gap="8" vertical="center" paddingBottom="16" borderBottom="neutral-alpha-weak">
        <IconButton
          icon="chevronLeft"
          size="s"
          variant="tertiary"
          tooltip="Volver"
          onClick={onClose}
        />
        <Heading variant="heading-strong-s">
          {scope.type === "project" ? "Ajustes del proyecto" : "Ajustes"}
        </Heading>
      </Row>

      {scope.type === "project" && scopeProjectChannelId ? (
        <ProjectSettingsPanel
          projectId={scope.id}
          channelId={scopeProjectChannelId}
          onLogoChanged={onProjectLogoChanged}
          onChannelCreated={(channelId) => onProjectSettingsChanged(channelId)}
        />
      ) : scope.type === "project" ? (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Este proyecto todavía no tiene salas.
        </Text>
      ) : (
        <UserSettingsPanel />
      )}
    </Column>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const preview = conversation.lastMessage?.body ?? "Aún no hay mensajes";
  const time = conversation.lastMessage ? formatShortTime(conversation.lastMessage.createdAt) : "";

  return (
    <Row
      fillWidth
      gap="12"
      vertical="center"
      padding="12"
      radius="m"
      cursor="interactive"
      background={active ? "neutral-alpha-weak" : "transparent"}
      onClick={onSelect}
      style={{ minWidth: 0 }}
    >
      <Avatar
        size="m"
        {...(conversation.avatarUrl
          ? { src: conversation.avatarUrl }
          : conversation.kind === "group"
            ? { icon: "userGroup" as const }
            : { value: (conversation.title[0] ?? "U").toUpperCase() })}
        {...(conversation.kind === "direct" && conversation.participant
          ? { statusIndicator: { color: presenceColor(presenceOf(conversation.participant)) } }
          : {})}
      />
      <Column gap="4" style={{ minWidth: 0, flex: 1 }}>
        <Row fillWidth gap="8" horizontal="between" vertical="center">
          <Text
            variant="label-default-s"
            onBackground="neutral-strong"
            truncate
            style={{ minWidth: 0 }}
          >
            {conversation.title}
          </Text>
          {time && (
            <Text variant="label-default-s" onBackground="neutral-weak">
              {time}
            </Text>
          )}
        </Row>
        <Row fillWidth gap="8" horizontal="between" vertical="center">
          <Text
            variant="body-default-s"
            onBackground="neutral-medium"
            truncate
            style={{ minWidth: 0 }}
          >
            {conversation.subtitle ? `${conversation.subtitle} · ${preview}` : preview}
          </Text>
          {conversation.unreadCount > 0 && (
            <Tag size="s" scheme="brand" label={String(conversation.unreadCount)} />
          )}
        </Row>
      </Column>
    </Row>
  );
}

export function ConversationList({
  conversations,
  scope,
  scopeHeader,
  scopeProjectChannelId,
  loading,
  selectedKey,
  onSelect,
  onCreated,
  onProjectSettingsChanged,
  onProjectLogoChanged,
}: {
  conversations: ConversationSummary[];
  scope: RailScope;
  scopeHeader: { title: string; avatarUrl: string | null };
  scopeProjectChannelId: string | null;
  loading: boolean;
  selectedKey: string | null;
  onSelect: (conversation: ConversationSummary) => void;
  onCreated: (threadId: string) => void;
  onProjectSettingsChanged: (preferChannelId?: string) => void;
  onProjectLogoChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SegmentFilter>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // "Proyectos" solo existe en modo directos: si se cambia de scope con ese
  // filtro activo, se resetea para no dejar la lista vacía en modo proyecto.
  useEffect(() => {
    if (scope.type === "project" && filter === "projects") setFilter("all");
  }, [scope.type, filter]);

  const segments = scope.type === "direct" ? DIRECT_SEGMENTS : BASE_SEGMENTS;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unreadCount <= 0) return false;
      if (filter === "projects" && !conversation.sharesProject) return false;
      if (query) {
        const haystack = `${conversation.title} ${conversation.subtitle ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [conversations, search, filter]);

  return (
    <Column fillHeight fillWidth gap="12" padding="16" style={{ minWidth: 0 }}>
      <Row
        fillWidth
        horizontal="between"
        vertical="center"
        paddingBottom="16"
        borderBottom="neutral-alpha-weak"
      >
        <Row gap="8" vertical="center" style={{ minWidth: 0 }}>
          <Avatar
            size="s"
            {...(scopeHeader.avatarUrl
              ? { src: scopeHeader.avatarUrl }
              : scope.type === "direct"
                ? { icon: "email" as const }
                : { value: scopeHeader.title.charAt(0).toUpperCase() })}
          />
          <Heading variant="heading-strong-s" truncate style={{ minWidth: 0 }}>
            {scopeHeader.title}
          </Heading>
        </Row>
        <Row gap="4">
          <IconButton
            icon="settings"
            size="s"
            variant="tertiary"
            tooltip="Ajustes"
            tooltipPosition="bottom"
            onClick={() => setSettingsOpen(true)}
          />
        </Row>
      </Row>

      <Input
        id="conversation-search"
        placeholder="Buscar conversaciones..."
        prefix={<Icon name="search" size="xs" onBackground="neutral-weak" />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <SegmentedControl
        buttons={segments}
        value={filter}
        onChange={(value) => setFilter(value as SegmentFilter)}
      />

      <Column gap="4" overflowY="auto" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {!loading && filtered.length === 0 ? (
          <Column fillWidth center gap="12" padding="24">
            <Icon name="email" size="l" onBackground="neutral-weak" />
            <Text variant="body-default-s" onBackground="neutral-weak" align="center">
              {conversations.length === 0
                ? "Aún no tienes conversaciones. Usa el botón + del riel para iniciar una."
                : "Ninguna conversación coincide con el filtro."}
            </Text>
          </Column>
        ) : (
          filtered.map((conversation) => (
            <ConversationRow
              key={conversation.key}
              conversation={conversation}
              active={conversation.key === selectedKey}
              onSelect={() => onSelect(conversation)}
            />
          ))
        )}
      </Column>

      {settingsOpen && (
        <SettingsOverlay
          scope={scope}
          scopeProjectChannelId={scopeProjectChannelId}
          onClose={() => setSettingsOpen(false)}
          onProjectSettingsChanged={onProjectSettingsChanged}
          onProjectLogoChanged={onProjectLogoChanged}
        />
      )}
    </Column>
  );
}

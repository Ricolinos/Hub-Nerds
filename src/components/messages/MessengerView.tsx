"use client";

import { Column, Row, useLayout, useToast } from "@once-ui-system/core";
import { useEffect, useRef, useState } from "react";
import {
  type ChannelMessageData,
  getChannelMessages,
  sendChannelMessage,
} from "@/app/actions/channels";
import {
  type DirectMessageData,
  getDirectMessages,
  markDirectThreadRead,
  sendDirectMessage,
} from "@/app/actions/directMessages";
import {
  type ChannelContextData,
  type ConversationSummary,
  getChannelContext,
  getInbox,
} from "@/app/actions/inbox";
import { presenceHeartbeat } from "@/app/actions/presence";
import { ConversationList } from "./ConversationList";
import { ConversationPanel } from "./ConversationPanel";
import { DetailsPanel } from "./DetailsPanel";
import {
  fromChannelMessage,
  fromDirectMessage,
  type RailScope,
  type StreamMessage,
} from "./messengerUtils";
import { ProjectRail, type RailProject, type RailUser } from "./ProjectRail";

/* ══ Vista maestra de /mensajes: layout Messenger de 3 paneles ══════════
   (chat-messenger-refactor.md 2.1/2.2/2.3). Orquesta la bandeja unificada
   (getInbox), el stream de la conversación activa (directMessages o
   channels según ConversationSummary.kind) y el contexto de proyecto del
   panel derecho (getChannelContext), con polling client-side de 4s. ═════ */

const POLL_INTERVAL_MS = 4000;

type MobileView = "list" | "conversation" | "info";

export function MessengerView({
  viewerId,
  initialProjectId,
  initialChannelId,
}: {
  viewerId: string;
  initialProjectId?: string;
  // Preselecciona una sala en particular (accesos directos desde el gestor
  // de proyectos, punto 3): tiene prioridad sobre initialProjectId si ambos
  // llegan y el canal existe.
  initialChannelId?: string;
}) {
  const { addToast } = useToast();
  const { currentBreakpoint } = useLayout();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [channelContext, setChannelContext] = useState<ChannelContextData | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const [infoOpen, setInfoOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [scope, setScope] = useState<RailScope>({ type: "direct" });

  const initApplied = useRef(false);

  // Se lee el breakpoint vía ref (en vez de capturarlo directo en el efecto de
  // montaje) para evitar el closure stale: el efecto de abajo corre una sola
  // vez al montar y para entonces useLayout aún puede reportar el breakpoint
  // por defecto ("l") mientras se mide el viewport real.
  const isMobileRef = useRef(currentBreakpoint === "s" || currentBreakpoint === "xs");
  useEffect(() => {
    isMobileRef.current = currentBreakpoint === "s" || currentBreakpoint === "xs";
  }, [currentBreakpoint]);

  const selectedConversation = conversations.find((c) => c.key === selectedKey) ?? null;

  const projects: RailProject[] = [];
  const seenProjects = new Set<string>();
  const users: RailUser[] = [];
  const seenUsers = new Set<string>();
  for (const conversation of conversations) {
    if (
      conversation.kind === "group" &&
      conversation.project &&
      !seenProjects.has(conversation.project.id)
    ) {
      seenProjects.add(conversation.project.id);
      projects.push({
        id: conversation.project.id,
        title: conversation.project.title,
        logoUrl: conversation.project.logoUrl,
      });
    }
    if (
      conversation.kind === "direct" &&
      conversation.participant &&
      !seenUsers.has(conversation.participant.id)
    ) {
      seenUsers.add(conversation.participant.id);
      users.push({
        id: conversation.participant.id,
        name: conversation.title,
        avatarUrl: conversation.avatarUrl,
        lastSeenAt: conversation.participant.lastSeenAt,
        presenceStatus: conversation.participant.presenceStatus,
      });
    }
  }
  const scopedConversations = conversations.filter((c) =>
    scope.type === "direct"
      ? c.kind === "direct"
      : c.kind === "group" && c.project?.id === scope.id,
  );
  const scopeProject = scope.type === "project" ? projects.find((p) => p.id === scope.id) : null;
  const scopeHeader = scopeProject
    ? { title: scopeProject.title, avatarUrl: scopeProject.logoUrl }
    : { title: "Directos", avatarUrl: null as string | null };
  // Cualquier canal accesible del proyecto en scope: el overlay de ajustes
  // (crear sala/roles/logo/recursos) opera a nivel proyecto y necesita un
  // channelId para reutilizar getChannelContext; no importa cuál mientras
  // pertenezca al proyecto seleccionado.
  const scopeProjectChannelId =
    scope.type === "project"
      ? (conversations.find((c) => c.kind === "group" && c.project?.id === scope.id)?.channelId ??
        null)
      : null;

  /* ── Presencia: heartbeat mientras /mensajes está montado ────────────── */

  useEffect(() => {
    presenceHeartbeat();
    const interval = setInterval(() => {
      presenceHeartbeat();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  /* ── Bandeja: polling de getInbox + deep link ?project= ─────────────── */

  const refetchInbox = async (): Promise<ConversationSummary[]> => {
    const result = await getInbox();
    if (result.ok) {
      setConversations(result.conversations);
      return result.conversations;
    }
    return [];
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await getInbox();
      if (cancelled) return;
      if (result.ok) {
        setConversations(result.conversations);
        if (!initApplied.current) {
          initApplied.current = true;
          // ?channel= (acceso directo desde el gestor de proyectos) tiene
          // prioridad sobre ?project= si ambos llegan y el canal existe.
          const channelTarget = initialChannelId
            ? result.conversations.find(
                (c) => c.kind === "group" && c.channelId === initialChannelId,
              )
            : undefined;
          const target =
            channelTarget ??
            (initialProjectId
              ? result.conversations.find(
                  (c) => c.kind === "group" && c.project?.id === initialProjectId,
                )
              : undefined);
          if (target) {
            setSelectedKey(target.key);
            setMobileView("conversation");
            setScope({ type: "project", id: target.project!.id });
          } else {
            const hasDirect = result.conversations.some((c) => c.kind === "direct");
            const firstProject = result.conversations.find(
              (c) => c.kind === "group" && c.project,
            )?.project;
            const resolvedScope: RailScope | null = hasDirect
              ? { type: "direct" }
              : firstProject
                ? { type: "project", id: firstProject.id }
                : null;
            if (resolvedScope) setScope(resolvedScope);

            // Auto-selección solo en desktop: en móvil debe quedarse en la
            // lista (mobileView="list") aunque haya conversaciones.
            if (resolvedScope && !isMobileRef.current) {
              const firstConversation = result.conversations.find((c) =>
                resolvedScope.type === "direct"
                  ? c.kind === "direct"
                  : c.kind === "group" && c.project?.id === resolvedScope.id,
              );
              if (firstConversation) {
                setSelectedKey(firstConversation.key);
                setMobileView("conversation");
              }
            }
          }
        }
      }
      setLoadingConversations(false);
    })();

    const interval = setInterval(async () => {
      const result = await getInbox();
      if (!cancelled && result.ok) setConversations(result.conversations);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, initialChannelId]);

  /* ── Conversación activa: stream de mensajes con polling ─────────────── */

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    const refetch = async () => {
      if (selectedConversation.kind === "direct" && selectedConversation.threadId) {
        const result = await getDirectMessages(selectedConversation.threadId);
        if (!cancelled && result.ok) {
          setMessages(result.messages.map(fromDirectMessage));
        } else if (!cancelled && !result.ok) {
          addToast({ variant: "danger", message: result.error });
        }
      } else if (selectedConversation.kind === "group" && selectedConversation.channelId) {
        const result = await getChannelMessages(selectedConversation.channelId);
        if (!cancelled && result.ok) {
          setMessages(result.messages.map(fromChannelMessage));
        } else if (!cancelled && !result.ok) {
          addToast({ variant: "danger", message: result.error });
        }
      }
    };

    (async () => {
      await refetch();
      if (cancelled) return;
      setLoadingMessages(false);
      if (selectedConversation.kind === "direct" && selectedConversation.threadId) {
        const readResult = await markDirectThreadRead(selectedConversation.threadId);
        if (!cancelled && readResult.ok) refetchInbox();
      }
    })();

    const interval = setInterval(refetch, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.key]);

  /* ── Contexto de canal (panel derecho, solo grupos) ───────────────────── */

  const refetchContext = async (channelId: string) => {
    const result = await getChannelContext(channelId);
    if (result.ok) setChannelContext(result);
    else addToast({ variant: "danger", message: result.error });
  };

  useEffect(() => {
    if (
      !selectedConversation ||
      selectedConversation.kind !== "group" ||
      !selectedConversation.channelId
    ) {
      setChannelContext(null);
      return;
    }
    let cancelled = false;
    setLoadingContext(true);
    (async () => {
      await refetchContext(selectedConversation.channelId!);
      if (!cancelled) setLoadingContext(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.key]);

  /* ── Handlers ──────────────────────────────────────────────────────────── */

  const handleSelect = (conversation: ConversationSummary) => {
    setSelectedKey(conversation.key);
    setMobileView("conversation");
  };

  const handleBackToList = () => {
    setSelectedKey(null);
    setMobileView("list");
  };

  const handleScopeSelect = (next: RailScope) => {
    setScope(next);
    setSelectedKey(null);
    setMobileView("list");
  };

  // Click en un avatar de la sección Usuarios del riel: cambia a modo
  // directos Y abre de una vez ese hilo si ya existe (si el usuario nunca
  // ha escrito, solo cambia el scope y queda visible en la lista filtrada).
  const handleSelectUser = (userId: string) => {
    setScope({ type: "direct" });
    const target = conversations.find((c) => c.kind === "direct" && c.participant?.id === userId);
    if (target) {
      setSelectedKey(target.key);
      setMobileView("conversation");
    } else {
      setSelectedKey(null);
      setMobileView("list");
    }
  };

  // Semánticas distintas por breakpoint: en desktop el (i) conmuta la tercera
  // columna (infoOpen); en móvil NAVEGA a la vista de info (y el botón volver
  // de DetailsPanel regresa a la conversación). Acoplar ambos en un solo
  // toggle hacía que el primer tap móvil solo apagara infoOpen (desmontando
  // el panel) y se necesitaran dos taps para abrirlo.
  const handleToggleInfo = () => {
    if (isMobileRef.current) {
      setInfoOpen(true);
      setMobileView((prev) => (prev === "info" ? "conversation" : "info"));
    } else {
      setInfoOpen((prev) => !prev);
    }
  };

  const handleBackFromInfo = () => {
    setMobileView("conversation");
  };

  const handleSend = async (body: string) => {
    if (!selectedConversation || sending) return;
    setSending(true);
    const result =
      selectedConversation.kind === "direct" && selectedConversation.threadId
        ? await sendDirectMessage(selectedConversation.threadId, body)
        : selectedConversation.kind === "group" && selectedConversation.channelId
          ? await sendChannelMessage(selectedConversation.channelId, body)
          : { ok: false as const, error: "Conversación inválida." };
    setSending(false);
    if (!result.ok) {
      addToast({ variant: "danger", message: result.error });
      return;
    }
    if (selectedConversation.kind === "direct" && selectedConversation.threadId) {
      const refreshed = await getDirectMessages(selectedConversation.threadId);
      if (refreshed.ok) setMessages(refreshed.messages.map(fromDirectMessage));
    } else if (selectedConversation.kind === "group" && selectedConversation.channelId) {
      const refreshed = await getChannelMessages(selectedConversation.channelId);
      if (refreshed.ok) setMessages(refreshed.messages.map(fromChannelMessage));
    }
    refetchInbox();
  };

  const handleConversationCreated = async (threadId: string) => {
    const list = await refetchInbox();
    const target = list.find((c) => c.threadId === threadId);
    if (target) {
      setSelectedKey(target.key);
      setMobileView("conversation");
    }
  };

  const handleTaskChanged = async () => {
    if (selectedConversation?.kind === "group" && selectedConversation.channelId) {
      const result = await getChannelMessages(selectedConversation.channelId);
      if (result.ok) setMessages(result.messages.map(fromChannelMessage));
      await refetchContext(selectedConversation.channelId);
    }
  };

  const handleContextRefresh = async () => {
    if (selectedConversation?.kind === "group" && selectedConversation.channelId) {
      await refetchContext(selectedConversation.channelId);
    }
  };

  const handleChannelsChanged = async (preferChannelId?: string) => {
    const list = await refetchInbox();
    if (preferChannelId) {
      const target = list.find((c) => c.channelId === preferChannelId);
      if (target) setSelectedKey(target.key);
      await refetchContext(preferChannelId);
    }
  };

  const handleChannelDeleted = async () => {
    setSelectedKey(null);
    setMobileView("list");
    setChannelContext(null);
    await refetchInbox();
  };

  const freelancerParticipants = channelContext
    ? channelContext.participants.filter((person) =>
        channelContext.freelancerParticipants.includes(person.id),
      )
    : [];
  const assets = channelContext?.assets ?? [];

  return (
    <Row fillWidth fillHeight gap="8" padding="8" style={{ minWidth: 0 }}>
      <ProjectRail
        users={users}
        projects={projects}
        scope={scope}
        selectedUserId={
          selectedConversation?.kind === "direct"
            ? (selectedConversation.participant?.id ?? null)
            : null
        }
        onSelectScope={handleScopeSelect}
        onSelectUser={handleSelectUser}
        onConversationCreated={handleConversationCreated}
        mobileView={mobileView}
      />

      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        overflow="hidden"
        style={{ width: 320, minWidth: 0, flexShrink: 0 }}
        s={
          mobileView !== "list"
            ? { hide: true }
            : { style: { width: "auto", flexGrow: 1, flexShrink: 1 } }
        }
        xs={
          mobileView !== "list"
            ? { hide: true }
            : { style: { width: "auto", flexGrow: 1, flexShrink: 1 } }
        }
      >
        <ConversationList
          conversations={scopedConversations}
          scope={scope}
          scopeHeader={scopeHeader}
          scopeProjectChannelId={scopeProjectChannelId}
          loading={loadingConversations}
          selectedKey={selectedKey}
          onSelect={handleSelect}
          onCreated={handleConversationCreated}
          onProjectSettingsChanged={handleChannelsChanged}
          onProjectLogoChanged={() => refetchInbox()}
        />
      </Column>

      <ConversationPanel
        conversation={selectedConversation}
        viewerId={viewerId}
        messages={messages}
        loadingMessages={loadingMessages}
        sending={sending}
        onSend={handleSend}
        infoOpen={infoOpen}
        onToggleInfo={handleToggleInfo}
        onBack={handleBackToList}
        mobileView={mobileView}
        freelancerParticipants={freelancerParticipants}
        assets={assets}
        onTaskChanged={handleTaskChanged}
      />

      {selectedConversation && infoOpen && (
        <DetailsPanel
          conversation={selectedConversation}
          viewerId={viewerId}
          channelContext={channelContext}
          loadingContext={loadingContext}
          messages={messages}
          mobileView={mobileView}
          onBack={handleBackFromInfo}
          onContextRefresh={handleContextRefresh}
          onChannelsChanged={handleChannelsChanged}
          onChannelDeleted={handleChannelDeleted}
        />
      )}
    </Row>
  );
}

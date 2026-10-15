"use client";

import {
  Avatar,
  Column,
  EmojiPickerDropdown,
  Feedback,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Media,
  Row,
  Skeleton,
  SmartLink,
  Tag,
  Text,
} from "@once-ui-system/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { getChannelMessages, sendChannelMessage } from "@/app/actions/channels";
import {
  getDirectMessages,
  markDirectThreadRead,
  sendDirectMessage,
} from "@/app/actions/directMessages";
import { type ConversationSummary, getInbox } from "@/app/actions/inbox";
import {
  formatShortTime,
  fromChannelMessage,
  fromDirectMessage,
  parseMessageBody,
  personInitial,
  personLabel,
  presenceColor,
  presenceOf,
  type StreamMessage,
} from "./messengerUtils";

/* ══ Mensajes Light ════════════════════════════════════════════════════
   Contenido del panel morph de FloatingChatBubble: bandeja (getInbox) +
   hilo activo (directMessages/channels), en dos subvistas (lista/chat)
   con polling ligero (15s) mientras el panel está montado. El morph y el
   posicionamiento viven en el contenedor; este componente solo resuelve
   datos + presentación minimalista. Reutiliza tipos/acciones de inbox.ts,
   directMessages.ts, channels.ts y los helpers puros de messengerUtils —
   MessageBubble/ConversationPanel no se reutilizan tal cual porque
   arrastran el pipeline de tareas (TaskCard) y el layout de 3 paneles,
   ajenos a esta vista compacta. ════════════════════════════════════════ */

const POLL_INTERVAL_MS = 15000;
const LIST_SKELETON_KEYS = ["row-1", "row-2", "row-3", "row-4"];
const CHAT_SKELETON_KEYS = ["bubble-1", "bubble-2", "bubble-3"];

function ConversationRow({
  conversation,
  onSelect,
}: {
  conversation: ConversationSummary;
  onSelect: () => void;
}) {
  const preview = conversation.lastMessage?.body ?? "Aún no hay mensajes";
  return (
    <Row
      fillWidth
      gap="8"
      vertical="center"
      padding="8"
      radius="m"
      cursor="interactive"
      onClick={onSelect}
      style={{ minWidth: 0 }}
    >
      <Avatar
        size="s"
        {...(conversation.avatarUrl
          ? { src: conversation.avatarUrl }
          : conversation.kind === "group"
            ? { icon: "userGroup" as const }
            : { value: (conversation.title[0] ?? "U").toUpperCase() })}
        {...(conversation.kind === "direct" && conversation.participant
          ? { statusIndicator: { color: presenceColor(presenceOf(conversation.participant)) } }
          : {})}
      />
      <Column gap="2" style={{ minWidth: 0, flex: 1 }}>
        <Text
          variant="label-default-s"
          onBackground="neutral-strong"
          truncate
          style={{ minWidth: 0 }}
        >
          {conversation.title}
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak" truncate style={{ minWidth: 0 }}>
          {preview}
        </Text>
      </Column>
      {conversation.unreadCount > 0 && (
        <Tag size="s" scheme="brand" label={String(conversation.unreadCount)} />
      )}
    </Row>
  );
}

function MiniMessage({
  message,
  own,
  isGroup,
}: {
  message: StreamMessage;
  own: boolean;
  isGroup: boolean;
}) {
  const { parts, images } = parseMessageBody(message.body);
  return (
    <Row fillWidth gap="8" horizontal={own ? "end" : "start"} vertical="end">
      {isGroup && !own && (
        <Avatar
          size="xs"
          {...(message.sender.imageUrl
            ? { src: message.sender.imageUrl }
            : { value: personInitial(message.sender) })}
        />
      )}
      <Column
        gap="2"
        paddingX="8"
        paddingY="8"
        radius="m"
        background={own ? "brand-alpha-weak" : "neutral-alpha-weak"}
        style={{ maxWidth: "78%", minWidth: 0 }}
      >
        {isGroup && !own && (
          <Text variant="label-default-s" onBackground="neutral-weak">
            {personLabel(message.sender)}
          </Text>
        )}
        {parts.some((part) => part.text) && (
          <Text
            variant="body-default-s"
            onBackground="neutral-strong"
            style={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {/* biome-ignore-start lint/suspicious/noArrayIndexKey: parts se reconstruye
                completo a partir de message.body (inmutable) en cada render; sin ids
                propios, el índice es un key estable para este arreglo derivado. */}
            {parts.map((part, index) =>
              part.url ? (
                <SmartLink key={index} href={part.url}>
                  {part.text}
                </SmartLink>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
            {/* biome-ignore-end lint/suspicious/noArrayIndexKey: ver comentario arriba */}
          </Text>
        )}
        {images.map((url) => (
          <Media
            key={url}
            src={url}
            alt="Imagen compartida en el chat"
            radius="s"
            aspectRatio="16 / 9"
            style={{ maxWidth: 180 }}
          />
        ))}
        <Text variant="label-default-s" onBackground="neutral-weak" align={own ? "right" : "left"}>
          {formatShortTime(message.createdAt)}
        </Text>
      </Column>
    </Row>
  );
}

export function LightMessenger({
  viewerId,
  onExpand,
  onClose,
}: {
  viewerId: string;
  onExpand: () => void;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [active, setActive] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Espejo de `active` legible desde el intervalo de polling sin reinscribirlo
  // en cada cambio de conversación activa.
  const activeRef = useRef<ConversationSummary | null>(null);
  activeRef.current = active;

  const loadInbox = useCallback(async () => {
    const result = await getInbox();
    if (result.ok) {
      setConversations(result.conversations);
      setInboxError(null);
    } else {
      setInboxError(result.error);
    }
  }, []);

  const loadMessages = useCallback(async (conversation: ConversationSummary) => {
    if (conversation.kind === "direct" && conversation.threadId) {
      const result = await getDirectMessages(conversation.threadId);
      if (result.ok) {
        setMessages(result.messages.map(fromDirectMessage));
        setMessagesError(null);
      } else {
        setMessagesError(result.error);
      }
      return;
    }
    if (conversation.channelId) {
      const result = await getChannelMessages(conversation.channelId);
      if (result.ok) {
        setMessages(result.messages.map(fromChannelMessage));
        setMessagesError(null);
      } else {
        setMessagesError(result.error);
      }
    }
  }, []);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length dispara el auto-scroll a cada mensaje nuevo aunque el cuerpo del efecto no lo lea directamente.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  // Polling ligero (sin websockets) mientras el panel está montado: refresca
  // la bandeja en la vista lista, o los mensajes del hilo/canal activo en la
  // vista chat.
  useEffect(() => {
    const id = setInterval(() => {
      const current = activeRef.current;
      if (current) loadMessages(current);
      else loadInbox();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadInbox, loadMessages]);

  const handleSelect = async (conversation: ConversationSummary) => {
    setActive(conversation);
    setMessages([]);
    setMessagesError(null);
    setText("");
    setLoadingMessages(true);
    await loadMessages(conversation);
    setLoadingMessages(false);
    if (conversation.kind === "direct" && conversation.threadId) {
      await markDirectThreadRead(conversation.threadId);
      setConversations((prev) =>
        prev
          ? prev.map((item) => (item.key === conversation.key ? { ...item, unreadCount: 0 } : item))
          : prev,
      );
    }
  };

  const handleBack = () => {
    setActive(null);
    setMessages([]);
    setMessagesError(null);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    const conversation = active;
    if (!trimmed || !conversation || sending) return;
    setSending(true);
    // Limpieza optimista: el input ya no se deshabilita durante el envío, así
    // que el usuario puede seguir escribiendo mientras el server action viaja.
    // Si esperáramos al await para vaciar el texto, borraríamos lo que el
    // usuario ya tecleó de más para el siguiente mensaje.
    setText("");
    // Regresamos el foco al input ya desde aquí (no al terminar el envío):
    // cubre tanto el click en el IconButton (que se lleva el foco) como el
    // caso de error más abajo, sin duplicar la llamada en cada rama.
    requestAnimationFrame(() => {
      document.getElementById("light-messenger-composer")?.focus();
    });
    const result =
      conversation.kind === "direct" && conversation.threadId
        ? await sendDirectMessage(conversation.threadId, trimmed)
        : conversation.channelId
          ? await sendChannelMessage(conversation.channelId, trimmed)
          : { ok: false as const, error: "Conversación inválida." };
    setSending(false);
    if (!result.ok) {
      // Restauramos el mensaje fallido solo si el input sigue vacío: si el
      // usuario ya empezó a escribir uno nuevo mientras esperaba, no se lo
      // pisamos con el que falló.
      setText((current) => (current ? current : trimmed));
      setMessagesError(result.error);
      return;
    }
    await loadMessages(conversation);
  };

  return (
    <Column fillWidth fillHeight style={{ minWidth: 0, minHeight: 0 }}>
      <Row
        fillWidth
        gap="8"
        vertical="center"
        horizontal="between"
        padding="12"
        borderBottom="neutral-alpha-weak"
      >
        <Heading variant="heading-strong-s">Mensajes</Heading>
        <Row gap="4">
          <IconButton
            icon="maximize"
            size="s"
            variant="tertiary"
            tooltip="Abrir completo"
            tooltipPosition="bottom"
            onClick={onExpand}
          />
          <IconButton
            icon="minus"
            size="s"
            variant="tertiary"
            tooltip="Minimizar"
            tooltipPosition="bottom"
            aria-label="Minimizar"
            onClick={onClose}
          />
        </Row>
      </Row>

      {!active ? (
        <Column gap="4" padding="8" overflowY="auto" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          {conversations === null ? (
            LIST_SKELETON_KEYS.map((key) => (
              <Row key={key} fillWidth gap="8" vertical="center" padding="8">
                <Skeleton shape="circle" size="s" />
                <Column gap="4" fillWidth>
                  <Skeleton shape="line" width="50%" size="xs" />
                  <Skeleton shape="line" width="75%" size="xs" />
                </Column>
              </Row>
            ))
          ) : inboxError ? (
            <Feedback variant="danger" description={inboxError} fillWidth />
          ) : conversations.length === 0 ? (
            <Column fillWidth center gap="8" padding="24">
              <Icon name="email" onBackground="neutral-weak" />
              <Text variant="body-default-s" onBackground="neutral-weak" align="center">
                Sin conversaciones todavía.
              </Text>
            </Column>
          ) : (
            conversations.map((conversation) => (
              <ConversationRow
                key={conversation.key}
                conversation={conversation}
                onSelect={() => handleSelect(conversation)}
              />
            ))
          )}
        </Column>
      ) : (
        <>
          <Row fillWidth gap="8" vertical="center" padding="12" borderBottom="neutral-alpha-weak">
            <IconButton
              icon="chevronLeft"
              size="s"
              variant="tertiary"
              tooltip="Volver a la lista"
              onClick={handleBack}
            />
            <Avatar
              size="s"
              {...(active.avatarUrl
                ? { src: active.avatarUrl }
                : active.kind === "group"
                  ? { icon: "userGroup" as const }
                  : { value: personInitial({ name: active.title, username: null }) })}
              {...(active.kind === "direct" && active.participant
                ? { statusIndicator: { color: presenceColor(presenceOf(active.participant)) } }
                : {})}
            />
            <Text
              variant="label-default-s"
              onBackground="neutral-strong"
              truncate
              style={{ minWidth: 0 }}
            >
              {active.kind === "group" && active.project
                ? `${active.title} — ${active.project.title}`
                : active.title}
            </Text>
          </Row>

          <Column
            ref={scrollRef}
            gap="8"
            padding="12"
            overflowY="auto"
            style={{ flex: 1, minWidth: 0, minHeight: 0 }}
          >
            {loadingMessages ? (
              CHAT_SKELETON_KEYS.map((key, index) => (
                <Row key={key} fillWidth horizontal={index % 2 === 1 ? "end" : "start"}>
                  <Skeleton
                    shape="block"
                    style={{ width: index === 1 ? "50%" : "75%", height: "48px" }}
                  />
                </Row>
              ))
            ) : messagesError ? (
              <Feedback variant="danger" description={messagesError} fillWidth />
            ) : messages.length === 0 ? (
              <Column fillWidth fillHeight center gap="8" padding="24">
                <Text variant="body-default-s" onBackground="neutral-weak" align="center">
                  Aún no hay mensajes. Escribe el primero.
                </Text>
              </Column>
            ) : (
              messages.map((message) => (
                <MiniMessage
                  key={message.id}
                  message={message}
                  own={message.senderId === viewerId}
                  isGroup={active.kind === "group"}
                />
              ))
            )}
          </Column>

          <Line background="neutral-alpha-weak" />

          <Row fillWidth gap="8" vertical="center" padding="12">
            <EmojiPickerDropdown
              placement="top-start"
              open={emojiOpen}
              onOpenChange={setEmojiOpen}
              trigger={
                <IconButton
                  icon="emoji"
                  size="s"
                  variant="tertiary"
                  tooltip="Insertar emoji"
                  tooltipPosition="top"
                />
              }
              onSelect={(emoji) => {
                setText((prev) => prev + emoji);
                // Modo controlado (isOpen/onOpenChange): sin esto, closeAfterClick
                // solo dispara el onOpenChange del consumidor sin tocar el estado
                // interno del DropdownWrapper, así que el picker nunca se cerraba
                // y su focus trap seguía re-robando el foco de la celda elegida.
                // Cerramos explícitamente antes de focar. El DropdownWrapper
                // re-foca su trigger (el IconButton de la carita) al cerrarse,
                // DESPUÉS de este callback — un requestAnimationFrame pierde esa
                // carrera; con un timeout corto le ganamos a esa restauración de
                // foco y el foco queda en el input, no en el botón.
                setEmojiOpen(false);
                window.setTimeout(() => {
                  document.getElementById("light-messenger-composer")?.focus();
                }, 150);
              }}
            />
            <Column style={{ flex: 1, minWidth: 0 }}>
              <Input
                id="light-messenger-composer"
                size="s"
                placeholder="Escribe un mensaje..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
            </Column>
            <IconButton
              icon="arrowUpRight"
              size="s"
              variant="primary"
              tooltip="Enviar"
              tooltipPosition="top"
              onClick={handleSend}
              loading={sending}
              disabled={!text.trim() || sending}
            />
          </Row>
        </>
      )}
    </Column>
  );
}

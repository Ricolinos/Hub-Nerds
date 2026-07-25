"use client";

import {
  Avatar,
  Column,
  EmojiPickerDropdown,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Row,
  Text,
} from "@once-ui-system/core";
import { useEffect, useRef, useState } from "react";
import type { ConversationSummary } from "@/app/actions/inbox";
import { MessageBubble } from "./MessageBubble";
import { personInitial, presenceColor, presenceOf, type StreamMessage } from "./messengerUtils";
import { CreateTaskModal, type TaskParticipant } from "./TaskCard";

/* ══ Panel central: conversación activa (2.2) ═══════════════════════════ */

export function ConversationPanel({
  conversation,
  viewerId,
  messages,
  loadingMessages,
  sending,
  onSend,
  infoOpen,
  onToggleInfo,
  onBack,
  mobileView,
  freelancerParticipants,
  assets,
  onTaskChanged,
}: {
  conversation: ConversationSummary | null;
  viewerId: string;
  messages: StreamMessage[];
  loadingMessages: boolean;
  sending: boolean;
  onSend: (body: string) => void;
  infoOpen: boolean;
  onToggleInfo: () => void;
  onBack: () => void;
  mobileView: "list" | "conversation" | "info";
  freelancerParticipants: TaskParticipant[];
  assets: { id: string; title: string }[];
  onTaskChanged: () => void;
}) {
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [taskMessage, setTaskMessage] = useState<StreamMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    setText("");
    setTaskMessage(null);
  }, [conversation?.key]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    onSend(trimmed);
    setText("");
    // Con Enter el foco ya está en el input; con click en el IconButton de
    // enviar, el navegador se lo lleva al botón. Lo regresamos en el próximo
    // frame para ganarle a ese robo de foco (el input ya no se deshabilita
    // durante el envío, así que no hay pérdida de foco propia que reparar).
    requestAnimationFrame(() => {
      document.getElementById("conversation-composer")?.focus();
    });
  };

  const isGroup = conversation?.kind === "group";
  const headerTitle =
    isGroup && conversation?.project
      ? `${conversation.title} — ${conversation.project.title}`
      : (conversation?.title ?? "");

  return (
    <Column
      fillHeight
      background="surface"
      border="neutral-alpha-weak"
      radius="l"
      overflow="hidden"
      style={{ flex: 1, minWidth: 0 }}
      s={mobileView !== "conversation" ? { hide: true } : undefined}
      xs={mobileView !== "conversation" ? { hide: true } : undefined}
    >
      {!conversation ? (
        <Column fillWidth fillHeight center gap="12" padding="24">
          <Icon name="email" size="l" onBackground="neutral-weak" />
          <Text variant="body-default-s" onBackground="neutral-weak" align="center">
            Selecciona un chat para ver la conversación.
          </Text>
        </Column>
      ) : (
        <>
          <Row
            fillWidth
            gap="12"
            vertical="center"
            horizontal="between"
            padding="16"
            borderBottom="neutral-alpha-weak"
          >
            <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
              <Row hide s={{ hide: false }} xs={{ hide: false }}>
                <IconButton
                  icon="chevronLeft"
                  size="m"
                  variant="tertiary"
                  tooltip="Volver a la lista"
                  onClick={onBack}
                />
              </Row>
              <Avatar
                size="m"
                {...(conversation.avatarUrl
                  ? { src: conversation.avatarUrl }
                  : isGroup
                    ? { icon: "userGroup" as const }
                    : { value: personInitial({ name: conversation.title, username: null }) })}
                {...(!isGroup && conversation.participant
                  ? {
                      statusIndicator: {
                        color: presenceColor(presenceOf(conversation.participant)),
                      },
                    }
                  : {})}
              />
              <Column gap="0" style={{ minWidth: 0 }}>
                <Heading variant="heading-strong-s" truncate style={{ minWidth: 0 }}>
                  {headerTitle}
                </Heading>
                {!isGroup && conversation.subtitle && (
                  <Text
                    variant="label-default-s"
                    onBackground="neutral-weak"
                    truncate
                    style={{ minWidth: 0 }}
                  >
                    {conversation.subtitle}
                  </Text>
                )}
              </Column>
            </Row>
            {/* size="m" (antes "s", ~22.5px): en el header del chat, el ícono
                de info es el único control activo aquí y es de uso frecuente
                en móvil — 22.5px queda por debajo del target táctil mínimo
                recomendado (~40px). phone/video quedan igual por consistencia
                visual del grupo aunque estén disabled. */}
            <Row gap="4">
              <IconButton
                icon="phone"
                size="m"
                variant="tertiary"
                tooltip="Próximamente"
                tooltipPosition="bottom"
                disabled
              />
              <IconButton
                icon="video"
                size="m"
                variant="tertiary"
                tooltip="Próximamente"
                tooltipPosition="bottom"
                disabled
              />
              <IconButton
                icon="infoCircle"
                size="m"
                variant={infoOpen ? "primary" : "tertiary"}
                tooltip="Información del chat"
                tooltipPosition="bottom"
                onClick={onToggleInfo}
              />
            </Row>
          </Row>

          <Column
            ref={scrollRef}
            gap="12"
            padding="16"
            overflowY="auto"
            style={{ flex: 1, minWidth: 0, minHeight: 0 }}
          >
            {!loadingMessages && messages.length === 0 ? (
              <Column fillWidth fillHeight center gap="12" padding="24">
                <Icon name="email" size="l" onBackground="neutral-weak" />
                <Text variant="body-default-s" onBackground="neutral-weak" align="center">
                  Aún no hay mensajes. Escribe el primero.
                </Text>
              </Column>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  own={message.senderId === viewerId}
                  viewerId={viewerId}
                  isGroup={isGroup}
                  onConvertClick={() => setTaskMessage(message)}
                  onTaskResolved={onTaskChanged}
                />
              ))
            )}
          </Column>

          <Line background="neutral-alpha-weak" />

          <Row fillWidth gap="8" vertical="center" padding="16">
            <IconButton
              icon="attach"
              size="s"
              variant="tertiary"
              tooltip="Próximamente"
              tooltipPosition="top"
              disabled
            />
            <EmojiPickerDropdown
              placement="top-start"
              isOpen={emojiOpen}
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
                  document.getElementById("conversation-composer")?.focus();
                }, 150);
              }}
            />
            <Column style={{ flex: 1, minWidth: 0 }}>
              <Input
                id="conversation-composer"
                height="s"
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

          {isGroup && (
            <CreateTaskModal
              isOpen={taskMessage !== null}
              onClose={() => setTaskMessage(null)}
              messageId={taskMessage?.id ?? null}
              messageBody={taskMessage?.body ?? ""}
              freelancerParticipants={freelancerParticipants}
              assets={assets}
              onCreated={onTaskChanged}
              projectId={conversation?.project?.id ?? null}
            />
          )}
        </>
      )}
    </Column>
  );
}

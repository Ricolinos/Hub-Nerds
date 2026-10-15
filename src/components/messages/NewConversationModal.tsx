"use client";

import {
  Avatar,
  Button,
  Column,
  Feedback,
  Input,
  Modal,
  Row,
  Select,
  useToast,
} from "@once-ui-system/core";
import { useEffect, useState } from "react";
import {
  type EligibleRecipientData,
  getEligibleRecipients,
  startDirectThread,
} from "@/app/actions/directMessages";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { personInitial, personLabel } from "./messengerUtils";

/* ══ Modal: iniciar un hilo directo nuevo ═══════════════════════════════
   Extraído de ConversationList (botón "+" del header) para reutilizarse
   también desde el botón "+" del riel (ProjectRail, sección Usuarios) — la
   toast de éxito/errores y el ciclo getEligibleRecipients/startDirectThread
   son idénticos en ambos puntos de entrada. ═══════════════════════════ */

export function NewConversationModal({
  isOpen,
  onClose,
  onCreated,
  initialRecipientId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
  // Preselecciona al destinatario (viene del buscador del riel) y omite el
  // Select: el usuario solo escribe el primer mensaje.
  initialRecipientId?: string | null;
}) {
  const { addToast } = useToast();
  const [recipients, setRecipients] = useState<EligibleRecipientData[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: addToast no está memoizado por ToastProvider; incluirlo dispararía el fetch en cada render mientras el modal sigue abierto.
  useEffect(() => {
    if (!isOpen) return;
    setRecipientId(initialRecipientId ?? "");
    setLoadingRecipients(true);
    setError(null);
    (async () => {
      const result = await getEligibleRecipients();
      if (result.ok) setRecipients(result.recipients);
      else {
        setError(result.error);
        addToast({ variant: "danger", message: result.error });
      }
      setLoadingRecipients(false);
    })();
  }, [isOpen, initialRecipientId]);

  const handleClose = () => {
    if (sending) return;
    setRecipientId("");
    setFirstMessage("");
    setError(null);
    onClose();
  };

  const handleStart = async () => {
    if (!recipientId || !firstMessage.trim()) return;
    setSending(true);
    setError(null);
    const result = await startDirectThread(recipientId, firstMessage);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRecipientId("");
    setFirstMessage("");
    onCreated(result.threadId);
  };

  const selectedRecipient = recipients.find((recipient) => recipient.id === recipientId) ?? null;
  const lockRecipient = Boolean(initialRecipientId);

  const options = recipients.map((recipient) => ({
    value: recipient.id,
    label: personLabel(recipient),
    description: recipient.headline ?? undefined,
    hasPrefix: (
      <Avatar
        size="xs"
        {...(recipient.imageUrl
          ? { src: recipient.imageUrl }
          : { value: personInitial(recipient) })}
      />
    ),
  }));

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Nuevo mensaje"
      backdrop={<BrandModalBackdrop />}
    >
      <Column gap="16" fillWidth paddingTop="12">
        {lockRecipient && selectedRecipient ? (
          <Row gap="8" vertical="center" padding="8" radius="m" background="neutral-alpha-weak">
            <Avatar
              size="s"
              {...(selectedRecipient.imageUrl
                ? { src: selectedRecipient.imageUrl }
                : { value: personInitial(selectedRecipient) })}
            />
            <Column gap="0">
              <Row textVariant="label-strong-s">{personLabel(selectedRecipient)}</Row>
              {selectedRecipient.headline && (
                <Row textVariant="body-default-s" onBackground="neutral-weak">
                  {selectedRecipient.headline}
                </Row>
              )}
            </Column>
          </Row>
        ) : (
          <Select
            id="new-message-recipient"
            label="Destinatario"
            placeholder={loadingRecipients ? "Cargando..." : "Selecciona a quién escribir"}
            value={recipientId}
            onSelect={(value) => setRecipientId(value as string)}
            options={options}
            searchable
            disabled={loadingRecipients}
          />
        )}
        <Input
          id="new-message-body"
          label="Mensaje"
          placeholder="Escribe tu primer mensaje..."
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
        />

        {error && (
          <Feedback
            variant="danger"
            description={error}
            onClose={() => setError(null)}
            showCloseButton
            fillWidth
          />
        )}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={sending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="m"
            onClick={handleStart}
            loading={sending}
            disabled={!recipientId || !firstMessage.trim()}
          >
            Enviar
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

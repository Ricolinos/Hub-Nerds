"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Column, Feedback, Icon, IconButton, Modal, Row, Spinner, Text } from "@once-ui-system/core";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";

const modalBackdrop = <BrandModalBackdrop />;

export type AttachmentKind = "image" | "audio" | "video";

export interface ProjectAttachment {
  id: string;
  name: string;
  url: string;
  kind: AttachmentKind;
}

interface AttachFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAttachments: ProjectAttachment[];
  onConfirm: (attachments: ProjectAttachment[]) => void;
}

function kindOf(file: File): AttachmentKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

// Sin bucket de Storage todavía (ver perfil de Partner): igual que coverImageUrl,
// el archivo se guarda como data URL en el campo gallery de PortfolioPiece.
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

// El módulo MediaUpload de Once UI solo acepta imágenes (rechaza cualquier
// otro tipo internamente), así que audio/video usan un dropzone propio con
// el mismo lenguaje visual (caja punteada, click o arrastrar para buscar).
function Dropzone({
  onFile,
  uploading,
  disabled,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const busy = uploading || disabled;

  const pick = () => {
    if (!busy) inputRef.current?.click();
  };

  return (
    <Column
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={busy}
      onClick={pick}
      onKeyDown={(e) => {
        if (!busy && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files?.[0];
        if (file && !busy) onFile(file);
      }}
      fillWidth
      horizontal="center"
      vertical="center"
      gap="8"
      paddingY="40"
      radius="l"
      border={dragActive ? "brand-medium" : "neutral-medium"}
      background={dragActive ? "brand-alpha-weak" : undefined}
      style={{ borderStyle: "dashed", cursor: busy ? "default" : "pointer" }}
    >
      {uploading ? (
        <>
          <Spinner size="m" ariaLabel="Subiendo archivo" />
          <Text variant="body-default-s" onBackground="neutral-weak">
            Subiendo archivo…
          </Text>
        </>
      ) : (
        <>
          <Icon name="attach" size="l" onBackground="neutral-weak" />
          <Text variant="body-default-s" onBackground="neutral-weak">
            Arrastra un archivo o haz click para buscar
          </Text>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Imagen, audio o video
          </Text>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,audio/*,video/*"
        style={{ display: "none" }}
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </Column>
  );
}

function AttachmentThumbnail({
  attachment,
  onRemove,
  disabled,
}: {
  attachment: ProjectAttachment;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <Column
      radius="m"
      overflow="hidden"
      border="neutral-alpha-weak"
      background="neutral-alpha-weak"
      style={{ width: 96, height: 96, flexShrink: 0, position: "relative" }}
    >
      {attachment.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL local, sin optimización posible
        <img
          src={attachment.url}
          alt={attachment.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <Column fillWidth fillHeight horizontal="center" vertical="center" gap="4" padding="4">
          <Icon
            name={attachment.kind === "audio" ? "audio" : "film"}
            size="m"
            onBackground="neutral-weak"
          />
          <Text
            variant="label-default-xs"
            onBackground="neutral-weak"
            align="center"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            {attachment.name}
          </Text>
        </Column>
      )}
      <Row position="absolute" top="4" right="4">
        <IconButton
          icon="close"
          size="s"
          variant="secondary"
          tooltip="Quitar archivo"
          onClick={onRemove}
          disabled={disabled}
        />
      </Row>
    </Column>
  );
}

export function AttachFilesModal({
  isOpen,
  onClose,
  initialAttachments,
  onConfirm,
}: AttachFilesModalProps) {
  const [draft, setDraft] = useState<ProjectAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft(initialAttachments);
      setError(null);
      setUploading(false);
    }
    // Solo debe reiniciar el borrador al abrir, no en cada cambio de initialAttachments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleFile = async (file: File) => {
    const kind = kindOf(file);
    if (!kind) {
      setError("Solo se aceptan archivos de imagen, audio o video.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await readFileAsDataUrl(file);
      setDraft((current) => [...current, { id: crypto.randomUUID(), name: file.name, url, kind }]);
    } catch {
      setError("No se pudo adjuntar el archivo. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setDraft(initialAttachments);
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(draft);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Adjunta los archivos de tu proyecto"
      backdrop={modalBackdrop}
    >
      <Column gap="16" fillWidth paddingTop="12">
        <Text variant="body-default-m" onBackground="neutral-weak">
          Comparte recursos y asegúrate de poseer los derechos de distribución y uso.
        </Text>

        <Dropzone onFile={handleFile} uploading={uploading} disabled={uploading} />

        {error && <Feedback variant="danger" description={error} />}

        {draft.length > 0 && (
          <Row gap="12" fillWidth overflowX="auto" paddingY="4">
            {draft.map((attachment) => (
              <AttachmentThumbnail
                key={attachment.id}
                attachment={attachment}
                disabled={uploading}
                onRemove={() => setDraft((current) => current.filter((a) => a.id !== attachment.id))}
              />
            ))}
          </Row>
        )}

        <Row fillWidth gap="8" horizontal="end" paddingTop="8">
          <Button variant="secondary" size="m" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleConfirm} disabled={uploading}>
            Listo
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

"use client";

import {
  Column,
  Icon,
  IconButton,
  Input,
  Row,
  Spinner,
  Text,
} from "@once-ui-system/core";
import { useEffect, useRef, useState } from "react";
import { uploadMediaFile } from "@/lib/storageUpload";

// FEATURE (Modo Pro, panel "Adjuntar archivos"): adjuntos con NOMBRE que el
// Markdown/MDX referencia por `<Media src="nombre" />` (ver
// resolveAttachmentSrc en mdx.tsx) — a diferencia del modo Asistido, donde
// la media entra directo por bloques (el bloque YA guarda la URL de
// Storage). `id` es puramente de UI (key estable de React + reordenar
// renombrados sin remount del Input); nunca viaja al server — CreateProjectModal
// lo separa al armar el payload de `attachments` (ver PieceAttachment en
// actions/portfolioPieces.ts).
export interface PieceAttachmentDraft {
  id: string;
  name: string;
  url: string;
  type: "image" | "video";
}

// Mismo tope que valida el server (MAX_ATTACHMENTS/MAX_ATTACHMENT_NAME_LENGTH
// en actions/portfolioPieces.ts): se replica aquí solo para el feedback
// inmediato (contador, bloqueo de subida, error de nombre), la validación
// real vive del lado server.
const MAX_ATTACHMENTS = 30;
const MAX_ATTACHMENT_NAME_LENGTH = 80;

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4";

function fileKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "video/mp4") return "video";
  // Algunos navegadores/SO no completan `file.type` en ciertos flujos
  // (drag-and-drop en Safari, mismo gotcha que lib/videoUpload.ts): cae a
  // la extensión del nombre como fallback antes de rechazar.
  if (!file.type && /\.mp4$/i.test(file.name)) return "video";
  if (!file.type && /\.(jpe?g|png|webp|gif)$/i.test(file.name)) return "image";
  return null;
}

// Nombre por defecto al subir: el nombre de archivo sin extensión, separadores
// de ruta colapsados a espacio y recortado al máximo permitido — el usuario
// puede editarlo después (ver AttachmentRow), esto solo evita un default feo
// como "IMG_20260714_arte-final.png".
function sanitizeAttachmentName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^./\\]+$/, "");
  const cleaned = withoutExt.replace(/[\\/]+/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "archivo").slice(0, MAX_ATTACHMENT_NAME_LENGTH);
}

// Único case-insensitive (mismo criterio que normalizeAttachments en el
// server): si el nombre deseado ya existe entre los demás adjuntos, agrega
// un sufijo numérico incremental (" 2", " 3"...) hasta encontrar uno libre.
function uniqueAttachmentName(
  desired: string,
  existing: PieceAttachmentDraft[],
  excludeId?: string,
): string {
  const base = desired.trim() || "archivo";
  const taken = new Set(
    existing.filter((a) => a.id !== excludeId).map((a) => a.name.toLowerCase()),
  );
  if (!taken.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (taken.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
}

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
      gap="4"
      paddingY="20"
      radius="m"
      border={dragActive ? "brand-medium" : "neutral-medium"}
      background={dragActive ? "brand-alpha-weak" : undefined}
      style={{ borderStyle: "dashed", cursor: busy ? "default" : "pointer" }}
    >
      {uploading ? (
        <>
          <Spinner size="s" ariaLabel="Subiendo archivo" />
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Subiendo…
          </Text>
        </>
      ) : (
        <>
          <Icon name="attach" size="m" onBackground="neutral-weak" />
          <Text variant="body-default-xs" onBackground="neutral-weak" align="center">
            Arrastra o haz click — imagen o video .mp4
          </Text>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
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

function AttachmentRow({
  attachment,
  siblings,
  onRename,
  onRemove,
  onCopyReference,
  copied,
  disabled,
}: {
  attachment: PieceAttachmentDraft;
  siblings: PieceAttachmentDraft[];
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onCopyReference: (attachment: PieceAttachmentDraft) => void;
  copied: boolean;
  disabled?: boolean;
}) {
  const [draftName, setDraftName] = useState(attachment.name);
  const [nameError, setNameError] = useState<string | null>(null);

  // Resincroniza si el nombre cambia por fuera (ej. precarga al reabrir la
  // pieza) sin pisar lo que el usuario esté escribiendo en otra fila.
  useEffect(() => setDraftName(attachment.name), [attachment.name]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      setDraftName(attachment.name);
      setNameError(null);
      return;
    }
    if (trimmed.length > MAX_ATTACHMENT_NAME_LENGTH) {
      setNameError(`Máximo ${MAX_ATTACHMENT_NAME_LENGTH} caracteres`);
      setDraftName(attachment.name);
      return;
    }
    const collision = siblings.some(
      (sibling) =>
        sibling.id !== attachment.id && sibling.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (collision) {
      setNameError("Ya existe un adjunto con ese nombre");
      setDraftName(attachment.name);
      return;
    }
    setNameError(null);
    if (trimmed !== attachment.name) onRename(attachment.id, trimmed);
  };

  return (
    <Row fillWidth gap="12" vertical="center" padding="8" radius="m" border="neutral-alpha-weak">
      <Column
        radius="s"
        overflow="hidden"
        background="neutral-alpha-weak"
        style={{ width: "3.5rem", height: "3.5rem", flexShrink: 0, position: "relative" }}
      >
        {attachment.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura directa del bucket, sin necesidad de next/image en el editor
          <img
            src={attachment.url}
            alt={attachment.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          // Miniatura de video: primer frame vía `preload="metadata"` (sin
          // reproducir), mismo criterio liviano que pide la tarea — no hace
          // falta extraer/generar un poster aparte.
          <video
            src={attachment.url}
            preload="metadata"
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          >
            <track kind="captions" />
          </video>
        )}
        <Row position="absolute" bottom="2" right="2">
          <Icon
            name={attachment.type === "video" ? "film" : "images"}
            size="xs"
            onBackground="neutral-weak"
          />
        </Row>
      </Column>
      <Column flex={1} gap="2">
        <Input
          id={`attachment-name-${attachment.id}`}
          size="s"
          placeholder="Nombre del adjunto"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          disabled={disabled}
          error={Boolean(nameError)}
          errorMessage={nameError ?? undefined}
        />
      </Column>
      <Row gap="4">
        <IconButton
          icon={copied ? "check" : "copy"}
          variant="tertiary"
          size="s"
          tooltip={copied ? "¡Copiado!" : "Copiar referencia"}
          onClick={() => onCopyReference(attachment)}
          disabled={disabled}
        />
        <IconButton
          icon="trash"
          variant="tertiary"
          size="s"
          tooltip="Quitar adjunto"
          onClick={() => onRemove(attachment.id)}
          disabled={disabled}
        />
      </Row>
    </Row>
  );
}

interface PieceAttachmentsPanelProps {
  value: PieceAttachmentDraft[];
  onChange: (next: PieceAttachmentDraft[]) => void;
  disabled?: boolean;
}

// Panel embebido (no modal, a diferencia del extinto AttachFilesModal que
// reemplaza) del panel derecho del editor en Modo Pro: sube archivos directo
// a Storage (misma infra que portada/bloques, ver lib/storageUpload.ts) y
// arma la lista de adjuntos con nombre que el Markdown/MDX referencia (ver
// resolveAttachmentSrc en mdx.tsx). CreateProjectModal es dueño del estado
// (`value`/`onChange`) para que entre en el mismo dirty-tracking/guardado que
// el resto del formulario.
export function PieceAttachmentsPanel({ value, onChange, disabled }: PieceAttachmentsPanelProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (value.length >= MAX_ATTACHMENTS) {
      setError(`Máximo ${MAX_ATTACHMENTS} archivos adjuntos por proyecto.`);
      return;
    }
    const kind = fileKind(file);
    if (!kind) {
      setError("Solo se aceptan imágenes (JPEG, PNG, WebP, GIF) o video .mp4.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadMediaFile(file);
      const name = uniqueAttachmentName(sanitizeAttachmentName(file.name), value);
      onChange([...value, { id: crypto.randomUUID(), name, url, type: kind }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  const handleRename = (id: string, name: string) => {
    onChange(value.map((attachment) => (attachment.id === id ? { ...attachment, name } : attachment)));
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((attachment) => attachment.id !== id));
  };

  const handleCopyReference = async (attachment: PieceAttachmentDraft) => {
    try {
      // `Media` (Once UI) autodetecta imagen/video por la extensión real de
      // la URL resuelta (ver mdx.tsx/resolveAttachmentSrc): el mismo snippet
      // sirve para ambos tipos, no hace falta un componente aparte.
      await navigator.clipboard.writeText(`<Media src="${attachment.name}" alt="" />`);
      setCopiedId(attachment.id);
      setTimeout(() => setCopiedId((current) => (current === attachment.id ? null : current)), 1500);
    } catch {
      // El clipboard puede fallar por permisos del navegador; sin feedback
      // adicional, el usuario copia el nombre a mano desde el Input.
    }
  };

  return (
    <Column fillWidth gap="12">
      <Dropzone onFile={handleFile} uploading={uploading} disabled={disabled} />
      {error && (
        <Text variant="body-default-xs" onBackground="danger-weak">
          {error}
        </Text>
      )}
      {value.length > 0 && (
        <Column fillWidth gap="8">
          {value.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              siblings={value}
              onRename={handleRename}
              onRemove={handleRemove}
              onCopyReference={handleCopyReference}
              copied={copiedId === attachment.id}
              disabled={disabled || uploading}
            />
          ))}
        </Column>
      )}
      <Text variant="body-default-xs" onBackground="neutral-weak">
        {value.length}/{MAX_ATTACHMENTS} archivos — referencia cada uno en tu Markdown por su nombre,
        ej. <code>{'<Media src="nombre" alt="" />'}</code>.
      </Text>
    </Column>
  );
}

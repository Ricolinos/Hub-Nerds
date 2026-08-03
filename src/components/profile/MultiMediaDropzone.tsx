"use client";

import { Column, HoverCard, Icon, Row, Spinner, Text, Tooltip } from "@once-ui-system/core";
import { useRef, useState } from "react";
import { uploadMediaFile } from "@/lib/storageUpload";

// Motor reutilizable de subida múltiple (tarea "acomodo automático: N fotos
// de golpe"): `MediaUpload` (@once-ui-system/core/modules) es MONO-archivo
// por implementación —toma `files[0]` y silencia en consola cualquier tipo
// no-imagen, ver su propio `handleFiles` en dist/modules/media/
// MediaUpload.impl.js— así que no sirve de base para esto. Este módulo NO
// reemplaza `MediaUpload` en los slots de UN solo archivo (portada, bloque
// "image" de reemplazo, cada tile YA lleno de carousel/masonry/logoCloud):
// solo alimenta el tile "Agregar" de cada bloque de medios, que es el único
// punto de entrada de un lote nuevo.
//
// `useMultiMediaUpload` es el hook headless (cola + concurrencia + compresión
// + reporte por archivo); `MultiMediaDropzone` es la vista lista para usar
// (mismo patrón visual que `VideoFileDropzone`: Column-botón con drag&drop +
// input oculto) para los 3 sitios donde el "Agregar" ya era un tile
// cuadrado propio (tira de carousel, masonry, logoCloud). El bloque
// "Carousel" (mediaCarousel, con su dropdown Imagen/YouTube/Video) consume
// el hook directo — su "+" no es un tile de subida sino un menú, y además
// necesita aceptar drop sobre TODO el bloque, no solo el tile (ver
// ContentBlocks.tsx, MediaCarouselBlockEditor).

export type MultiMediaAccept = "image" | "image-video";

export interface MultiMediaUploadFailure {
  name: string;
  reason: string;
}

// Mismo tope que MAX_UPLOAD_BYTES (app/actions/media.ts) — validación de UX
// temprana antes del round-trip; el server vuelve a exigirlo.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIME = "video/mp4";
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const GIF_EXT_RE = /\.gif$/i;
const VIDEO_EXT_RE = /\.mp4$/i;

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

// Extensión real que devuelve `createSignedUpload` (whitelist MIME→ext en
// app/actions/media.ts) — permite a un consumidor (ej. las slides de
// mediaCarousel) decidir "image" vs "file" (video) a partir de la URL YA
// subida, sin tener que cargar el `File` original hasta ese punto.
export function isVideoUploadUrl(url: string): boolean {
  return VIDEO_EXT_RE.test(url);
}

interface DetectedFileKind {
  kind: "image" | "video" | null;
  isGif: boolean;
}

// Algunos navegadores/SO no completan `file.type` en ciertos flujos (drag
// and drop en Safari, mismo gotcha de lib/videoUpload.ts/PieceAttachmentsPanel):
// cae a la extensión del nombre como fallback antes de rechazar.
function detectFileKind(file: File): DetectedFileKind {
  if (file.type === "image/gif") return { kind: "image", isGif: true };
  if (IMAGE_MIME.has(file.type)) return { kind: "image", isGif: false };
  if (file.type === VIDEO_MIME) return { kind: "video", isGif: false };
  if (!file.type) {
    if (GIF_EXT_RE.test(file.name)) return { kind: "image", isGif: true };
    if (IMAGE_EXT_RE.test(file.name)) return { kind: "image", isGif: false };
    if (VIDEO_EXT_RE.test(file.name)) return { kind: "video", isGif: false };
  }
  return { kind: null, isGif: false };
}

// Import perezoso, mismo patrón que `getCompressor` en
// dist/modules/media/MediaUpload.impl.js (code-splitting: la librería solo
// se carga la primera vez que de verdad hay una imagen que comprimir).
// biome-ignore lint/suspicious/noExplicitAny: constructor de compressorjs, sin @types propio más allá de types/index.d.ts (no ambient global)
let CompressorCtor: any = null;
async function getCompressor() {
  if (!CompressorCtor) {
    const mod = await import("compressorjs");
    CompressorCtor = (mod as { default?: unknown }).default ?? mod;
  }
  return CompressorCtor;
}

// GIF NUNCA se comprime (Compressor.js usa canvas.toBlob, que solo captura
// el frame actual y mata la animación — mismo motivo documentado en
// lib/coverMedia.ts para la portada). MP4 tampoco pasa por aquí (los
// videos no se comprimen, ver detectFileKind + el filtro del caller).
function compressImageFile(file: File, maxWidth: number, maxHeight: number): Promise<File> {
  return getCompressor().then(
    (Compressor) =>
      new Promise<File>((resolve) => {
        new Compressor(file, {
          quality: 0.8,
          maxWidth,
          maxHeight,
          convertSize: 400 * 1024,
          success: (result: File | Blob) => resolve(result as File),
          error: (err: Error) => {
            console.error("Compression error:", err);
            resolve(file);
          },
        });
      }),
  );
}

// Pool con tope de concurrencia (spec: 3 simultáneas, no disparar decenas de
// server actions de golpe): cada "runner" jala el siguiente índice libre
// hasta agotar la lista — no es un `Promise.all` plano.
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    const index = cursor++;
    if (index >= items.length) return;
    await worker(items[index], index);
    return runNext();
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
}

export interface UseMultiMediaUploadOptions {
  accept: MultiMediaAccept;
  disabled?: boolean;
  // Default true — el bloque "image" de reemplazo/portada usan `compress`
  // explícito con MediaUpload; este hook replica el mismo default.
  compress?: boolean;
  resizeMaxWidth?: number;
  resizeMaxHeight?: number;
  concurrency?: number;
  // Recibe SOLO las URLs que subieron bien, en el ORDEN ORIGINAL de
  // selección (independiente del orden real de resolución de la cola
  // concurrente) — los fallos se exponen aparte en `failed`, con tooltip.
  onUploaded: (urls: string[]) => void;
}

export interface UseMultiMediaUploadResult {
  busy: boolean;
  progress: { done: number; total: number } | null;
  failed: MultiMediaUploadFailure[];
  dismissFailed: () => void;
  enqueueFiles: (files: FileList | File[] | null | undefined) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  openPicker: () => void;
  inputAccept: string;
}

export function useMultiMediaUpload({
  accept,
  disabled,
  compress = true,
  resizeMaxWidth = 1600,
  resizeMaxHeight = 1600,
  concurrency = 3,
  onUploaded,
}: UseMultiMediaUploadOptions): UseMultiMediaUploadResult {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<MultiMediaUploadFailure[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // `onUploaded` cierra sobre el `block` del render en que se creó — la
  // subida es async y puede terminar varios renders después (el usuario
  // sigue editando otros campos mientras el lote sube), así que hay que
  // llamar SIEMPRE a la versión más reciente, no a la capturada al
  // arrancar la cola.
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const inputAccept = accept === "image-video" ? `${IMAGE_ACCEPT},${VIDEO_MIME}` : IMAGE_ACCEPT;

  const openPicker = () => {
    if (!disabled && !busy) inputRef.current?.click();
  };

  const enqueueFiles = (fileList: FileList | File[] | null | undefined) => {
    if (disabled || busy) return;
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setBusy(true);
    setFailed([]);
    const total = files.length;
    setProgress({ done: 0, total });

    const results: (string | null)[] = new Array(total).fill(null);
    const nextFailed: MultiMediaUploadFailure[] = [];
    let doneCount = 0;

    const worker = async (file: File, index: number) => {
      const detected = detectFileKind(file);
      if (!detected.kind || (detected.kind === "video" && accept !== "image-video")) {
        nextFailed.push({
          name: file.name,
          reason:
            detected.kind === "video"
              ? "Video no permitido en este estilo."
              : "Tipo de archivo no soportado.",
        });
      } else if (file.size > MAX_UPLOAD_BYTES) {
        nextFailed.push({
          name: file.name,
          reason: `Pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB, máximo 10MB.`,
        });
      } else {
        try {
          const toUpload =
            compress && detected.kind === "image" && !detected.isGif
              ? await compressImageFile(file, resizeMaxWidth, resizeMaxHeight)
              : file;
          results[index] = await uploadMediaFile(toUpload);
        } catch (err) {
          nextFailed.push({
            name: file.name,
            reason: err instanceof Error ? err.message : "No se pudo subir.",
          });
        }
      }
      doneCount += 1;
      setProgress({ done: doneCount, total });
    };

    runWithConcurrency(files, concurrency, worker).then(() => {
      setBusy(false);
      setProgress(null);
      setFailed(nextFailed);
      const urls = results.filter((url): url is string => Boolean(url));
      if (urls.length > 0) onUploadedRef.current(urls);
    });
  };

  return {
    busy,
    progress,
    failed,
    dismissFailed: () => setFailed([]),
    enqueueFiles,
    inputRef,
    openPicker,
    inputAccept,
  };
}

// Badge minimalista de errores (preferencia de UI del proyecto: mínima
// info visible, detalle solo al hover): un renglón compacto con el conteo,
// el detalle completo (archivo + motivo) vive en el `Tooltip` — mismo
// patrón `HoverCard` + `Tooltip` que `ToolbarDropdownTrigger` más arriba en
// este archivo.
export function MultiMediaUploadFailureBadge({
  failed,
  onDismiss,
}: {
  failed: MultiMediaUploadFailure[];
  onDismiss: () => void;
}) {
  if (failed.length === 0) return null;
  return (
    <HoverCard
      trigger={
        <Row
          gap="4"
          vertical="center"
          cursor="interactive"
          onClick={onDismiss}
          role="button"
          tabIndex={0}
        >
          <Icon name="danger" size="xs" onBackground="danger-weak" />
          <Text variant="body-default-xs" onBackground="danger-weak">
            {failed.length === 1 ? "1 archivo no subió" : `${failed.length} archivos no subieron`}
          </Text>
        </Row>
      }
      placement="top"
      fade={0}
      scale={0.9}
      duration={200}
      offsetDistance="4"
    >
      <Tooltip
        label={
          <Column gap="2">
            {failed.map((f) => (
              <Text key={f.name} variant="body-default-xs">
                {f.name}: {f.reason}
              </Text>
            ))}
          </Column>
        }
      />
    </HoverCard>
  );
}

export interface MultiMediaDropzoneProps {
  accept: MultiMediaAccept;
  disabled?: boolean;
  // rem (prop nativo `width` de Once UI, número = rem real) — mismo criterio
  // que los tiles ya existentes (4.5 en la tira de carousel, 6 en masonry, 8
  // en logoCloud).
  width?: number;
  aspectRatio?: string;
  radius?: "xs" | "s" | "m" | "l" | "xl" | "full";
  resizeMaxWidth?: number;
  resizeMaxHeight?: number;
  emptyLabel?: string;
  onUploaded: (urls: string[]) => void;
}

// Vista lista para usar del tile "Agregar" de carousel (tira)/masonry/
// logoCloud: mismo patrón de `VideoFileDropzone` (Column-botón con
// drag&drop + input oculto), pero con `multiple` en el input y la cola de
// `useMultiMediaUpload` por dentro. Icono "plus" mientras está libre (mismo
// lenguaje visual que el `MediaUpload` que sustituye en este slot); durante
// la subida cambia a un spinner + contador "n/total".
export function MultiMediaDropzone({
  accept,
  disabled,
  width = 4.5,
  aspectRatio = "1",
  radius = "m",
  resizeMaxWidth = 1600,
  resizeMaxHeight = 1600,
  emptyLabel = "Agregar",
  onUploaded,
}: MultiMediaDropzoneProps) {
  const { busy, progress, failed, dismissFailed, enqueueFiles, inputRef, openPicker, inputAccept } =
    useMultiMediaUpload({ accept, disabled, resizeMaxWidth, resizeMaxHeight, onUploaded });
  const [dragActive, setDragActive] = useState(false);
  const busyOrDisabled = Boolean(disabled) || busy;

  return (
    <Column gap="4" width={width}>
      <Column
        role="button"
        tabIndex={busyOrDisabled ? -1 : 0}
        aria-label={emptyLabel}
        aria-disabled={busyOrDisabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (!busyOrDisabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busyOrDisabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (!busyOrDisabled) enqueueFiles(e.dataTransfer.files);
        }}
        fillWidth
        aspectRatio={aspectRatio}
        radius={radius}
        border={dragActive ? "brand-medium" : "neutral-medium"}
        borderStyle="dashed"
        background={dragActive ? "brand-alpha-weak" : undefined}
        cursor={busyOrDisabled ? "default" : "interactive"}
        horizontal="center"
        vertical="center"
      >
        {busy ? (
          <Column horizontal="center" vertical="center" gap="4">
            <Spinner size="s" ariaLabel="Subiendo archivos" />
            {progress && (
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {progress.done}/{progress.total}
              </Text>
            )}
          </Column>
        ) : (
          <Icon name="plus" size="m" onBackground="neutral-weak" />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={inputAccept}
          multiple
          style={{ display: "none" }}
          disabled={busyOrDisabled}
          onChange={(e) => {
            enqueueFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </Column>
      <MultiMediaUploadFailureBadge failed={failed} onDismiss={dismissFailed} />
    </Column>
  );
}

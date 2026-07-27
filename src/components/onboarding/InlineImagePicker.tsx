"use client";

import { useRef, useState } from "react";
import { Button, Column, Feedback, Row } from "@once-ui-system/core";
import { ImageCropper } from "@/components/shared/ImageCropper";

interface InlineImagePickerProps {
  /** Imagen actual, si ya hay una. */
  currentUrl: string | null;
  /** Recibe la data URL ya recortada. */
  onSave: (dataUrl: string) => Promise<void>;
  onDelete: () => Promise<void>;
  shape: "circle" | "rect";
  /** Tamaño del recorte en pantalla y de la salida. */
  viewWidth: number;
  viewHeight: number;
  outputWidth: number;
  outputHeight: number;
  maxBytes: number;
  maxDataUrlChars: number;
  emptyLabel: string;
  disabled?: boolean;
}

/* Selector de imagen sutil para la bienvenida.
 *
 * Deliberadamente NO usa MediaUpload: su zona de arrastre ocupa un bloque
 * grande que aquí competiría con la tarjeta, que es lo que debe mirarse. En
 * su lugar, un botón discreto abre el selector de archivos del sistema y el
 * recorte (arrastre + zoom, ImageCropper) aparece solo cuando hace falta.
 *
 * Con imagen ya cargada ofrece Editar (reencuadrar/zoom sobre una nueva) y
 * Eliminar, que es lo que se espera al querer sustituirla. */
export function InlineImagePicker({
  currentUrl,
  onSave,
  onDelete,
  shape,
  viewWidth,
  viewHeight,
  outputWidth,
  outputHeight,
  maxBytes,
  maxDataUrlChars,
  emptyLabel,
  disabled = false,
}: InlineImagePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const exportCrop = useRef<(() => Promise<string | null>) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const handlePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    // Se limpia el value para que elegir DOS VECES el mismo archivo vuelva a
    // disparar onChange (el navegador lo omite si el value no cambió).
    event.target.value = "";
    if (!selected) return;
    if (selected.size > maxBytes) {
      setError(`La imagen supera el máximo de ${Math.round(maxBytes / 1024 / 1024)}MB.`);
      return;
    }
    setError(null);
    setFile(selected);
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await exportCrop.current?.();
      if (!dataUrl) throw new Error("No se pudo procesar la imagen.");
      await onSave(dataUrl);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Column fillWidth gap="12" horizontal="center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handlePicked}
        style={{ display: "none" }}
      />

      {file ? (
        <Column gap="12" horizontal="center">
          <ImageCropper
            file={file}
            exportRef={exportCrop}
            viewWidth={viewWidth}
            viewHeight={viewHeight}
            outputWidth={outputWidth}
            outputHeight={outputHeight}
            maxDataUrlChars={maxDataUrlChars}
            maskShape={shape === "circle" ? "circle" : "none"}
            ariaLabel="Arrastra la imagen para reencuadrarla"
          />
          <Row gap="8" wrap horizontal="center">
            <Button size="s" loading={busy} onClick={commit}>
              Guardar
            </Button>
            <Button variant="tertiary" size="s" disabled={busy} onClick={() => setFile(null)}>
              Cancelar
            </Button>
          </Row>
        </Column>
      ) : currentUrl ? (
        <Row gap="8" wrap horizontal="center">
          <Button variant="secondary" size="s" disabled={disabled || busy} onClick={pick}>
            Editar
          </Button>
          <Button variant="tertiary" size="s" loading={busy} onClick={remove}>
            Eliminar
          </Button>
        </Row>
      ) : (
        <Button
          variant="secondary"
          size="s"
          prefixIcon="camera"
          disabled={disabled || busy}
          onClick={pick}
        >
          {emptyLabel}
        </Button>
      )}

      {error && (
        <Feedback
          variant="danger"
          description={error}
          showCloseButton
          onClose={() => setError(null)}
          fillWidth
        />
      )}
    </Column>
  );
}

"use client";

import {
  Avatar,
  type AvatarProps,
  Button,
  Column,
  Feedback,
  Modal,
  Row,
} from "@once-ui-system/core";
import { MediaUpload } from "@once-ui-system/core/media";
import { useRef, useState } from "react";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { AvatarEditButton } from "@/components/shared/AvatarEditButton";
import { ImageCropper } from "@/components/shared/ImageCropper";

type UploadResult = { ok: true } | { ok: false; error: string };

/* ══ Logotipo del proyecto (Fase 6b, rediseño gestor de proyectos) ═══════
   Extraído de CollabProjectView para reutilizarse también en el overlay de
   ajustes de proyecto de /mensajes (ConversationList) y en la imagen de
   sala del panel de detalles (DetailsPanel). Sin bucket de Storage: se
   comprime a JPEG en el cliente y viaja como data URL, mismo patrón que la
   imagen de perfil (AvatarUploadDialog) — mismo mecanismo de hover +
   reencuadre/zoom, vía los componentes compartidos AvatarEditButton /
   ImageCropper. `onUpload` recibe la data URL (o null al quitar) y decide
   qué server action llamar (updateProjectLogo / updateChannelInfo);
   `onSaved` la dispara el caller tras un cambio exitoso. ═══════════════ */

const LOGO_SIDE = 256;
const CROP_VIEW = 200;
// Debe caber bajo MAX_LOGO_DATA_URL_CHARS de updateProjectLogo (collab.ts).
const MAX_LOGO_DATA_URL_CHARS = 700_000;

const modalBackdrop = <BrandModalBackdrop />;

function ProjectLogoEditDialog({
  isOpen,
  onClose,
  logoUrl,
  onUpload,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  logoUrl: string | null;
  onUpload: (dataUrl: string | null) => Promise<UploadResult>;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exportCrop = useRef<(() => Promise<string | null>) | null>(null);

  const handleClose = () => {
    if (saving) return;
    setFile(null);
    setError(null);
    onClose();
  };

  const persist = async (dataUrl: string | null) => {
    setSaving(true);
    setError(null);
    const result = await onUpload(dataUrl);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFile(null);
    onSaved();
    onClose();
  };

  const handleSave = async () => {
    if (!file) return;
    try {
      const dataUrl = await exportCrop.current?.();
      if (!dataUrl) throw new Error("crop");
      await persist(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "crop"
          ? err.message
          : "No se pudo procesar la imagen.",
      );
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="Logotipo del proyecto"
      backdrop={modalBackdrop}
    >
      <Column gap="16" fillWidth paddingTop="12">
        <Feedback
          variant="info"
          description="Sube únicamente imágenes libres de derechos de autor. Máximo 4MB; el logotipo final se recorta en cuadro."
        />

        {file ? (
          <Column gap="12" fillWidth horizontal="center">
            <ImageCropper
              file={file}
              exportRef={exportCrop}
              viewWidth={CROP_VIEW}
              viewHeight={CROP_VIEW}
              outputWidth={LOGO_SIDE}
              outputHeight={LOGO_SIDE}
              maxDataUrlChars={MAX_LOGO_DATA_URL_CHARS}
              maskShape="circle"
              ariaLabel="Arrastra la imagen para reencuadrar el logotipo"
            />
            <Button variant="tertiary" size="s" onClick={() => setFile(null)} disabled={saving}>
              Elegir otra imagen
            </Button>
          </Column>
        ) : (
          <Row fillWidth horizontal="center">
            <MediaUpload
              aspectRatio="1 / 1"
              maxWidth={16}
              accept="image/*"
              compress
              resizeMaxWidth={1024}
              resizeMaxHeight={1024}
              initialPreviewImage={logoUrl}
              emptyState="Arrastra una imagen o haz click para buscar"
              onFileUpload={async (selected) => {
                setError(null);
                setFile(selected);
              }}
            />
          </Row>
        )}

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          {logoUrl && (
            <Button variant="tertiary" size="m" onClick={() => persist(null)} disabled={saving}>
              Eliminar logotipo
            </Button>
          )}
          <Button variant="secondary" size="m" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleSave} loading={saving} disabled={!file}>
            Guardar logotipo
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

export function ProjectLogoControl({
  logoUrl,
  title,
  canEdit,
  onUpload,
  onSaved,
  size = "xl",
}: {
  logoUrl: string | null;
  title: string;
  canEdit: boolean;
  onUpload: (dataUrl: string | null) => Promise<UploadResult>;
  onSaved: () => void;
  size?: "xs" | "s" | "m" | "l" | "xl";
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const initial = (title[0] ?? "P").toUpperCase();
  const avatarProps: AvatarProps = logoUrl ? { src: logoUrl } : { value: initial };

  if (!canEdit) {
    return <Avatar {...avatarProps} size={size} />;
  }

  return (
    <>
      <AvatarEditButton
        avatarProps={avatarProps}
        size={size}
        ariaLabel="Cambiar logotipo del proyecto"
        onClick={() => setDialogOpen(true)}
      />
      <ProjectLogoEditDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        logoUrl={logoUrl}
        onUpload={onUpload}
        onSaved={onSaved}
      />
    </>
  );
}

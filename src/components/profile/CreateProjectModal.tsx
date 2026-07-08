"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Column,
  DateInput,
  Dialog,
  Feedback,
  Grid,
  Icon,
  IconButton,
  Input,
  Line,
  Row,
  ScrollLock,
  Select,
  SplitView,
  TagInput,
  Text,
} from "@once-ui-system/core";
import { createPortfolioPiece } from "@/app/actions/portfolioPieces";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { AttachFilesModal, type ProjectAttachment } from "./AttachFilesModal";
import {
  BLOCK_TYPES,
  ContentBlockCard,
  blocksToMarkdown,
  createBlock,
  type ContentBlock,
} from "./ContentBlocks";

const modalBackdrop = <BrandModalBackdrop />;

// El editor necesita mucho más espacio del que el <Modal> de Once UI permite
// (viene con maxWidth fijo en 52rem/832px, sin prop para cambiarlo). WideDialog
// replica su mismo shell —overlay, blur, portal, escape, click-outside— con
// un maxWidth configurable, usando exclusivamente átomos de Once UI.
// 108rem cubre con margen: 8 (padding externo) + 40*2 (padding interno "l") +
// 67.5 lienzo + 2 (gap) + 25 panel = ~100.5rem; sin el margen el panel se
// recortaba contra el borde derecho del diálogo.
const DIALOG_MAX_WIDTH = 108; // rem (1728px)
// SplitView reparte por proporción, no por px: ~72/28 replica el 1080/400
// anterior sobre el ancho útil del diálogo, con límites para que ninguno
// de los dos lados se aplaste al arrastrar el separador.
const SPLIT_DEFAULT = 0.72;
const SPLIT_MIN = 0.55;
const SPLIT_MAX = 0.85;
const MAX_TAGS = 5;

function hasForeignDialogOpen(ownDialog: HTMLElement | null): boolean {
  if (!ownDialog) return false;
  // Un modal/diálogo anidado (AttachFilesModal, la confirmación de cierre)
  // se porta a document.body como hermano del nuestro: si existe alguno que
  // no contenga nuestro panel, un click o Escape dentro de él no debe
  // interpretarse como "afuera" de este diálogo.
  return Array.from(document.querySelectorAll('[role="dialog"]')).some(
    (el) => !el.contains(ownDialog),
  );
}

interface WideDialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function WideDialog({ isOpen, onClose, children }: WideDialogProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const timeout = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (hasForeignDialogOpen(dialogRef.current)) return;
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // El Select (y otros dropdowns Once UI) se portan a document.body con
      // clase "dropdown-portal": sin esta excepción, elegir una opción cierra
      // el diálogo antes de que el onSelect llegue a procesarse.
      if (target.closest(".dropdown-portal")) return;
      const nearestDialog = target.closest('[role="dialog"]');
      // El click cayó dentro de OTRO diálogo (anidado) que no es el nuestro.
      if (nearestDialog && !nearestDialog.contains(dialogRef.current)) return;
      if (dialogRef.current && !dialogRef.current.contains(target)) onClose();
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
    }, 10);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && contentRef.current) contentRef.current.scrollTop = 0;
  }, [isOpen, children]);

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <>
      <ScrollLock enabled={isOpen} allowScrollInElement={contentRef} />
      <Row
        fill
        horizontal="center"
        paddingX="l"
        paddingTop="xl"
        position="fixed"
        background="overlay"
        // 9, no 10: mismo ajuste que Header.tsx — el dropdown-portal de Select
        // (Once UI, hardcoded a zIndex 9) pinta encima por ser posterior en el
        // DOM; con 10 el diálogo tapaba sus propias opciones de Select.
        zIndex={9}
        style={{
          backdropFilter: "blur(0.5rem)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
          inset: 0,
        }}
        role="dialog"
        aria-modal="true"
      >
        {modalBackdrop}
        <Column
          ref={dialogRef}
          maxWidth={DIALOG_MAX_WIDTH}
          fillHeight
          background="page"
          topRadius="xl"
          paddingX="8"
          borderX
          borderTop
          style={{
            transform: visible ? "translateY(0)" : "translateY(4rem)",
            transition: "transform 600ms ease",
          }}
        >
          <Column ref={contentRef} fill overflowY="auto" padding="l" tabIndex={-1}>
            <Row position="absolute" right="0" top="0" paddingTop="l" paddingRight="l" zIndex={2}>
              <IconButton
                icon="close"
                onClick={onClose}
                tooltip="Cerrar"
                tooltipPosition="left"
                variant="secondary"
              />
            </Row>
            {children}
          </Column>
        </Column>
      </Row>
    </>,
    document.body,
  );
}

// Tile de acción para agregar una sección al Canvas: icono arriba, etiqueta abajo.
function ContentTypeTile({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Column
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      horizontal="center"
      vertical="center"
      gap="8"
      paddingY="16"
      radius="m"
      border="neutral-alpha-weak"
      background="neutral-alpha-weak"
      style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={icon} size="m" onBackground="neutral-weak" />
      <Text variant="label-default-s" onBackground="neutral-weak" align="center">
        {label}
      </Text>
    </Column>
  );
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const markdown = useMemo(() => blocksToMarkdown(blocks), [blocks]);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [resourcePassword, setResourcePassword] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [tags, setTags] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [releaseDate, setReleaseDate] = useState<Date | undefined>(undefined);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [isAttachOpen, setAttachOpen] = useState(false);
  const [isConfirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"publish" | "draft" | null>(null);
  const disabled = saving !== null;

  const reset = () => {
    setTitle("");
    setBlocks([]);
    setDownloadUrl("");
    setResourcePassword("");
    setVisibility("public");
    setTags([]);
    setCollaborators([]);
    setReleaseDate(undefined);
    setAttachments([]);
    setError(null);
    setConfirmCloseOpen(false);
  };

  const handleSave = async (publish: boolean) => {
    if (!title.trim() || !markdown.trim()) {
      setError("El título y al menos una sección de contenido son obligatorios.");
      return;
    }
    setError(null);
    setSaving(publish ? "publish" : "draft");
    try {
      await createPortfolioPiece({
        title,
        content: markdown,
        downloadUrl: downloadUrl || undefined,
        resourcePassword: resourcePassword || undefined,
        isPublic: publish && visibility === "public",
        gallery: attachments.map((attachment) => attachment.url),
        tags,
        collaborators,
        releaseDate,
      });
      reset();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el proyecto.");
    } finally {
      setSaving(null);
    }
  };

  // Ya con archivos adjuntados, cerrar por accidente (click afuera, Escape o
  // la X) pierde ese avance: se advierte antes de salir en vez de cerrar directo.
  const handleAttemptClose = () => {
    if (disabled) return;
    if (attachments.length > 0) {
      setConfirmCloseOpen(true);
      return;
    }
    reset();
    onClose();
  };

  return (
    <>
      <WideDialog isOpen={isOpen} onClose={handleAttemptClose}>
        <Input
          id="project-title"
          placeholder="Nombre de tu proyecto"
          variant="ghost"
          height="xl"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          style={{ paddingRight: "4rem" }}
        />
        <SplitView
          fillWidth
          paddingTop="16"
          style={{ height: "44rem" }}
          defaultSplit={SPLIT_DEFAULT}
          minSplit={SPLIT_MIN}
          maxSplit={SPLIT_MAX}
          leftPanel={
            // Lienzo: contenedor propio, separado del panel lateral por el
            // divisor arrastrable de SplitView.
            <Card
              fillWidth
              padding="24"
              radius="l"
              direction="column"
              gap="12"
              border="neutral-alpha-weak"
              style={{ minHeight: "100%" }}
            >
              {blocks.length === 0 ? (
                <Column fillWidth fillHeight horizontal="center" vertical="center" gap="8">
                  <Text variant="body-default-s" onBackground="neutral-weak" align="center">
                    Usa los botones de &quot;Añadir contenido&quot; para construir tu proyecto.
                  </Text>
                </Column>
              ) : (
                blocks.map((block) => (
                  <ContentBlockCard
                    key={block.id}
                    block={block}
                    disabled={disabled}
                    onChange={(next) =>
                      setBlocks((current) => current.map((b) => (b.id === next.id ? next : b)))
                    }
                    onRemove={() =>
                      setBlocks((current) => current.filter((b) => b.id !== block.id))
                    }
                  />
                ))
              )}
            </Card>
          }
          rightPanel={
            <Column gap="16" paddingLeft="16">
            <Card fillWidth padding="16" radius="l" direction="column" gap="12">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Adjuntar archivos
              </Text>
              <Button
                fillWidth
                variant="secondary"
                prefixIcon="attach"
                onClick={() => setAttachOpen(true)}
                disabled={disabled}
              >
                Adjuntar archivo
              </Button>
              <Line background="neutral-alpha-weak" />
              <Text variant="body-default-xs" onBackground="neutral-weak">
                Añade archivos de fuentes, ilustraciones, fotos, o links para compartir.
              </Text>
            </Card>

            <Card fillWidth padding="16" radius="l" direction="column" gap="12">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Añadir contenido
              </Text>
              <Grid columns={2} gap="8">
                {BLOCK_TYPES.map(({ type, label, icon }) => (
                  <ContentTypeTile
                    key={type}
                    icon={icon}
                    label={label}
                    disabled={disabled}
                    onClick={() => setBlocks((current) => [...current, createBlock(type)])}
                  />
                ))}
              </Grid>
            </Card>

            <Card fillWidth padding="16" radius="l" direction="column" gap="12">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Editar proyecto
              </Text>
              <TagInput
                id="project-tags"
                label="Etiquetas"
                placeholder="Escribe y presiona coma (,) para agregar"
                description={`${tags.length}/${MAX_TAGS} etiquetas`}
                value={tags}
                onChange={(next) => setTags(next.slice(0, MAX_TAGS))}
                disabled={disabled}
              />
              <TagInput
                id="project-collaborators"
                label="Colaboradores"
                placeholder="Nombre de usuario y coma (,) para agregar"
                value={collaborators}
                onChange={setCollaborators}
                disabled={disabled}
              />
              <Row fillWidth gap="8" vertical="end">
                <Column fillWidth>
                  <DateInput
                    id="project-release-date"
                    label="Fecha de lanzamiento (opcional)"
                    value={releaseDate}
                    onChange={setReleaseDate}
                    disabled={disabled}
                  />
                </Column>
                {releaseDate && (
                  <IconButton
                    icon="close"
                    variant="tertiary"
                    tooltip="Quitar fecha"
                    onClick={() => setReleaseDate(undefined)}
                    disabled={disabled}
                  />
                )}
              </Row>
            </Card>

            <Card fillWidth padding="16" radius="l" direction="column" gap="12">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Recurso descargable
              </Text>
              <Input
                id="project-download-url"
                label="Enlace externo de descarga"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                disabled={disabled}
              />
              <Input
                id="project-resource-password"
                label="Contraseña del recurso"
                type="password"
                value={resourcePassword}
                onChange={(e) => setResourcePassword(e.target.value)}
                disabled={disabled}
              />
            </Card>

            <Card fillWidth padding="16" radius="l" direction="column" gap="12">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Privacidad
              </Text>
              <Select
                id="project-visibility"
                label="Visibilidad"
                options={[
                  { label: "Público", value: "public" },
                  { label: "Privado", value: "private" },
                ]}
                value={visibility}
                onSelect={(value) => setVisibility(value as "public" | "private")}
                fillWidth
                disabled={disabled}
              />
            </Card>

            {error && <Feedback variant="danger" description={error} />}

            <Column gap="8">
              <Button
                fillWidth
                variant="primary"
                onClick={() => handleSave(true)}
                loading={saving === "publish"}
                disabled={disabled}
              >
                Publicar proyecto
              </Button>
              <Button
                fillWidth
                variant="secondary"
                onClick={() => handleSave(false)}
                loading={saving === "draft"}
                disabled={disabled}
              >
                Guardar como borrador
              </Button>
            </Column>
            </Column>
          }
        />
      </WideDialog>

      <AttachFilesModal
        isOpen={isAttachOpen}
        onClose={() => setAttachOpen(false)}
        initialAttachments={attachments}
        onConfirm={setAttachments}
      />

      <Dialog
        isOpen={isConfirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title="¿Cerrar el editor de proyectos?"
        description="Ya adjuntaste archivos a este proyecto. Si cierras sin guardar, ese avance se pierde."
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={() => setConfirmCloseOpen(false)}>
              Seguir editando
            </Button>
            <Button
              variant="primary"
              size="m"
              onClick={() => handleSave(false)}
              loading={saving === "draft"}
            >
              Guardar en borradores
            </Button>
          </Row>
        }
      />
    </>
  );
}

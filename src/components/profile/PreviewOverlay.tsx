"use client";

import { Column, Feedback, IconButton, Row, ScrollLock, Spinner, Text } from "@once-ui-system/core";
import { MDXRemote } from "next-mdx-remote";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { PieceAttachment } from "@/app/actions/portfolioPieces";
import { type SerializePreviewMdxResult, serializePreviewMdx } from "@/app/actions/mdxPreview";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { MediaGuard } from "@/components/MediaGuard";
import { buildComponents } from "@/components/mdx-shared";
import { CarouselPreviewMode } from "@/components/originkit/CarouselPreview";
import { AppearanceScope } from "@/components/profile/AppearanceScope";

// FEATURE (botón "Previsualizar" del editor): ventana flotante SOBRE el
// editor (CreateProjectModal.tsx) con el render REAL del visor público — no
// una aproximación en el propio lienzo. Mismo shell que `WideDialog` (mismo
// archivo): overlay con blur, portal a `document.body`, Escape y
// click-afuera — pero a `zIndex={10}` (uno más que el `9` de WideDialog, ver
// comentario ahí) para quedar ENCIMA del editor, y con `role="dialog"`
// propio: `hasForeignDialogOpen`/`handleClickOutside` de WideDialog ya
// recorren TODO `[role="dialog"]` del documento buscando uno que no los
// contenga — con este overlay montado como hermano (portal), WideDialog lo
// detecta como diálogo "ajeno" y NO se cierra por Escape ni por click afuera
// mientras esté abierto (verificado en navegador, ver reporte de la tarea).
// Escape/click-afuera de ESTE componente solo cierran el overlay.
// `Extract` se queda con la rama "éxito" de la unión (la que trae
// `compiledSource`), descartando `{ error: string }`.
type PreviewReadyResult = Extract<SerializePreviewMdxResult, { compiledSource: string }>;

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: PreviewReadyResult };

interface PreviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  // Markdown/MDX EFECTIVO ya calculado por el padre (blocksToMarkdown(blocks)
  // en Asistido, proMarkdown en Pro — ver `getEffectiveContent` en
  // CreateProjectModal.tsx). Se recalcula SOLO al abrir/cambiar, nunca en
  // cada tecla del editor de fondo.
  markdown: string;
  // Modo Pro: mismos adjuntos con nombre que ya usa `CustomMDX` (ver
  // buildComponents/resolveAttachmentSrc en mdx-shared.tsx) — sin ellos,
  // `<Media src="nombre-del-adjunto" />` no resolvería a ninguna URL real.
  attachments: PieceAttachment[];
}

export function PreviewOverlay({ isOpen, onClose, markdown, attachments }: PreviewOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setMounted(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({ status: "loading" });
    serializePreviewMdx(markdown)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setState({ status: "error", message: result.error });
          return;
        }
        setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "No se pudo generar la vista previa. Intenta de nuevo.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, markdown]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (dialogRef.current && !dialogRef.current.contains(target)) return;
      if (contentRef.current && !contentRef.current.contains(target)) onClose();
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, { capture: true });
    }, 10);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
    };
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const mergedComponents = buildComponents(attachments);

  return ReactDOM.createPortal(
    <>
      <ScrollLock enabled={isOpen} allowScrollInElement={contentRef} />
      <Row
        fill
        horizontal="center"
        position="fixed"
        background="overlay"
        zIndex={10}
        style={{
          backdropFilter: "blur(0.5rem)",
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 200ms ease",
          inset: 0,
          padding: "16px",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa del proyecto"
        ref={dialogRef}
      >
        <BrandModalBackdrop />
        <Column
          fillHeight
          maxWidth="s"
          fillWidth
          background="page"
          radius="xl"
          border="neutral-alpha-medium"
          overflow="hidden"
          style={{
            transform: isOpen ? "translateY(0)" : "translateY(2rem)",
            transition: "transform 300ms ease",
          }}
        >
          <Row
            fillWidth
            horizontal="between"
            vertical="center"
            paddingX="20"
            paddingY="16"
            border="neutral-alpha-medium"
            style={{ borderWidth: "0 0 1px 0" }}
          >
            <Text variant="label-strong-m">Vista previa</Text>
            <IconButton icon="close" variant="secondary" tooltip="Cerrar" onClick={onClose} />
          </Row>
          <Column ref={contentRef} fillWidth flex={1} overflowY="auto" padding="32">
            {state.status === "loading" && (
              <Row fill horizontal="center" vertical="center">
                <Spinner size="m" />
              </Row>
            )}
            {state.status === "error" && (
              <Feedback
                variant="danger"
                title="No se pudo compilar el contenido"
                description={state.message}
              />
            )}
            {state.status === "ready" &&
              (() => {
                // `appearance` viaja pegado al resultado de la server action
                // (ver serializePreviewMdx) pero NO es un prop de
                // `MDXRemoteProps` — se separa antes de esparcir el resto
                // (compiledSource/scope/frontmatter) sobre `<MDXRemote>`.
                const { appearance, ...serialized } = state.result;
                return (
                  <AppearanceScope appearance={appearance}>
                    <Column style={{ margin: "auto" }} as="article" maxWidth="xs" gap="16">
                      <CarouselPreviewMode mode="viewer">
                        <MediaGuard>
                          <MDXRemote {...serialized} components={mergedComponents} />
                        </MediaGuard>
                      </CarouselPreviewMode>
                    </Column>
                  </AppearanceScope>
                );
              })()}
          </Column>
        </Column>
      </Row>
    </>,
    document.body,
  );
}

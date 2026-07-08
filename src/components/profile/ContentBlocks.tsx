"use client";

import { Button, Column, Icon, IconButton, Input, Row, Select, Text, Textarea } from "@once-ui-system/core";

// El Canvas no edita un .md crudo: el usuario arma bloques estructurados y
// estos se serializan a Markdown (texto plano) tras bambalinas al guardar.
export type ContentBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "carousel"; images: { id: string; url: string; alt: string }[] }
  | { id: string; type: "compare"; beforeUrl: string; afterUrl: string }
  | { id: string; type: "embed"; language: string; code: string }
  | { id: string; type: "link"; url: string; label: string }
  | { id: string; type: "media"; kind: "audio" | "video"; url: string };

export type ContentBlockType = ContentBlock["type"];

export const BLOCK_TYPES: { type: ContentBlockType; label: string; icon: string }[] = [
  { type: "image", label: "Imagen", icon: "images" },
  { type: "text", label: "Texto", icon: "document" },
  { type: "carousel", label: "Carousel de fotos", icon: "carousel" },
  { type: "compare", label: "Comparador", icon: "compare" },
  { type: "embed", label: "Incrustar", icon: "codeBracket" },
  { type: "link", label: "Links", icon: "openLink" },
  { type: "media", label: "Multimedia", icon: "film" },
];

const BLOCK_LABEL: Record<ContentBlockType, string> = Object.fromEntries(
  BLOCK_TYPES.map((b) => [b.type, b.label]),
) as Record<ContentBlockType, string>;

const BLOCK_ICON: Record<ContentBlockType, string> = Object.fromEntries(
  BLOCK_TYPES.map((b) => [b.type, b.icon]),
) as Record<ContentBlockType, string>;

function newId(): string {
  return crypto.randomUUID();
}

export function createBlock(type: ContentBlockType): ContentBlock {
  switch (type) {
    case "text":
      return { id: newId(), type, text: "" };
    case "image":
      return { id: newId(), type, url: "", alt: "" };
    case "carousel":
      return { id: newId(), type, images: [{ id: newId(), url: "", alt: "" }] };
    case "compare":
      return { id: newId(), type, beforeUrl: "", afterUrl: "" };
    case "embed":
      return { id: newId(), type, language: "", code: "" };
    case "link":
      return { id: newId(), type, url: "", label: "" };
    case "media":
      return { id: newId(), type, kind: "video", url: "" };
  }
}

function blockToMarkdown(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return block.text.trim();
    case "image":
      return block.url ? `![${block.alt}](${block.url})` : "";
    case "carousel": {
      const lines = block.images.filter((i) => i.url).map((i) => `![${i.alt}](${i.url})`);
      return lines.length > 0 ? `<!-- carousel -->\n${lines.join("\n")}` : "";
    }
    case "compare": {
      if (!block.beforeUrl && !block.afterUrl) return "";
      return `<!-- compare -->\n![antes](${block.beforeUrl})\n![después](${block.afterUrl})`;
    }
    case "embed":
      return block.code.trim() ? `\`\`\`${block.language}\n${block.code}\n\`\`\`` : "";
    case "link":
      return block.url ? `[${block.label || block.url}](${block.url})` : "";
    case "media":
      if (!block.url) return "";
      return block.kind === "video"
        ? `<video src="${block.url}" controls></video>`
        : `<audio src="${block.url}" controls></audio>`;
  }
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map(blockToMarkdown)
    .filter((text) => text.trim() !== "")
    .join("\n\n");
}

interface ContentBlockCardProps {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ContentBlockCard({ block, onChange, onRemove, disabled }: ContentBlockCardProps) {
  return (
    <Column
      fillWidth
      gap="12"
      padding="16"
      radius="m"
      border="neutral-alpha-weak"
      background="neutral-alpha-weak"
    >
      <Row fillWidth horizontal="between" vertical="center">
        <Row gap="8" vertical="center">
          <Icon name={BLOCK_ICON[block.type]} size="s" onBackground="neutral-weak" />
          <Text variant="label-strong-s" onBackground="neutral-weak">
            {BLOCK_LABEL[block.type]}
          </Text>
        </Row>
        <IconButton
          icon="close"
          variant="tertiary"
          size="s"
          tooltip="Quitar sección"
          onClick={onRemove}
          disabled={disabled}
        />
      </Row>

      {block.type === "text" && (
        <Textarea
          id={`block-${block.id}-text`}
          placeholder="Escribe el texto de esta sección…"
          variant="ghost"
          lines="auto"
          resize="none"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          disabled={disabled}
        />
      )}

      {block.type === "image" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-url`}
            label="URL de la imagen"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-alt`}
            label="Texto alternativo"
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {block.type === "carousel" && (
        <Column gap="8">
          {block.images.map((image, index) => (
            <Row key={image.id} gap="8" vertical="end">
              <Input
                id={`block-${block.id}-${image.id}-url`}
                label={`Imagen ${index + 1}`}
                value={image.url}
                onChange={(e) =>
                  onChange({
                    ...block,
                    images: block.images.map((i) =>
                      i.id === image.id ? { ...i, url: e.target.value } : i,
                    ),
                  })
                }
                disabled={disabled}
              />
              <Input
                id={`block-${block.id}-${image.id}-alt`}
                label="Alt"
                value={image.alt}
                onChange={(e) =>
                  onChange({
                    ...block,
                    images: block.images.map((i) =>
                      i.id === image.id ? { ...i, alt: e.target.value } : i,
                    ),
                  })
                }
                disabled={disabled}
              />
              <IconButton
                icon="close"
                variant="tertiary"
                size="s"
                tooltip="Quitar imagen"
                disabled={disabled || block.images.length <= 1}
                onClick={() =>
                  onChange({ ...block, images: block.images.filter((i) => i.id !== image.id) })
                }
              />
            </Row>
          ))}
          <Button
            variant="tertiary"
            size="s"
            prefixIcon="plus"
            disabled={disabled}
            onClick={() =>
              onChange({ ...block, images: [...block.images, { id: newId(), url: "", alt: "" }] })
            }
          >
            Agregar imagen
          </Button>
        </Column>
      )}

      {block.type === "compare" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-before`}
            label="Imagen antes"
            value={block.beforeUrl}
            onChange={(e) => onChange({ ...block, beforeUrl: e.target.value })}
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-after`}
            label="Imagen después"
            value={block.afterUrl}
            onChange={(e) => onChange({ ...block, afterUrl: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {block.type === "embed" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-language`}
            label="Lenguaje (opcional)"
            value={block.language}
            onChange={(e) => onChange({ ...block, language: e.target.value })}
            disabled={disabled}
          />
          <Textarea
            id={`block-${block.id}-code`}
            label="Código"
            variant="ghost"
            lines="auto"
            resize="none"
            style={{ fontFamily: "var(--font-code)" }}
            value={block.code}
            onChange={(e) => onChange({ ...block, code: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {block.type === "link" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-label`}
            label="Texto del enlace"
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-url`}
            label="URL"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {block.type === "media" && (
        <Column gap="8">
          <Select
            id={`block-${block.id}-kind`}
            label="Tipo"
            options={[
              { label: "Video", value: "video" },
              { label: "Audio", value: "audio" },
            ]}
            value={block.kind}
            onSelect={(value) => onChange({ ...block, kind: value as "audio" | "video" })}
            fillWidth
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-url`}
            label="URL del archivo"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}
    </Column>
  );
}

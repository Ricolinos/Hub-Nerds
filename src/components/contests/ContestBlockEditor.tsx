"use client";

import { Button, Column, IconButton, Input, Line, Row, Text, Textarea } from "@once-ui-system/core";
import { type ContestBlock, type ContestBlockType, createContestBlock } from "@/lib/contestBrief";

/* ══ Editor de bloques del wizard de convocatorias ═══════════════════════
   Autocontenido: NO depende de src/components/profile/ContentBlocks.tsx
   (el Canvas del freelancer) — ver el comentario extenso en
   src/lib/contestBrief.ts sobre por qué (RSC boundary confirmado en
   runtime). Mismo espíritu de UX (tarjetas con mover arriba/abajo/eliminar,
   botones "+" para añadir tipo de bloque) pero con un modelo de datos
   propio, minimalista, pensado para texto estructurado (brief/cláusulas),
   no para una pieza de portafolio con medios. ═══════════════════════════ */

const ADD_OPTIONS: { type: ContestBlockType; label: string; icon: string }[] = [
  { type: "paragraph", label: "Párrafo", icon: "document" },
  { type: "section", label: "Nueva sección", icon: "plus" },
  { type: "divider", label: "Divisor", icon: "minus" },
];

const BLOCK_LABEL: Record<ContestBlockType, string> = {
  paragraph: "Párrafo",
  section: "Sección",
  divider: "Divisor",
};

function ContestBlockRow({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  block: ContestBlock;
  onChange: (block: ContestBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <Column fillWidth gap="8" padding="16" radius="m" border="neutral-alpha-weak" background="page">
      <Row fillWidth horizontal="between" vertical="center">
        <Text variant="label-strong-s" onBackground="neutral-weak">
          {BLOCK_LABEL[block.type]}
        </Text>
        <Row gap="4">
          <IconButton
            icon="chevronUp"
            variant="tertiary"
            size="s"
            tooltip="Mover arriba"
            onClick={onMoveUp}
            disabled={!canMoveUp}
          />
          <IconButton
            icon="chevronDown"
            variant="tertiary"
            size="s"
            tooltip="Mover abajo"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          />
          <IconButton icon="trash" variant="tertiary" size="s" tooltip="Eliminar" onClick={onRemove} />
        </Row>
      </Row>

      {block.type === "paragraph" && (
        <Textarea
          id={`contest-block-${block.id}`}
          value={block.content}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
          lines={4}
          placeholder="Escribe un párrafo..."
        />
      )}
      {block.type === "section" && (
        <Input
          id={`contest-block-${block.id}`}
          placeholder="Título de la sección"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      )}
      {block.type === "divider" && <Line background="neutral-alpha-medium" />}
    </Column>
  );
}

export function ContestBlockEditor({
  value,
  onChange,
  disabled,
  emptyHint,
}: {
  value: ContestBlock[];
  onChange: (blocks: ContestBlock[]) => void;
  disabled?: boolean;
  emptyHint: string;
}) {
  const addBlock = (type: ContestBlockType) => {
    onChange([...value, createContestBlock(type)]);
  };

  const updateBlock = (index: number, block: ContestBlock) => {
    const next = [...value];
    next[index] = block;
    onChange(next);
  };

  const removeBlock = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= value.length) return;
    const next = [...value];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  };

  return (
    <Column fillWidth gap="12">
      {value.length === 0 && (
        <Text variant="body-default-s" onBackground="neutral-weak">
          {emptyHint}
        </Text>
      )}
      {value.map((block, index) => (
        <ContestBlockRow
          key={block.id}
          block={block}
          onChange={(next) => updateBlock(index, next)}
          onRemove={() => removeBlock(index)}
          onMoveUp={() => moveBlock(index, "up")}
          onMoveDown={() => moveBlock(index, "down")}
          canMoveUp={index > 0}
          canMoveDown={index < value.length - 1}
        />
      ))}
      <Row gap="8" wrap>
        {ADD_OPTIONS.map(({ type, label, icon }) => (
          <Button
            key={type}
            variant="secondary"
            size="s"
            prefixIcon={icon}
            onClick={() => addBlock(type)}
            disabled={disabled}
          >
            {label}
          </Button>
        ))}
      </Row>
    </Column>
  );
}

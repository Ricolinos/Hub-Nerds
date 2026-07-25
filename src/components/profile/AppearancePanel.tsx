"use client";

import { Button, Column, Row, Scroller, Text } from "@once-ui-system/core";
import classNames from "classnames";
import styles from "./AppearancePanel.module.scss";

// Editor de la apariencia DEL PERFIL de un Freelancer (marca, acento y neutro),
// persistida en BD vía updateProfileAppearance — NO toca el estilo global
// del sitio (fijo en once-ui.config.ts, ver Header.tsx). Un valor `null` en
// cualquier campo significa "sin override": el perfil hereda la marca
// Hub-Nerds. El control de "Forma" (border) se quitó a propósito: los
// bordes de /explorar/designerds no se personalizan, para mantener
// consistencia visual entre tarjetas (el campo profileBorder queda inerte
// en BD). La fila "Tema" del viejo StylePanel se quitó de aquí: el tema
// claro/oscuro/sistema es preferencia del VISITANTE, no del dueño del
// perfil, y ahora vive en el menú del avatar del Header.

// Whitelist idéntica a PROFILE_BRAND_COLORS/PROFILE_NEUTRAL_COLORS en
// src/app/actions/updateProfile.ts.
const SCHEMES = [
  "blue",
  "indigo",
  "violet",
  "magenta",
  "pink",
  "red",
  "orange",
  "yellow",
  "moss",
  "green",
  "emerald",
  "aqua",
  "cyan",
] as const;
const NEUTRALS = ["gray", "sand", "slate", "dusk", "mint", "rose"] as const;

export interface ProfileAppearanceValue {
  brand: string | null;
  accent: string | null;
  neutral: string | null;
}

const EMPTY_APPEARANCE: ProfileAppearanceValue = {
  brand: null,
  accent: null,
  neutral: null,
};

function ColorRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: readonly string[];
  value: string | null;
  onSelect: (color: string) => void;
}) {
  return (
    <Row
      fillWidth
      horizontal="between"
      vertical="center"
      paddingX="20"
      paddingY="12"
      gap="24"
      borderBottom="neutral-alpha-medium"
    >
      <Text variant="label-default-s" onBackground="neutral-strong" style={{ minWidth: 48 }}>
        {label}
      </Text>
      <Scroller minWidth={0} fitWidth>
        {options.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label}: ${color}`}
            className={classNames(styles.select, value === color && styles.selected)}
            onClick={() => onSelect(color)}
          >
            <div
              className={styles.swatch}
              style={{
                background: `var(--scheme-${color}-500)`,
                borderColor: `var(--scheme-${color}-700)`,
              }}
            />
          </button>
        ))}
      </Scroller>
    </Row>
  );
}

export function AppearancePanel({
  value,
  onChange,
}: {
  value: ProfileAppearanceValue;
  onChange: (next: ProfileAppearanceValue) => void;
}) {
  const hasOverride = Boolean(value.brand || value.accent || value.neutral);

  return (
    <Column fillWidth gap="16">
      {/* El título/descripción de esta sección ya los pinta el contenedor
          genérico de FreelancerEditInfoDialog (FREELANCER_EDIT_SECTIONS); solo el
          botón de reset va aquí, alineado a la derecha. */}
      <Row fillWidth horizontal="end">
        <Button
          size="s"
          variant="tertiary"
          prefixIcon="refresh"
          disabled={!hasOverride}
          onClick={() => onChange(EMPTY_APPEARANCE)}
        >
          Restablecer a la marca Hub-Nerds
        </Button>
      </Row>

      <Column fillWidth gap="4" paddingTop="8">
        <Text variant="label-strong-s">Color</Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Esquemas de marca, acento y neutro.
        </Text>
      </Column>
      <Column fillWidth border="neutral-alpha-medium" radius="l">
        <ColorRow
          label="Marca"
          options={SCHEMES}
          value={value.brand}
          onSelect={(c) => onChange({ ...value, brand: c })}
        />
        <ColorRow
          label="Acento"
          options={SCHEMES}
          value={value.accent}
          onSelect={(c) => onChange({ ...value, accent: c })}
        />
        <Row fillWidth horizontal="between" vertical="center" paddingX="20" paddingY="12" gap="24">
          <Text variant="label-default-s" onBackground="neutral-strong" style={{ minWidth: 48 }}>
            Neutro
          </Text>
          <Row gap="4">
            {NEUTRALS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Neutro: ${color}`}
                className={classNames(styles.select, value.neutral === color && styles.selected)}
                onClick={() => onChange({ ...value, neutral: color })}
              >
                <div
                  className={styles.swatch}
                  style={{
                    background: `var(--scheme-${color}-500)`,
                    borderColor: `var(--scheme-${color}-700)`,
                  }}
                />
              </button>
            ))}
          </Row>
        </Row>
      </Column>
    </Column>
  );
}

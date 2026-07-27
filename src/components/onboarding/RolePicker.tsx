"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Column, Icon, IconButton, Input, Row, Tag, Text } from "@once-ui-system/core";
import { FREELANCER_ROLE_GROUPS } from "@/lib/freelancerRoles";

interface RolePickerProps {
  id: string;
  /** Valor único, o lista cuando `multiple`. */
  value: string | string[];
  onChange: (value: string) => void;
  placeholder: string;
  multiple?: boolean;
  /** Roles que no deben ofrecerse (p. ej. el principal en el selector de secundarias). */
  exclude?: string[];
  /** Tope de selección en modo múltiple. */
  max?: number;
  disabled?: boolean;
}

/* Selector de profesión de la bienvenida.
 *
 * El `Select` de Once UI con `searchable` deja el campo de búsqueda DENTRO del
 * disparador, así que el control parece un input de texto libre: uno hace clic
 * esperando escribir y en su lugar se despliega una lista, y lo que escribe
 * termina filtrando desde dentro de una de las opciones. Confuso.
 *
 * Aquí la separación es explícita: el disparador es claramente una lista
 * desplegable (no editable, con flecha que gira), y la búsqueda vive dentro
 * del panel, donde ya se entiende que sirve para filtrar lo que se ve.
 *
 * El panel se expande EN FLUJO (no portal, no position:absolute): así no lo
 * recorta ningún contenedor con overflow ni pelea z-index con nada. */
export function RolePicker({
  id,
  value,
  onChange,
  placeholder,
  multiple = false,
  exclude = [],
  max,
  disabled = false,
}: RolePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );
  const atLimit = multiple && max !== undefined && selected.length >= max;

  // Cierra al hacer clic fuera. El panel vive en el flujo, así que basta con
  // comprobar contención real en el DOM.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const normalized = query.trim().toLowerCase();
  const groups = FREELANCER_ROLE_GROUPS.map((group) => ({
    label: group.label,
    roles: group.roles.filter(
      (role) =>
        !exclude.includes(role) && (normalized === "" || role.toLowerCase().includes(normalized)),
    ),
  })).filter((group) => group.roles.length > 0);

  const triggerLabel = multiple
    ? selected.length > 0
      ? `${selected.length} seleccionada${selected.length > 1 ? "s" : ""}`
      : placeholder
    : (value as string) || placeholder;
  const isPlaceholder = multiple ? selected.length === 0 : !value;

  return (
    <Column ref={containerRef} fillWidth gap="8">
      <Row
        id={id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        fillWidth
        horizontal="between"
        vertical="center"
        gap="12"
        paddingX="16"
        paddingY="12"
        radius="l"
        border="neutral-medium"
        background="neutral-alpha-weak"
        cursor={disabled ? "not-allowed" : "interactive"}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{ minWidth: 0, opacity: disabled ? 0.6 : 1 }}
      >
        <Text
          variant="body-default-m"
          onBackground={isPlaceholder ? "neutral-weak" : "neutral-strong"}
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {triggerLabel}
        </Text>
        <Icon
          name="chevronDown"
          size="xs"
          onBackground="neutral-weak"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        />
      </Row>

      {/* Selección múltiple visible como etiquetas quitables */}
      {multiple && selected.length > 0 && (
        <Row fillWidth gap="8" wrap>
          {selected.map((role) => (
            <Row key={role} gap="4" vertical="center">
              <Tag label={role} variant="brand" />
              <IconButton
                icon="xCircle"
                variant="tertiary"
                size="s"
                tooltip={`Quitar ${role}`}
                onClick={() => onChange(role)}
              />
            </Row>
          ))}
        </Row>
      )}

      {open && (
        <Column
          fillWidth
          gap="4"
          padding="8"
          radius="l"
          border="neutral-alpha-medium"
          background="surface"
          maxHeight={20}
          overflowY="auto"
        >
          <Input
            id={`${id}-search`}
            height="s"
            placeholder="Buscar…"
            value={query}
            hasPrefix={<Icon name="search" size="xs" onBackground="neutral-weak" />}
            onChange={(e) => setQuery(e.target.value)}
          />

          {groups.length === 0 && (
            <Row paddingX="12" paddingY="12">
              <Text variant="body-default-s" onBackground="neutral-weak">
                No encontramos esa profesión
              </Text>
            </Row>
          )}

          {groups.map((group) => (
            <Column key={group.label} fillWidth gap="2">
              <Row paddingX="12" paddingTop="12" paddingBottom="4">
                <Text variant="label-default-xs" onBackground="neutral-weak">
                  {group.label}
                </Text>
              </Row>
              {group.roles.map((role) => {
                const isSelected = selected.includes(role);
                const blocked = atLimit && !isSelected;
                return (
                  <Row
                    key={role}
                    role="option"
                    aria-selected={isSelected}
                    fillWidth
                    horizontal="between"
                    vertical="center"
                    gap="8"
                    paddingX="12"
                    paddingY="8"
                    radius="m"
                    background={isSelected ? "brand-alpha-weak" : "transparent"}
                    cursor={blocked ? "not-allowed" : "interactive"}
                    onClick={() => {
                      if (blocked) return;
                      onChange(role);
                      if (!multiple) {
                        setOpen(false);
                        setQuery("");
                      }
                    }}
                    style={{ minWidth: 0, opacity: blocked ? 0.4 : 1 }}
                  >
                    <Text
                      variant="body-default-s"
                      onBackground={isSelected ? "brand-strong" : "neutral-strong"}
                      style={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {role}
                    </Text>
                    {isSelected && <Icon name="check" size="xs" onBackground="brand-strong" />}
                  </Row>
                );
              })}
            </Column>
          ))}
        </Column>
      )}
    </Column>
  );
}

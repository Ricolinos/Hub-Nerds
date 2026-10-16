"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Column, DropdownWrapper, Icon, Option, Row, Text } from "@once-ui-system/core";
import { SearchBarShell } from "@/components/explore/SearchBarShell";
import { RESOURCE_CATEGORY_SLUGS } from "./categories";
import { ALL_APPS, ALL_FORMATS, ALL_ORIENTATIONS, useResourceSearch } from "./SearchContext";

const CATEGORY_LINKS = [
  { label: "Todos", href: "/recursos" },
  ...Object.entries(RESOURCE_CATEGORY_SLUGS).map(([slug, label]) => ({
    label,
    href: `/recursos/${slug}`,
  })),
];

const ORIENTATION_OPTIONS = [ALL_ORIENTATIONS, "Horizontal", "Vertical", "Cuadrada"];
const FORMAT_OPTIONS = [ALL_FORMATS, "JPG", "PNG"];
const APP_OPTIONS = [ALL_APPS, "Figma", "Photoshop", "Illustrator", "After Effects", "Sketch", "Adobe XD", "Blender"];

function CategoryDropdown() {
  const pathname = usePathname() ?? "/recursos";
  const [open, setOpen] = useState(false);
  const current = CATEGORY_LINKS.find((link) => link.href === pathname) ?? CATEGORY_LINKS[0];

  return (
    <DropdownWrapper
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Row vertical="center" gap="4" paddingX="4" style={{ cursor: "pointer" }}>
          <Text variant="label-default-s" onBackground="neutral-strong">
            {current.label}
          </Text>
          <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
        </Row>
      }
      dropdown={
        <Column minWidth={10} padding="4" gap="2">
          {CATEGORY_LINKS.map((link) => (
            <Option
              key={link.href}
              href={link.href}
              label={link.label}
              value={link.href}
              selected={pathname === link.href}
              onLinkClick={() => setOpen(false)}
            />
          ))}
        </Column>
      }
    />
  );
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = value !== options[0];

  return (
    <DropdownWrapper
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant={isActive ? "secondary" : "tertiary"} size="s" suffixIcon="chevronDown">
          {isActive ? `${label}: ${value}` : label}
        </Button>
      }
      dropdown={
        <Column minWidth={10} padding="4" gap="2">
          {options.map((option) => (
            <Option
              key={option}
              label={option}
              value={option}
              selected={value === option}
              onClick={(selectedValue) => {
                onChange(selectedValue);
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

export function ResourceSearchBar() {
  const { query, setQuery, format, setFormat, orientation, setOrientation, app, setApp } = useResourceSearch();

  return (
    <Column fillWidth gap="12">
      <SearchBarShell
        leading={<CategoryDropdown />}
        query={query}
        onQueryChange={setQuery}
        placeholder="Buscar mockups, plug-ins, imágenes, fotos e iconos…"
        ariaLabel="Buscar recursos"
      />

      <Row gap="8" wrap>
        <FilterDropdown label="Orientación" options={ORIENTATION_OPTIONS} value={orientation} onChange={setOrientation} />
        <FilterDropdown label="Formato" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
        <FilterDropdown label="Aplicación soportada" options={APP_OPTIONS} value={app} onChange={setApp} />
      </Row>
    </Column>
  );
}

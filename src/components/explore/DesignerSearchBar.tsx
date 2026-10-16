"use client";

import { useState } from "react";
import { Column, DropdownWrapper, Icon, Option, Row, Text } from "@once-ui-system/core";
import { ALL_SPECIALTIES, useExploreSearch } from "./SearchContext";
import { SearchBarShell } from "./SearchBarShell";

const SPECIALTY_OPTIONS = [ALL_SPECIALTIES, "Animador", "Diseñador de Marca", "Producción técnica", "Ilustrador"];

function SpecialtyDropdown() {
  const { specialty, setSpecialty } = useExploreSearch();
  const [open, setOpen] = useState(false);

  return (
    <DropdownWrapper
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Row vertical="center" gap="4" paddingX="4" style={{ cursor: "pointer" }}>
          <Text variant="label-default-s" onBackground="neutral-strong">
            {specialty}
          </Text>
          <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
        </Row>
      }
      dropdown={
        <Column minWidth={10} padding="4" gap="2">
          {SPECIALTY_OPTIONS.map((option) => (
            <Option
              key={option}
              label={option}
              value={option}
              selected={specialty === option}
              onClick={(value) => {
                setSpecialty(value);
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

export function DesignerSearchBar() {
  const { query, setQuery } = useExploreSearch();

  return (
    <SearchBarShell
      leading={<SpecialtyDropdown />}
      query={query}
      onQueryChange={setQuery}
      placeholder="Buscar diseñadores por nombre o rol…"
      ariaLabel="Buscar diseñadores"
    />
  );
}

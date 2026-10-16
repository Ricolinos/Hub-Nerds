"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Column, DropdownWrapper, Icon, Option, Row, Text } from "@once-ui-system/core";
import { FEED_CATEGORY_SLUGS } from "./categories";
import { useExploreSearch } from "./SearchContext";
import { SearchBarShell } from "./SearchBarShell";

const CATEGORY_LINKS = [
  { label: "Todos", href: "/explorar" },
  ...Object.entries(FEED_CATEGORY_SLUGS).map(([slug, label]) => ({
    label,
    href: `/explorar/${slug}`,
  })),
];

function CategoryDropdown() {
  const pathname = usePathname() ?? "/explorar";
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

export function ExploreSearchBar() {
  const { query, setQuery } = useExploreSearch();

  return (
    <SearchBarShell
      leading={<CategoryDropdown />}
      query={query}
      onQueryChange={setQuery}
      placeholder="Buscar diseñadores, proyectos y publicaciones…"
      ariaLabel="Buscar en Explorar"
    />
  );
}

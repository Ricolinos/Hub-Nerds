"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Accordion, Button, Column, Icon, Line, RevealFx, Row, SmartLink } from "@once-ui-system/core";
import { FEED_CATEGORY_SLUGS } from "./categories";

const CATEGORY_LINKS = [
  { label: "Todos", href: "/explorar" },
  ...Object.entries(FEED_CATEGORY_SLUGS).map(([slug, label]) => ({
    label,
    href: `/explorar/${slug}`,
  })),
];

export function Sidebar() {
  const pathname = usePathname() ?? "/explorar";
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  return (
    <Column
      radius="m"
      border="neutral-alpha-medium"
      style={{ width: 260, flexShrink: 0 }}
      s={{ hide: true }}
    >
      <RevealFx fillWidth direction="column" translateY="8">
        <Accordion title="Categorías" open={categoriesOpen} onToggle={() => setCategoriesOpen((prev) => !prev)}>
          <Column gap="4" paddingTop="8">
            {CATEGORY_LINKS.map(({ label, href }) => (
              <Button
                key={href}
                href={href}
                variant={pathname === href ? "secondary" : "tertiary"}
                size="s"
                fillWidth
                horizontal="start"
              >
                {label}
              </Button>
            ))}
          </Column>
        </Accordion>
        <Line background="neutral-alpha-medium" />
        <Column>
          <SmartLink href="/explorar/freelancers" unstyled style={{ width: "100%" }}>
            <Row
              fillWidth
              vertical="center"
              horizontal="between"
              paddingY="12"
              paddingX="16"
              radius="m"
              cursor="interactive"
              transition="macro-medium"
            >
              <Row fillWidth textVariant="heading-strong-s">
                Freelancers
              </Row>
              <Icon name="arrowUpRightFromSquare" size="s" onBackground="neutral-weak" />
            </Row>
          </SmartLink>
        </Column>
      </RevealFx>
    </Column>
  );
}

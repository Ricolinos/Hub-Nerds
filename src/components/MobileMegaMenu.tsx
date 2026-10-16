"use client";

import React from "react";
import { Icon, Column, Flex, Line, Option, Accordion, ElementType, Text } from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface MenuLink {
  label: React.ReactNode;
  href: string;
  icon?: IconName;
  description?: React.ReactNode;
  selected?: boolean;
}

interface MenuDivider {
  divider: true;
}

type MenuSectionItem = MenuLink | MenuDivider;

function isMenuDivider(item: MenuSectionItem): item is MenuDivider {
  return "divider" in item && item.divider === true;
}

interface MenuSection {
  title?: React.ReactNode;
  links: MenuSectionItem[];
}

interface MenuGroup {
  id: string;
  label: React.ReactNode;
  suffixIcon?: IconName;
  href?: string;
  selected?: boolean;
  sections?: MenuSection[];
}

interface MobileMegaMenuProps extends React.ComponentProps<typeof Flex> {
  menuGroups: MenuGroup[];
  onClose?: () => void;
}

const MobileMegaMenu: React.FC<MobileMegaMenuProps> = ({ menuGroups, onClose, ...flex }) => {
  const handleLinkClick = (href: string) => {
    onClose?.();
  };

  return (
    <Column fillWidth gap="4" {...flex}>
      {menuGroups.map((group) => {
        if (group.href && !group.sections) {
          return (
            <ElementType
              key={`group-${group.id}`}
              href={group.href}
              onLinkClick={() => group.href && handleLinkClick(group.href)}
            >
              <Flex
                fillWidth
                paddingY="12"
                paddingX="16"
                horizontal="between"
                vertical="center"
                radius="l"
                cursor="pointer"
                transition="macro-medium"
              >
                <Text variant="heading-strong-s" onBackground="neutral-strong">
                  {group.label}
                </Text>
                {group.suffixIcon && (
                  <Icon name={group.suffixIcon} size="s" onBackground="neutral-weak" />
                )}
              </Flex>
            </ElementType>
          );
        }

        return (
          <Accordion
            key={`group-${group.id}`}
            title={group.label}
            icon={group.suffixIcon || "chevronDown"}
            size="m"
            radius="l"
          >
            {group.sections && (
              <Column gap="4" fillWidth>
                {group.sections.map((section, secIdx) => {
                  const sectionKey = section.title
                    ? `${group.id}-${section.title}`
                    : `sec-${secIdx}`;

                  return section.title ? (
                    <Accordion key={sectionKey} title={section.title} size="s" radius="m">
                      <Column fitHeight fillWidth gap="4">
                        {section.links.map((link, linkIdx) =>
                          isMenuDivider(link) ? (
                            <Line key={`divider-${linkIdx}`} background="neutral-alpha-weak" marginY="4" />
                          ) : (
                            <Option
                              key={`link-${linkIdx}`}
                              href={link.href}
                              tabIndex={0}
                              onClick={() => handleLinkClick(link.href)}
                              aria-label={typeof link.label === "string" ? link.label : undefined}
                              label={link.label}
                              description={link.description}
                              value={link.href}
                              prefix={
                                link.icon ? (
                                  <Icon name={link.icon} size="s" onBackground="neutral-weak" />
                                ) : undefined
                              }
                            />
                          )
                        )}
                      </Column>
                    </Accordion>
                  ) : (
                    <Column key={sectionKey} fitHeight fillWidth gap="4">
                      {section.links.map((link, linkIdx) =>
                        isMenuDivider(link) ? (
                          <Line key={`divider-${linkIdx}`} background="neutral-alpha-weak" marginY="4" />
                        ) : (
                          <Option
                            key={`link-${linkIdx}`}
                            href={link.href}
                            tabIndex={0}
                            onClick={() => handleLinkClick(link.href)}
                            aria-label={typeof link.label === "string" ? link.label : undefined}
                            label={link.label}
                            description={link.description}
                            value={link.href}
                            prefix={
                              link.icon ? (
                                <Icon name={link.icon} size="s" onBackground="neutral-weak" />
                              ) : undefined
                            }
                          />
                        )
                      )}
                    </Column>
                  );
                })}
              </Column>
            )}
          </Accordion>
        );
      })}
    </Column>
  );
};

MobileMegaMenu.displayName = "MobileMegaMenu";
export { MobileMegaMenu };

"use client";

import React, { useState, useRef, useEffect, ReactNode, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Flex, Row, Column, Text, Icon, Line, ToggleButton } from "@once-ui-system/core";
import styles from "./MegaMenu.module.scss";

export interface MenuLink {
  label: ReactNode;
  href: string;
  icon?: string;
  description?: ReactNode;
  selected?: boolean;
}

export interface MenuDivider {
  divider: true;
}

export type MenuSectionItem = MenuLink | MenuDivider;

export function isMenuDivider(item: MenuSectionItem): item is MenuDivider {
  return "divider" in item && item.divider === true;
}

export interface MenuSection {
  title?: ReactNode;
  links: MenuSectionItem[];
}

export interface MenuGroup {
  id: string;
  label: ReactNode;
  suffixIcon?: string;
  href?: string;
  selected?: boolean;
  sections?: MenuSection[];
  content?: ReactNode;
}

export interface MegaMenuProps extends React.ComponentProps<typeof Flex> {
  menuGroups: MenuGroup[];
  className?: string;
}

export const MegaMenu: React.FC<MegaMenuProps> = ({ menuGroups, className, ...rest }) => {
  const pathname = usePathname();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ left: 0, width: 0, height: 0 });
  const [isFirstAppearance, setIsFirstAppearance] = useState(true);
  const previousDropdownRef = useRef<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafId1Ref = useRef<number | undefined>(undefined);
  const rafId2Ref = useRef<number | undefined>(undefined);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (activeDropdown && buttonRefs.current[activeDropdown]) {
      const buttonElement = buttonRefs.current[activeDropdown];
      if (buttonElement) {
        const rect = buttonElement.getBoundingClientRect();
        const parentRect = buttonElement.parentElement?.getBoundingClientRect() || { left: 0 };

        setDropdownPosition({
          left: rect.left - parentRect.left,
          width: 300,
          height: 200,
        });

        rafId1Ref.current = requestAnimationFrame(() => {
          rafId2Ref.current = requestAnimationFrame(() => {
            if (dropdownRef.current) {
              const dropdown = dropdownRef.current;
              const activeContent = contentRefs.current[activeDropdown];

              if (activeContent) {
                const fillWidthButtons = activeContent.querySelectorAll(
                  '[class*="fill-width"]'
                ) as NodeListOf<HTMLElement>;
                const originalWidths: string[] = [];

                fillWidthButtons.forEach((button, index) => {
                  originalWidths[index] = button.style.width;
                  button.style.width = "max-content";
                });

                const originalHeight = dropdown.style.height;
                const originalWidth = dropdown.style.width;
                const originalOverflow = dropdown.style.overflow;

                dropdown.style.height = "auto";
                dropdown.style.width = "max-content";
                dropdown.style.overflow = "visible";

                dropdown.offsetHeight;

                const contentWidth = activeContent.scrollWidth;
                const contentHeight = activeContent.offsetHeight;

                fillWidthButtons.forEach((button, index) => {
                  button.style.width = originalWidths[index];
                });

                dropdown.style.height = originalHeight;
                dropdown.style.width = originalWidth;
                dropdown.style.overflow = originalOverflow;

                setDropdownPosition({
                  left: rect.left - parentRect.left,
                  width: contentWidth + 26,  // inner card padding (24) + border (2)
                  height: contentHeight + 34, // outer paddingTop (8) + inner padding (24) + border (2)
                });
              }
            }
          });
        });
      }
    } else {
      setIsFirstAppearance(true);
    }

    return () => {
      if (rafId1Ref.current !== undefined) cancelAnimationFrame(rafId1Ref.current);
      if (rafId2Ref.current !== undefined) cancelAnimationFrame(rafId2Ref.current);
    };
  }, [activeDropdown]);

  useEffect(() => {
    if (activeDropdown !== null) {
      const timer = setTimeout(() => {
        setIsFirstAppearance(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [activeDropdown]);

  useEffect(() => {
    setActiveDropdown(null);
  }, [pathname]);

  // Cancel pending close timeout on unmount to avoid setState on an unmounted tree.
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Update previousDropdownRef AFTER each commit so reads during render see the
  // previous value — required for cross-fade animation between dropdowns.
  useEffect(() => {
    previousDropdownRef.current = activeDropdown;
  }, [activeDropdown]);

  const isSelected = useCallback(
    (href?: string) => {
      if (!href || !pathname) return false;
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname]
  );

  const dropdownGroups = useMemo(
    () => menuGroups.filter((group) => group.sections || group.content),
    [menuGroups]
  );

  const handleLinkClick = useCallback(() => {
    setActiveDropdown(null);
  }, []);

  return (
    <Flex fitHeight className={className} {...rest}>
      {menuGroups.map((group, index) => (
        <Row
          key={group.id}
          // Anclaje del tour de bienvenida (ver TOUR_STOPS.target): el
          // spotlight recorta este rectángulo para señalar la sección real.
          data-tour={`nav-${group.id}`}
          ref={(el) => {
            buttonRefs.current[group.id] = el;
          }}
          paddingRight="8"
          onMouseEnter={() => {
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
            }

            if (group.sections || group.content) {
              requestAnimationFrame(() => {
                setActiveDropdown(group.id);
              });
            } else {
              setActiveDropdown(null);
            }
          }}
          onMouseLeave={() => {
            closeTimeoutRef.current = setTimeout(() => {
              setActiveDropdown(null);
            }, 100);
          }}
        >
          <ToggleButton
            selected={group.selected !== undefined ? group.selected : isSelected(group.href)}
            href={group.href}
          >
            {group.label}
            {(group.sections || group.content) && group.suffixIcon && (
              <Icon marginLeft="8" name={group.suffixIcon} size="xs" />
            )}
          </ToggleButton>
        </Row>
      ))}

      {activeDropdown && (
        <Row
          paddingTop="8"
          paddingX="12"
          paddingBottom="20"
          ref={dropdownRef}
          position="absolute"
          pointerEvents="auto"
          opacity={100}
          top="32"
          className={isFirstAppearance ? styles.dropdown : ""}
          style={{
            left: `${dropdownPosition.left - 12}px`,
            width: `${dropdownPosition.width + 24}px`,
            height: `${dropdownPosition.height + 20}px`,
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            visibility: "visible",
          }}
          onMouseEnter={() => {
            if (closeTimeoutRef.current) {
              clearTimeout(closeTimeoutRef.current);
            }
          }}
          onMouseLeave={() => {
            closeTimeoutRef.current = setTimeout(() => {
              setActiveDropdown(null);
            }, 100);
          }}
        >
          <Row
            background="surface"
            radius="l"
            border="neutral-alpha-medium"
            shadow="xl"
            padding="12"
            gap="32"
            data-dropdown-wrapper
            className={styles.dropdownCard}
            style={{
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {dropdownGroups.map((group, groupIndex) => {
              const isActive = activeDropdown === group.id;
              const wasActive = previousDropdownRef.current === group.id;
              const isExiting = wasActive && !isActive;
              const shouldAnimate =
                (isActive || isExiting) && previousDropdownRef.current !== null;

              return (
                <Row
                  key={`content-${group.id}`}
                  gap="16"
                  position={isActive ? "relative" : "absolute"}
                  data-dropdown-content
                  ref={(el) => {
                    contentRefs.current[group.id] = el;
                  }}
                  style={{
                    zIndex: isExiting ? 3 : isActive ? 2 : 1,
                    transform: isActive ? "scale(1)" : "scale(0.9)",
                    opacity: isActive ? 1 : isExiting ? 0 : 0,
                    pointerEvents: isActive ? "auto" : "none",
                    transition: shouldAnimate
                      ? `opacity 240ms ease ${isActive ? "120ms" : "0ms"}, transform 240ms cubic-bezier(0.4,0,0.2,1) ${isActive ? "120ms" : "0ms"}`
                      : "opacity 200ms ease 0ms",
                    visibility: isActive || isExiting ? "visible" : "hidden",
                  }}
                >
                  {group.content ? (
                    group.content
                  ) : (
                    group.sections?.map((section, sectionIndex) => (
                      <Column key={`section-${sectionIndex}`} minWidth={12} gap="4">
                        {section.title && (
                          <Text
                            marginLeft="8"
                            marginBottom="12"
                            marginTop="12"
                            onBackground="neutral-weak"
                            variant="label-default-s"
                          >
                            {section.title}
                          </Text>
                        )}
                        {section.links.map((item, linkIndex) =>
                          isMenuDivider(item) ? (
                            <Line
                              key={`divider-${linkIndex}`}
                              background="neutral-alpha-medium"
                              marginY="8"
                            />
                          ) : (
                            <ToggleButton
                              key={`link-${linkIndex}`}
                              style={{
                                height: "auto",
                                minHeight: "fit-content",
                                paddingLeft: "var(--static-space-0)",
                                paddingTop: "var(--static-space-4)",
                                paddingBottom: "var(--static-space-4)",
                                paddingRight: "var(--static-space-12)",
                              }}
                              fillWidth
                              horizontal="start"
                              href={item.href}
                              onClick={handleLinkClick}
                            >
                              <Row gap="12" vertical="center">
                                {item.icon && (
                                  <Icon
                                    name={item.icon}
                                    size="s"
                                    padding="8"
                                    radius="s"
                                    border="neutral-alpha-weak"
                                  />
                                )}
                                <Column gap="4">
                                  {item.label && (
                                    <Text onBackground="neutral-strong" variant="label-strong-s">
                                      {item.label}
                                    </Text>
                                  )}
                                  {item.description && (
                                    <Text onBackground="neutral-weak" truncate>
                                      {item.description}
                                    </Text>
                                  )}
                                </Column>
                              </Row>
                            </ToggleButton>
                          )
                        )}
                      </Column>
                    ))
                  )}
                </Row>
              );
            })}
          </Row>
        </Row>
      )}
    </Flex>
  );
};

MegaMenu.displayName = "MegaMenu";

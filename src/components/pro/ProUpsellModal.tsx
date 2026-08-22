"use client";

import {
  Background,
  Button,
  Column,
  Dialog,
  Icon,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";

/* ══ Upsell a Pro — modal reutilizable ═════════════════════════════════════
   Disparado desde cualquier punto de fricción free→Pro (CV Live, convocato-
   rias, etc.): controlado (isOpen/onClose), una sola vista sin scroll, CTA
   primario a /pro (o `ctaHref`) y salida de baja fricción ("Ahora no"). El
   `benefits` es opcional y corto (3 líneas máx en el copy real) — no es un
   reemplazo de /pro, solo el gancho contextual. ═══════════════════════════ */

export interface ProUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  benefits?: string[];
  ctaLabel?: string;
  ctaHref?: string;
}

export function ProUpsellModal({
  isOpen,
  onClose,
  title,
  message,
  benefits = [],
  ctaLabel = "Hazte Pro",
  ctaHref = "/pro",
}: ProUpsellModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={28}
      footer={
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="tertiary" size="m" onClick={onClose}>
            Ahora no
          </Button>
          <Button variant="primary" size="m" href={ctaHref} arrowIcon>
            {ctaLabel}
          </Button>
        </Row>
      }
    >
      <Column
        fillWidth
        position="relative"
        overflow="hidden"
        radius="l"
        border="brand-alpha-medium"
        background="neutral-alpha-weak"
        padding="20"
        gap="16"
      >
        <Background
          position="absolute"
          top="0"
          left="0"
          fill
          pointerEvents="none"
          gradient={{
            display: true,
            colorStart: "brand-alpha-medium",
            colorEnd: "static-transparent",
            x: 50,
            y: 0,
            width: 150,
            height: 120,
          }}
        />
        <Column zIndex={1} fillWidth gap="16">
          <Row gap="8" vertical="center">
            <Icon
              name="sparkles"
              size="s"
              onBackground="brand-medium"
              padding="8"
              radius="full"
              background="brand-alpha-weak"
            />
            <Tag variant="gradient" size="s" prefixIcon="shield">
              Pro
            </Tag>
          </Row>

          <Text variant="body-default-m" onBackground="neutral-weak" style={{ overflowWrap: "break-word" }}>
            {message}
          </Text>

          {benefits.length > 0 && (
            <Column gap="8" fillWidth>
              {benefits.map((benefit) => (
                <Row key={benefit} gap="8" vertical="start">
                  <Icon
                    name="check"
                    size="xs"
                    onBackground="brand-medium"
                    style={{ marginTop: "2px", flexShrink: 0 }}
                  />
                  <Text variant="body-default-s" style={{ minWidth: 0 }}>
                    {benefit}
                  </Text>
                </Row>
              ))}
            </Column>
          )}
        </Column>
      </Column>
    </Dialog>
  );
}

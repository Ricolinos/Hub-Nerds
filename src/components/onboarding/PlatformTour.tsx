"use client";

import { useEffect, useMemo, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Column, Icon, IconButton, Row, Text } from "@once-ui-system/core";
import { finishTour } from "@/app/actions/onboarding";
import { SpotlightOverlay, useSpotlightRect } from "@/components/onboarding/SpotlightOverlay";
import type { TourStop } from "@/lib/onboarding";

interface PlatformTourProps {
  /** Parada visible; la controla TourHost (persistida en localStorage). */
  step: number;
  /** Guion del recorrido; distinto para freelancer y para client. */
  stops: TourStop[];
  username: string | null;
  onStepChange: (next: number | null) => void;
}

const CARD_WIDTH = 380;
const GAP = 16;
// Alto aproximado de la tarjeta, para decidir de qué lado cabe.
const CARD_HEIGHT = 280;

/* Tour posterior a la bienvenida, en formato tutorial con foco.
 *
 * Cada parada oscurece la pantalla y deja al descubierto el elemento REAL que
 * hay que usar (el avatar del header, la burbuja de mensajes…), bloqueando el
 * clic en todo lo demás: la idea es que el usuario aprenda DÓNDE está cada
 * cosa, no que el tour se la sirva en un botón que luego no vuelve a existir.
 *
 * El estado vive en TourHost para que sobreviva a la navegación entre
 * paradas. Si el elemento señalado no existe en la página actual (layouts
 * distintos), se degrada a una tarjeta centrada sobre la pantalla oscurecida
 * en vez de romperse. */
export function PlatformTour({ step, stops, username, onStepChange }: PlatformTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const stop = stops[step];
  const isLast = step === stops.length - 1;
  const isFirst = step === 0;
  const href = stop.href
    ? username
      ? stop.href.replace(":username", username)
      : "/dashboard"
    : null;

  const rect = useSpotlightRect(stop.target, true);

  // Prefetch del destino en cuanto la parada aparece: las páginas de perfil y
  // convocatorias son server components pesados y, sin esto, el primer clic
  // se sentía lento (se notaba sobre todo en local).
  useEffect(() => {
    if (href) router.prefetch(href);
  }, [href, router]);

  /** Cerrar de forma definitiva: deja de ofrecerse solo (se puede relanzar). */
  const dismiss = () => {
    onStepChange(null);
    startTransition(async () => {
      try {
        await finishTour();
      } catch {
        // No bloquear la salida del tour si falla el marcado.
      }
      router.refresh();
    });
  };

  /** Ir al destino SIN cerrar el tour: avanza y reaparece ya en esa página. */
  const visit = () => {
    if (!href) return;
    onStepChange(step + 1);
    startTransition(() => router.push(href));
  };

  /* Coloca la tarjeta junto al elemento resaltado sin taparlo NI tapar lo que
     ese elemento despliega. El caso que lo motivó: el menú del avatar vive
     arriba a la derecha y su desplegable cae justo debajo, exactamente donde
     se ponía la tarjeta — el tour bloqueaba la acción que él mismo pedía. Por
     eso cada parada puede fijar `placement`; "auto" sigue eligiendo por
     espacio libre. */
  const cardStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      position: "fixed",
      zIndex: 10,
      width: CARD_WIDTH,
      maxWidth: "calc(100vw - 32px)",
    };
    if (typeof window === "undefined" || !rect) {
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampX = (x: number) => Math.min(Math.max(GAP, x), Math.max(GAP, vw - CARD_WIDTH - GAP));
    const clampY = (y: number) => Math.min(Math.max(GAP, y), Math.max(GAP, vh - CARD_HEIGHT - GAP));

    // En pantallas angostas no hay costados: siempre debajo o arriba.
    const narrow = vw < CARD_WIDTH + 2 * GAP + 120;
    let placement = stop.placement ?? "auto";
    if (narrow && (placement === "left" || placement === "right")) placement = "auto";
    if (placement === "auto") {
      placement = rect.top + rect.height + GAP + CARD_HEIGHT < vh ? "below" : "above";
    }

    switch (placement) {
      case "left":
        return {
          ...base,
          top: clampY(rect.top),
          left: clampX(rect.left - CARD_WIDTH - GAP),
        };
      case "right":
        return {
          ...base,
          top: clampY(rect.top),
          left: clampX(rect.left + rect.width + GAP),
        };
      case "above":
        return {
          ...base,
          top: clampY(rect.top - CARD_HEIGHT - GAP),
          left: clampX(rect.left + rect.width / 2 - CARD_WIDTH / 2),
        };
      default:
        return {
          ...base,
          top: clampY(rect.top + rect.height + GAP),
          left: clampX(rect.left + rect.width / 2 - CARD_WIDTH / 2),
        };
    }
  }, [rect, stop.placement]);

  return (
    <>
      <SpotlightOverlay rect={rect} />

      <Column
        style={cardStyle}
        background="page"
        border="neutral-alpha-medium"
        radius="l"
        shadow="l"
        padding="20"
        gap="16"
      >
        <Row fillWidth horizontal="between" vertical="start" gap="12">
          <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
            <Icon name={stop.icon} size="s" onBackground="brand-medium" />
            <Text
              variant="label-strong-m"
              onBackground="neutral-strong"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {stop.title}
            </Text>
          </Row>
          <IconButton
            icon="xCircle"
            variant="tertiary"
            size="s"
            tooltip="Cerrar el tour"
            onClick={dismiss}
          />
        </Row>

        <Text
          variant="body-default-s"
          onBackground="neutral-weak"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {stop.body}
        </Text>

        {/* La pista solo tiene sentido cuando de verdad se está señalando algo */}
        {stop.hint && rect && (
          <Row
            fillWidth
            gap="8"
            vertical="center"
            padding="12"
            radius="m"
            background="brand-alpha-weak"
          >
            <Icon name="infoCircle" size="xs" onBackground="brand-strong" />
            <Text
              variant="body-default-xs"
              onBackground="brand-strong"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {stop.hint}
            </Text>
          </Row>
        )}

        {/* El CTA desaparece cuando ya estás en el destino: en la parada del
            perfil, estando en el perfil, "Ir a mi perfil" no lleva a ningún
            lado y compite con la instrucción real, que es aprender la ruta. */}
        {href && stop.cta && pathname !== href.split("?")[0] && (
          <Row>
            <Button variant="secondary" size="s" disabled={isPending} onClick={visit}>
              {stop.cta}
            </Button>
          </Row>
        )}

        <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
          <Row gap="8" vertical="center">
            {stops.map((item, i) => (
              <Column
                key={item.id}
                radius="full"
                background={i === step ? "brand-strong" : "neutral-alpha-medium"}
                style={{ width: i === step ? 18 : 6, height: 6, transition: "width 0.2s" }}
              />
            ))}
          </Row>

          <Row gap="8" vertical="center">
            {!isFirst && (
              <Button
                variant="tertiary"
                size="s"
                prefixIcon="arrowLeft"
                disabled={isPending}
                onClick={() => onStepChange(step - 1)}
              >
                Anterior
              </Button>
            )}
            {isLast ? (
              <Button size="s" disabled={isPending} onClick={dismiss}>
                Empezar
              </Button>
            ) : (
              // Sin "Saltar": la X del encabezado ya cierra el tour y el pie
              // acumulaba cuatro controles compitiendo entre sí.
              <Button size="s" disabled={isPending} onClick={() => onStepChange(step + 1)}>
                Siguiente
              </Button>
            )}
          </Row>
        </Row>
      </Column>
    </>
  );
}

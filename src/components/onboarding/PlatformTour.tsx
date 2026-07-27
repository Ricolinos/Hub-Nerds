"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Icon, IconButton, Row, Text } from "@once-ui-system/core";
import { finishTour } from "@/app/actions/onboarding";
import { SpotlightOverlay, useSpotlightRect } from "@/components/onboarding/SpotlightOverlay";
import { TOUR_STOPS } from "@/lib/onboarding";

interface PlatformTourProps {
  /** Parada visible; la controla TourHost (persistida en localStorage). */
  step: number;
  username: string | null;
  onStepChange: (next: number | null) => void;
}

const CARD_WIDTH = 380;
const GAP = 16;

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
export function PlatformTour({ step, username, onStepChange }: PlatformTourProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const stop = TOUR_STOPS[step];
  const isLast = step === TOUR_STOPS.length - 1;
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

  // Coloca la tarjeta junto al elemento resaltado; si no hay, al centro.
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
    const below = rect.top + rect.height + GAP;
    const fitsBelow = below + 260 < vh;
    const top = fitsBelow ? below : Math.max(GAP, rect.top - 260 - GAP);
    // Centrada respecto al objetivo pero sin salirse del viewport.
    const rawLeft = rect.left + rect.width / 2 - CARD_WIDTH / 2;
    const left = Math.min(Math.max(GAP, rawLeft), Math.max(GAP, vw - CARD_WIDTH - GAP));
    return { ...base, top, left };
  }, [rect]);

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

        {href && stop.cta && (
          <Row>
            <Button variant="secondary" size="s" disabled={isPending} onClick={visit}>
              {stop.cta}
            </Button>
          </Row>
        )}

        <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
          <Row gap="8" vertical="center">
            {TOUR_STOPS.map((item, i) => (
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
              <>
                <Button variant="tertiary" size="s" disabled={isPending} onClick={dismiss}>
                  Saltar
                </Button>
                <Button size="s" disabled={isPending} onClick={() => onStepChange(step + 1)}>
                  Siguiente
                </Button>
              </>
            )}
          </Row>
        </Row>
      </Column>
    </>
  );
}

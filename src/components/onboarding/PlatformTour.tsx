"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Icon, IconButton, RevealFx, Row, Text } from "@once-ui-system/core";
import { finishTour } from "@/app/actions/onboarding";
import { TOUR_STOPS } from "@/lib/onboarding";

interface PlatformTourProps {
  /** Parada visible; la controla TourHost (persistida en localStorage). */
  step: number;
  username: string | null;
  onStepChange: (next: number | null) => void;
}

/* Tour posterior a la bienvenida: responde "qué puedo hacer aquí y cómo
 * llego". El estado vive en TourHost para que sobreviva a la navegación.
 *
 * Ventana flotante y NO Modal, por dos razones: el Dialog de Once UI ocupa
 * casi todo el alto del viewport (height:100% en su CSS), que para tarjetas
 * cortas deja un hueco enorme; y sobre todo, un tour que tapa la pantalla
 * impide ver justo aquello que está describiendo. Flotando, el usuario lee el
 * texto y ve la página al mismo tiempo.
 *
 * Tampoco son coachmarks anclados al DOM: apuntar a elementos concretos se
 * rompe en cuanto el layout cambia o la pantalla es angosta. */
export function PlatformTour({ step, username, onStepChange }: PlatformTourProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const stop = TOUR_STOPS[step];
  const isLast = step === TOUR_STOPS.length - 1;
  // Sin username no hay perfil al que ir; el destino cae al panel.
  const href = username ? stop.href.replace(":username", username) : "/dashboard";

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
    onStepChange(isLast ? null : step + 1);
    if (isLast) {
      startTransition(async () => {
        try {
          await finishTour();
        } catch {
          /* idem */
        }
        router.push(href);
      });
      return;
    }
    startTransition(() => router.push(href));
  };

  return (
    <Column
      position="fixed"
      zIndex={9}
      background="page"
      border="neutral-alpha-medium"
      radius="l"
      shadow="l"
      padding="20"
      gap="16"
      // Anclada abajo a la derecha; en pantallas angostas se encoge sola con
      // el maxWidth en vez de necesitar un breakpoint aparte.
      style={{ bottom: 24, right: 24, width: 380, maxWidth: "calc(100vw - 48px)" }}
    >
      <RevealFx translateY="4">
        <Column fillWidth gap="16">
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

          <Row>
            <Button variant="secondary" size="s" disabled={isPending} onClick={visit}>
              {stop.cta}
            </Button>
          </Row>

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
              <Button variant="tertiary" size="s" disabled={isPending} onClick={dismiss}>
                {isLast ? "Listo" : "Saltar"}
              </Button>
              {!isLast && (
                <Button size="s" disabled={isPending} onClick={() => onStepChange(step + 1)}>
                  Siguiente
                </Button>
              )}
            </Row>
          </Row>
        </Column>
      </RevealFx>
    </Column>
  );
}

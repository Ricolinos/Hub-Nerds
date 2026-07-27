"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Column, Icon, IconButton, RevealFx, Row, Text } from "@once-ui-system/core";
import { finishTour } from "@/app/actions/onboarding";
import { TOUR_STOPS } from "@/lib/onboarding";

interface PlatformTourProps {
  /** Para resolver los destinos que apuntan al perfil propio. */
  username: string | null;
}

/* Tour posterior a la bienvenida: responde "qué puedo hacer aquí y cómo
 * llego". Se ofrece una sola vez (publicMetadata.tourSeenAt) y se marca como
 * visto en cuanto el usuario lo cierra, lo salta o lo termina — insistir sería
 * el acoso que este onboarding evita.
 *
 * Ventana flotante y NO Modal, por dos razones: el Dialog de Once UI ocupa
 * casi todo el alto del viewport (height:100% en su CSS), que para cinco
 * tarjetas cortas deja un hueco enorme; y sobre todo, un tour que tapa la
 * pantalla impide ver justo aquello que está describiendo. Flotando, el
 * usuario lee el texto y ve el dashboard al mismo tiempo.
 *
 * Tampoco son coachmarks anclados al DOM: apuntar a elementos concretos se
 * rompe en cuanto el layout cambia o la pantalla es angosta. */
export function PlatformTour({ username }: PlatformTourProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [isOpen, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const stop = TOUR_STOPS[index];
  const isLast = index === TOUR_STOPS.length - 1;
  const href = username ? stop.href.replace(":username", username) : "/dashboard";

  const close = (destination?: string) => {
    setOpen(false);
    startTransition(async () => {
      try {
        await finishTour();
      } catch {
        // No bloquear la salida del tour si falla el marcado.
      }
      if (destination) router.push(destination);
      else router.refresh();
    });
  };

  if (!isOpen) return null;

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
      style={{
        bottom: 24,
        right: 24,
        width: 380,
        maxWidth: "calc(100vw - 48px)",
      }}
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
              tooltip="Cerrar"
              onClick={() => close()}
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
            <Button variant="secondary" size="s" disabled={isPending} onClick={() => close(href)}>
              {stop.cta}
            </Button>
          </Row>

          <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
            {/* Indicador de avance */}
            <Row gap="8" vertical="center">
              {TOUR_STOPS.map((item, i) => (
                <Column
                  key={item.id}
                  radius="full"
                  background={i === index ? "brand-strong" : "neutral-alpha-medium"}
                  style={{ width: i === index ? 18 : 6, height: 6, transition: "width 0.2s" }}
                />
              ))}
            </Row>

            <Row gap="8" vertical="center">
              <Button variant="tertiary" size="s" disabled={isPending} onClick={() => close()}>
                {isLast ? "Listo" : "Saltar"}
              </Button>
              {!isLast && (
                <Button size="s" disabled={isPending} onClick={() => setIndex((i) => i + 1)}>
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

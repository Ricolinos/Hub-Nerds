"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Background,
  Button,
  Column,
  Heading,
  Icon,
  RevealFx,
  Spinner,
  Text,
} from "@once-ui-system/core";

// Estado post-checkout MOCK (sin Stripe): simula un par de segundos de
// "activación" antes de mostrar el resultado, para que la pantalla no se
// sienta instantánea/falsa. Cuando se conecte Stripe de verdad, este
// setTimeout se reemplaza por el webhook/polling real.
const MOCK_ACTIVATION_MS = 2200;

export function ProGracias() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActivated(true), MOCK_ACTIVATION_MS);
    return () => clearTimeout(timer);
  }, []);

  const profileHref = isLoaded && isSignedIn && user?.username ? `/${user.username}` : "/";

  return (
    <Column
      as="main"
      fillWidth
      center
      position="relative"
      overflow="hidden"
      paddingY="104"
      paddingX="24"
      style={{ minHeight: "60vh" }}
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
          colorEnd: "page-background",
          x: 50,
          y: 40,
          width: 150,
          height: 150,
        }}
      />
      <RevealFx translateY="8" fillWidth horizontal="center">
        <Column
          zIndex={1}
          center
          gap="24"
          padding="40"
          maxWidth={32}
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
        >
          {activated ? (
            <Icon
              name="check"
              size="xl"
              onBackground="brand-medium"
              padding="16"
              radius="full"
              background="brand-alpha-weak"
            />
          ) : (
            <Spinner size="l" ariaLabel="Activando tu plan" />
          )}

          <Column gap="8" center>
            <Heading as="h1" variant="display-strong-s" align="center">
              {activated ? "Tu plan Pro está listo" : "Estamos activando tu plan…"}
            </Heading>
            <Text
              variant="body-default-m"
              onBackground="neutral-weak"
              align="center"
              style={{ overflowWrap: "break-word" }}
            >
              {activated
                ? "Ya puedes disfrutar de las ventajas Pro en tu perfil."
                : "Esto toma solo un momento, no cierres esta ventana."}
            </Text>
          </Column>

          <Button href={profileHref} arrowIcon disabled={!activated}>
            Volver a tu perfil
          </Button>
        </Column>
      </RevealFx>
    </Column>
  );
}

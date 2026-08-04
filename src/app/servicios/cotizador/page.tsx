import {
  Background,
  Button,
  Column,
  Heading,
  Icon,
  RevealFx,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";
import { Cotizador } from "@/components/servicios/Cotizador";
import { getOrCreateUser } from "@/lib/syncUser";
import { isFreelancerRole } from "@/lib/roles";
import { isPro } from "@/lib/plan";

export const metadata = {
  title: "Cotiza tu proyecto",
  description: "Calcula una estimación al instante para tu proyecto de diseño, ilustración o animación.",
};

// Consulta la BD (rol/plan del usuario logueado): evita congelar el fetch en build.
export const dynamic = "force-dynamic";

const FREELANCER_UPSELL_BENEFITS = [
  "Orienta tus honorarios con la misma referencia que usan los clients",
  "Cotiza en segundos antes de responder un brief",
  "Incluido en Freelancer Pro, sin costo adicional",
];

/* ══ Gate visual — pantalla sin sesión ═════════════════════════════════════
   Reutiliza el recipe de "static panel" de Once UI (Column surface + border)
   con el mismo lenguaje visual del ProUpsellModal (glow de Background,
   Icon+Tag), pero sin Dialog: es contenido de página, no un modal. ═════════ */
function MembersOnlyGate() {
  return (
    <RevealFx fillWidth translateY="8" horizontal="center">
      <Column
        fillWidth
        maxWidth="s"
        position="relative"
        overflow="hidden"
        radius="l"
        border="neutral-alpha-weak"
        background="surface"
        padding="32"
        gap="20"
        horizontal="center"
        align="center"
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
        <Column zIndex={1} gap="20" horizontal="center" align="center">
          <Icon
            name="userGroup"
            size="l"
            onBackground="brand-medium"
            padding="16"
            radius="full"
            background="brand-alpha-weak"
          />
          <Column gap="8" horizontal="center" align="center">
            <Heading variant="display-strong-xs" align="center">
              Herramienta exclusiva para miembros de Hub-Nerds
            </Heading>
            <Text onBackground="neutral-weak" variant="body-default-m" align="center">
              El cotizador es una referencia de honorarios por proyecto, disponible solo para
              clients y freelancers Pro. Inicia sesión o crea tu cuenta para usarlo.
            </Text>
          </Column>
          <Row gap="12" wrap horizontal="center">
            <Button variant="primary" size="m" href="/sign-in?redirect_url=/servicios/cotizador">
              Iniciar sesión
            </Button>
            <Button variant="secondary" size="m" href="/sign-up">
              Registrarse
            </Button>
          </Row>
        </Column>
      </Column>
    </RevealFx>
  );
}

/* ══ Gate visual — freelancer free ═════════════════════════════════════════
   Mismo patrón visual del ProUpsellModal (glow + Tag "Pro" + benefits) pero
   como sección estática de página en vez de Dialog: aquí no hay "cerrar",
   la única salida es el CTA a /pro. ═════════════════════════════════════════ */
function FreelancerFreeUpsell() {
  return (
    <RevealFx fillWidth translateY="8" horizontal="center">
      <Column
        fillWidth
        maxWidth="s"
        position="relative"
        overflow="hidden"
        radius="l"
        border="brand-alpha-medium"
        background="neutral-alpha-weak"
        padding="32"
        gap="20"
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
        <Column zIndex={1} gap="16" fillWidth>
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
          <Column gap="8" fillWidth>
            <Heading variant="display-strong-xs">Cotizador exclusivo para Freelancer Pro</Heading>
            <Text variant="body-default-m" onBackground="neutral-weak">
              El cotizador es una herramienta de referencia exclusiva: oriéntate sobre honorarios
              por proyecto antes de responder un brief.
            </Text>
          </Column>
          <Column gap="8" fillWidth>
            {FREELANCER_UPSELL_BENEFITS.map((benefit) => (
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
          <Row fillWidth horizontal="start">
            <Button variant="primary" size="m" href="/pro" arrowIcon>
              Hazte Pro
            </Button>
          </Row>
        </Column>
      </Column>
    </RevealFx>
  );
}

export default async function CotizadorPage() {
  const dbUser = await getOrCreateUser();

  const canAccessCotizador = !!dbUser && (!isFreelancerRole(dbUser.role) || isPro(dbUser));

  return (
    <Column fillWidth maxWidth="l" paddingY="80" paddingX="24" gap="48" horizontal="center">
      <RevealFx fillWidth translateY="8" horizontal="center">
        <Column fillWidth gap="16" horizontal="center" align="center" maxWidth="s">
          <Heading variant="display-strong-l" align="center">
            Cotiza tu proyecto
          </Heading>
          <Text onBackground="neutral-weak" variant="body-default-l" align="center">
            Diseño gráfico, ilustración digital o animación: configura tu proyecto y obtén una
            estimación al instante, sin tablas ni letras chiquitas.
          </Text>
        </Column>
      </RevealFx>

      {!dbUser && <MembersOnlyGate />}
      {dbUser && !canAccessCotizador && <FreelancerFreeUpsell />}

      {canAccessCotizador && (
        <>
          <RevealFx fillWidth translateY="8" horizontal="center">
            <Text onBackground="neutral-weak" variant="body-default-s" align="center">
              Herramienta de referencia para orientar honorarios — los montos son estimaciones,
              no cotizaciones vinculantes.
            </Text>
          </RevealFx>
          <RevealFx fillWidth translateY="8" delay={0.1}>
            <Cotizador />
          </RevealFx>
        </>
      )}
    </Column>
  );
}

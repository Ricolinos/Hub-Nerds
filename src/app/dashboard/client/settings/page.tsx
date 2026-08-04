"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Badge,
  Button,
  Card,
  Column,
  Heading,
  Icon,
  Line,
  Row,
  SegmentedControl,
  Select,
  Switch,
  Text,
} from "@once-ui-system/core";

type Tab = "general" | "seguridad" | "notificaciones" | "suscripcion";

interface GeneralForm {
  idioma: string;
  zona: string;
}

interface NotifState {
  estadoProyecto: boolean;
  nuevaCotizacion: boolean;
}

const IDIOMAS = [
  { label: "Español", value: "es" },
  { label: "English", value: "en" },
  { label: "Français", value: "fr" },
];

const ZONAS = [
  { label: "Ciudad de México (UTC-6)", value: "America/Mexico_City" },
  { label: "Bogotá (UTC-5)",           value: "America/Bogota" },
  { label: "Buenos Aires (UTC-3)",     value: "America/Argentina/Buenos_Aires" },
  { label: "Madrid (UTC+1/+2)",        value: "Europe/Madrid" },
  { label: "New York (UTC-5/-4)",      value: "America/New_York" },
];

const TABS = [
  { value: "general",         label: "General"         },
  { value: "seguridad",       label: "Seguridad"       },
  { value: "notificaciones",  label: "Notificaciones"  },
  { value: "suscripcion",     label: "Suscripción"     },
];

// Datos MOCK: sin Stripe ni Customer Portal todavía, el plan siempre es
// "free" y "Gestionar suscripción" queda deshabilitado hasta activar Pro.
const CLIENT_PRO_ADVANTAGES = [
  "Página pública de tu empresa",
  "Convocatorias destacadas en Brief-hub",
  "Filtros avanzados para encontrar talento",
];

export default function ClientSettingsPage() {
  const { isLoaded, user } = useUser();
  const { signOut, openUserProfile } = useClerk() as any;

  const [tab, setTab]     = useState<Tab>("general");
  const [general, setGeneral] = useState<GeneralForm>({
    idioma: "es",
    zona:   "America/Mexico_City",
  });
  const [notif, setNotif] = useState<NotifState>({
    estadoProyecto:  true,
    nuevaCotizacion: false,
  });

  const email = isLoaded && user ? (user.emailAddresses[0]?.emailAddress ?? "—") : "—";

  return (
    <Column fillWidth paddingY="80" paddingX="24" gap="24" maxWidth="l" horizontal="center">

      {/* ── Encabezado ───────────────────────────────────────────────────────── */}
      <Column gap="4" fillWidth>
        <Heading variant="heading-strong-l">Configuración</Heading>
        <Text onBackground="neutral-weak" variant="body-default-m">
          Gestiona tus preferencias y la seguridad de tu cuenta.
        </Text>
      </Column>

      {/* ── Sub-navegación ───────────────────────────────────────────────────── */}
      <Row fillWidth>
        <SegmentedControl
          buttons={TABS}
          selected={tab}
          onToggle={(v) => setTab(v as Tab)}
        />
      </Row>

      {/* ══ SECCIÓN: GENERAL ═══════════════════════════════════════════════════ */}
      {tab === "general" && (
        <Card fillWidth padding="32">
          <Column gap="24">
            <Column gap="4">
              <Heading variant="heading-strong-m">Preferencias Generales</Heading>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Personaliza el idioma, horario y apariencia de la plataforma.
              </Text>
            </Column>

            <Column gap="16">
              <Select
                id="idioma"
                label="Idioma preferido"
                options={IDIOMAS}
                value={general.idioma}
                onSelect={(v) => setGeneral((f) => ({ ...f, idioma: v }))}
                fillWidth
              />
              <Select
                id="zona"
                label="Zona Horaria"
                options={ZONAS}
                value={general.zona}
                onSelect={(v) => setGeneral((f) => ({ ...f, zona: v }))}
                fillWidth
              />
              {/* El Select "Tema Visual" se retiró: el sitio quedó fijo en
                  oscuro (once-ui.config.ts -> style.theme). Para reactivarlo
                  hay que devolver este control junto con el flag
                  display.themeSwitcher del header. */}
            </Column>

            <Button variant="primary" size="m">
              Guardar Ajustes Generales
            </Button>
          </Column>
        </Card>
      )}

      {/* ══ SECCIÓN: SEGURIDAD ═════════════════════════════════════════════════ */}
      {tab === "seguridad" && (
        <Card fillWidth padding="32">
          <Column gap="24">
            <Column gap="4">
              <Heading variant="heading-strong-m">Seguridad</Heading>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Gestiona tu contraseña y el acceso a tu cuenta.
              </Text>
            </Column>

            <Column gap="0">
              {/* Fila: contraseña */}
              <Row
                fillWidth
                paddingY="16"
                gap="16"
                vertical="center"
                horizontal="between"
                wrap
              >
                <Column gap="4">
                  <Text variant="label-strong-s">Contraseña</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Actualiza tu contraseña desde el portal seguro de Clerk.
                  </Text>
                </Column>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => openUserProfile?.()}
                >
                  Cambiar contraseña
                </Button>
              </Row>

              <Line background="neutral-alpha-weak" />

              {/* Fila: correo */}
              <Row
                fillWidth
                paddingY="16"
                gap="16"
                vertical="center"
                horizontal="between"
                wrap
              >
                <Column gap="4">
                  <Text variant="label-strong-s">Correo electrónico</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    {email}
                  </Text>
                </Column>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => openUserProfile?.()}
                >
                  Gestionar cuenta
                </Button>
              </Row>

              <Line background="neutral-alpha-weak" />

              {/* Fila: sesiones */}
              <Row
                fillWidth
                paddingY="16"
                gap="16"
                vertical="center"
                horizontal="between"
                wrap
              >
                <Column gap="4">
                  <Text variant="label-strong-s">Sesiones activas</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Revisa y cierra sesiones desde otros dispositivos.
                  </Text>
                </Column>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={() => openUserProfile?.()}
                >
                  Ver sesiones
                </Button>
              </Row>

              <Line background="neutral-alpha-weak" />

              {/* Fila: cerrar sesión */}
              <Row
                fillWidth
                paddingY="16"
                gap="16"
                vertical="center"
                horizontal="between"
                wrap
              >
                <Column gap="4">
                  <Text variant="label-strong-s">Cerrar sesión</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Salir de tu cuenta en este dispositivo.
                  </Text>
                </Column>
                <Button
                  variant="danger"
                  size="s"
                  onClick={() => signOut({ redirectUrl: "/" })}
                >
                  Cerrar sesión
                </Button>
              </Row>
            </Column>
          </Column>
        </Card>
      )}

      {/* ══ SECCIÓN: NOTIFICACIONES ════════════════════════════════════════════ */}
      {tab === "notificaciones" && (
        <Card fillWidth padding="32">
          <Column gap="24">
            <Column gap="4">
              <Heading variant="heading-strong-m">Notificaciones</Heading>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Elige qué alertas quieres recibir por correo electrónico.
              </Text>
            </Column>

            <Column gap="0">
              <Row fillWidth paddingY="16" gap="16" vertical="center" horizontal="between" wrap>
                <Column gap="4" style={{ flex: 1 }}>
                  <Text variant="label-strong-s">Actualizaciones de proyecto</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Recibir correos sobre cambios de estado en mis proyectos.
                  </Text>
                </Column>
                <Switch
                  isChecked={notif.estadoProyecto}
                  onToggle={() =>
                    setNotif((n) => ({ ...n, estadoProyecto: !n.estadoProyecto }))
                  }
                  ariaLabel="Notificaciones de estado de proyecto"
                />
              </Row>

              <Line background="neutral-alpha-weak" />

              <Row fillWidth paddingY="16" gap="16" vertical="center" horizontal="between" wrap>
                <Column gap="4" style={{ flex: 1 }}>
                  <Text variant="label-strong-s">Nuevas cotizaciones</Text>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Recibir alertas cuando un colaborador envíe una nueva cotización.
                  </Text>
                </Column>
                <Switch
                  isChecked={notif.nuevaCotizacion}
                  onToggle={() =>
                    setNotif((n) => ({ ...n, nuevaCotizacion: !n.nuevaCotizacion }))
                  }
                  ariaLabel="Notificaciones de cotización"
                />
              </Row>
            </Column>

            <Button variant="primary" size="m">
              Guardar Notificaciones
            </Button>
          </Column>
        </Card>
      )}

      {/* ══ SECCIÓN: SUSCRIPCIÓN ═══════════════════════════════════════════════ */}
      {tab === "suscripcion" && (
        <Card fillWidth padding="32">
          <Column gap="24">
            <Column gap="4">
              <Heading variant="heading-strong-m">Suscripción</Heading>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Tu plan actual y las ventajas de subir a Pro.
              </Text>
            </Column>

            {/* Plan actual */}
            <Column
              background="surface"
              border="neutral-alpha-weak"
              radius="l"
              padding="20"
              gap="16"
              fillWidth
            >
              <Row fillWidth gap="16" vertical="center" horizontal="between" wrap>
                <Column gap="4">
                  <Row gap="8" vertical="center">
                    <Text variant="label-strong-s">Plan Free</Text>
                    <Badge
                      textVariant="label-default-xs"
                      background="neutral-alpha-weak"
                      onBackground="neutral-weak"
                      paddingX="8"
                      paddingY="2"
                      radius="full"
                    >
                      Actual
                    </Badge>
                  </Row>
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Incluye perfil de empresa, cotizador y mensajería con freelancers.
                  </Text>
                </Column>

                <Button variant="secondary" size="s" href="/pro/suscripcion">
                  Gestionar suscripción
                </Button>
              </Row>
            </Column>

            <Line background="neutral-alpha-weak" />

            {/* Upsell Client Pro */}
            <Column gap="16" fillWidth>
              <Row gap="8" vertical="center">
                <Icon name="sparkles" size="s" onBackground="brand-medium" />
                <Text variant="label-strong-s" onBackground="brand-medium">
                  Client Pro
                </Text>
              </Row>

              <Column gap="8">
                {CLIENT_PRO_ADVANTAGES.map((advantage) => (
                  <Row key={advantage} gap="8" vertical="center">
                    <Icon name="check" size="xs" onBackground="brand-medium" />
                    <Text variant="body-default-s">{advantage}</Text>
                  </Row>
                ))}
              </Column>

              <Row>
                <Button variant="primary" size="m" href="/pro">
                  Hazte Pro
                </Button>
              </Row>
            </Column>
          </Column>
        </Card>
      )}

    </Column>
  );
}

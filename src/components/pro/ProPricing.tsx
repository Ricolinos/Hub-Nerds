"use client";

import { useState, useTransition } from "react";
import {
  Background,
  Button,
  Column,
  Dialog,
  Feedback,
  Grid,
  Heading,
  Icon,
  IconButton,
  RevealFx,
  Row,
  SegmentedControl,
  Tag,
  Text,
} from "@once-ui-system/core";
import { createProCheckoutSession } from "@/app/actions/billing";
import {
  COMPARISON_ROWS,
  FREE_FEATURES,
  IVA_INCLUDED_LABEL,
  PRO_PLANS,
  PROMO_PRICES,
  YEARLY_DISCOUNT_LABEL,
  formatMXN,
  type BillingCycle,
  type ProPlan,
} from "@/lib/proPlans";
import type { Role } from "@/lib/roles";

// Celda Free/Pro de la fila comparativa: booleano → check/minus, string →
// etiqueta corta ("1 activa", "Sin límite"). minWidth={0} + overflowWrap en
// el texto de cada celda evita que una etiqueta larga desborde en móvil.
function ComparisonCell({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: boolean | string;
  highlighted?: boolean;
}) {
  return (
    <Row gap="8" vertical="center" minWidth={0}>
      <Text variant="label-default-xs" onBackground="neutral-weak">
        {label}
      </Text>
      {typeof value === "boolean" ? (
        <Icon
          name={value ? "check" : "minus"}
          size="xs"
          onBackground={value ? (highlighted ? "brand-medium" : "neutral-medium") : "neutral-weak"}
        />
      ) : (
        <Text
          variant="label-strong-xs"
          onBackground={highlighted ? "brand-medium" : "neutral-strong"}
          style={{ overflowWrap: "break-word" }}
        >
          {value}
        </Text>
      )}
    </Row>
  );
}

// Tarjeta de un plan Pro. `mode="teaser"` (visitante o sesión sin rol
// resuelto): solo ventajas, sin precio ni toggle, CTA a /sign-up.
// `mode="priced"` (freelancer/client logueado): precio del billing activo,
// con tachado + monto promo cuando promoActive, CTA a /pro/gracias.
function ProPlanCard({
  plan,
  index,
  mode,
  billing,
  promoActive,
}: {
  plan: ProPlan;
  index: number;
  mode: "teaser" | "priced";
  billing: BillingCycle;
  promoActive: boolean;
}) {
  const price = plan.price[billing];
  const promoPrice = PROMO_PRICES[plan.id][billing];
  const [isPending, startTransition] = useTransition();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // El redirect de una server action ("use server") navega el propio
  // navegador vía un throw especial de Next (digest NEXT_REDIRECT) — nunca
  // llega a resolverse la promesa ni cae en el catch en un cliente sano; solo
  // se atrapan aquí errores reales (precio no encontrado, Stripe caído, etc).
  // Si es un error real, cierra el diálogo de confirmación para que el
  // Feedback de error (fuera del Dialog, en la tarjeta) sea visible.
  const handleCheckout = () => {
    setCheckoutError(null);
    startTransition(async () => {
      try {
        await createProCheckoutSession(billing === "monthly" ? "month" : "year");
      } catch (err) {
        if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) return;
        setConfirmOpen(false);
        setCheckoutError(
          err instanceof Error ? err.message : "No se pudo iniciar el pago. Intenta de nuevo.",
        );
      }
    });
  };

  return (
    <RevealFx fill translateY="8" delay={index * 0.1}>
      <Column
        fill
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="32"
        gap="24"
        minWidth={0}
      >
        <Column gap="4" minWidth={0}>
          <Text variant="label-default-s" onBackground="brand-medium">
            {plan.audience}
          </Text>
          <Heading as="h2" variant="heading-strong-l">
            {plan.name}
          </Heading>
          <Text
            variant="body-default-s"
            onBackground="neutral-weak"
            style={{ overflowWrap: "break-word" }}
          >
            {plan.tagline}
          </Text>
        </Column>

        {mode === "priced" ? (
          <Column gap="4">
            {promoActive && (
              <Tag variant="brand" size="s" prefixIcon="sparkles" label="Promo de lanzamiento −50%" />
            )}
            <Row vertical="end" gap="8">
              {promoActive && (
                <Text
                  variant="heading-default-m"
                  onBackground="neutral-weak"
                  style={{ textDecoration: "line-through" }}
                >
                  {formatMXN(price)}
                </Text>
              )}
              <Text variant="display-strong-m">{formatMXN(promoActive ? promoPrice : price)}</Text>
              <Text variant="label-default-s" onBackground="neutral-weak" paddingBottom="4">
                / {billing === "monthly" ? "mes" : "año"}
              </Text>
            </Row>
            <Text variant="label-default-xs" onBackground="neutral-weak">
              {promoActive ? `hasta el 3 de agosto de 2027 · ${IVA_INCLUDED_LABEL}` : IVA_INCLUDED_LABEL}
            </Text>
          </Column>
        ) : (
          <Text variant="body-default-s" onBackground="neutral-weak">
            Todo lo que suma {plan.name}:
          </Text>
        )}

        <Column flex={1} gap="12">
          {plan.advantages.map((advantage) => (
            <Row key={advantage.text} gap="12" vertical="start">
              <Icon
                name={advantage.icon}
                size="xs"
                onBackground="brand-medium"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <Text variant="body-default-s" style={{ minWidth: 0, overflowWrap: "break-word" }}>
                {advantage.text}
              </Text>
            </Row>
          ))}
        </Column>

        {mode === "priced" ? (
          <Column gap="8">
            <Button onClick={() => setConfirmOpen(true)} loading={isPending} fillWidth arrowIcon>
              Hazte Pro
            </Button>
            {checkoutError && <Feedback variant="danger" description={checkoutError} />}
            <Dialog
              isOpen={confirmOpen}
              onClose={() => !isPending && setConfirmOpen(false)}
              title="Confirma tu suscripción"
              closeOnClickaway={!isPending}
              footer={
                <Row fillWidth gap="8" horizontal="end">
                  <Button
                    variant="secondary"
                    size="m"
                    onClick={() => setConfirmOpen(false)}
                    disabled={isPending}
                  >
                    Cancelar
                  </Button>
                  <Button variant="primary" size="m" onClick={handleCheckout} loading={isPending}>
                    Continuar al pago
                  </Button>
                </Row>
              }
            >
              <Feedback
                variant="info"
                description={`Al suscribirte, el cobro de ${formatMXN(promoActive ? promoPrice : price)} MXN se hará automáticamente cada ${billing === "monthly" ? "mes" : "año"} hasta que canceles. Puedes cancelar en cualquier momento desde Gestionar suscripción y conservarás Pro hasta el fin del periodo pagado.`}
              />
            </Dialog>
          </Column>
        ) : (
          <Button href="/sign-up" fillWidth variant="secondary" arrowIcon>
            Crea tu cuenta para ver los planes
          </Button>
        )}
      </Column>
    </RevealFx>
  );
}

// Columna "Free" al lado del único plan Pro visible para un usuario
// logueado (freelancer o client): mismo formato de tarjeta, sin precio ni
// CTA — solo lo que ya tiene hoy, para comparar de un vistazo.
function FreeColumnCard({ index }: { index: number }) {
  return (
    <RevealFx fill translateY="8" delay={index * 0.1}>
      <Column
        fill
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="32"
        gap="24"
        minWidth={0}
      >
        <Column gap="4" minWidth={0}>
          <Text variant="label-default-s" onBackground="neutral-weak">
            Tu plan actual
          </Text>
          <Heading as="h2" variant="heading-strong-l">
            Free
          </Heading>
          <Text
            variant="body-default-s"
            onBackground="neutral-weak"
            style={{ overflowWrap: "break-word" }}
          >
            Lo que ya tienes hoy en Hub-Nerds, sin costo.
          </Text>
        </Column>

        <Column flex={1} gap="12">
          {FREE_FEATURES.map((feature) => (
            <Row key={feature} gap="12" vertical="start">
              <Icon
                name="check"
                size="xs"
                onBackground="neutral-medium"
                style={{ flexShrink: 0, marginTop: 2 }}
              />
              <Text variant="body-default-s" style={{ minWidth: 0, overflowWrap: "break-word" }}>
                {feature}
              </Text>
            </Row>
          ))}
        </Column>

        <Row gap="8" vertical="center" paddingY="12">
          <Icon name="check" size="xs" onBackground="neutral-medium" />
          <Text variant="label-default-s" onBackground="neutral-weak">
            Ya lo tienes activo
          </Text>
        </Row>
      </Column>
    </RevealFx>
  );
}

interface ProPricingProps {
  isSignedIn: boolean;
  role: Role | undefined;
  promoActive: boolean;
}

export function ProPricing({ isSignedIn, role, promoActive }: ProPricingProps) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  // Sesión con rol resuelto (freelancer o client) → modo "priced": una sola
  // tarjeta Pro + columna Free al lado. Cualquier otro caso (visitante, o
  // sesión sin rol todavía) → modo "teaser": ambas tarjetas Pro, sin precios.
  const singlePlan = isSignedIn ? PRO_PLANS.find((plan) => plan.id === role) : undefined;
  const teaserMode = !singlePlan;

  return (
    <Column as="main" fillWidth horizontal="center" gap="104" paddingBottom="104">
      {/* Hero */}
      <Column fillWidth center overflow="hidden" paddingY="64" position="relative">
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
            y: 0,
            width: 150,
            height: 150,
          }}
          dots={{ display: true, opacity: 40, size: "2", color: "brand-background-strong" }}
        />
        <RevealFx translateY="8" fillWidth horizontal="center">
          <Column zIndex={1} center gap="16" padding="24" maxWidth={40}>
            <Row gap="8" vertical="center">
              <Icon name="sparkles" onBackground="brand-medium" size="s" />
              <Text variant="label-default-s" onBackground="brand-medium">
                Hub-Nerds Pro
              </Text>
            </Row>
            <Heading as="h1" variant="display-strong-xl" align="center">
              Hazte Pro
            </Heading>
            <Text
              variant="body-default-l"
              onBackground="neutral-weak"
              align="center"
              style={{ overflowWrap: "break-word" }}
            >
              Más visibilidad, más herramientas y una presencia que destaca — para freelancers y
              clients.
            </Text>
            {teaserMode && promoActive && (
              <Tag variant="brand" size="s" prefixIcon="sparkles" label="Promo de lanzamiento disponible" />
            )}
          </Column>
        </RevealFx>
      </Column>

      {/* Toggle (solo con plan único resuelto) + tarjetas de plan */}
      <Column fillWidth horizontal="center" paddingX="24">
        <Column fillWidth maxWidth="l" gap="40" minWidth={0}>
          {!teaserMode && (
            <Row fillWidth horizontal="center">
              <Column gap="12" horizontal="center" align="center">
                <SegmentedControl
                  selected={billing}
                  onToggle={(value) => setBilling(value as BillingCycle)}
                  buttons={[
                    { value: "monthly", label: "Mensual" },
                    { value: "yearly", label: "Anual" },
                  ]}
                />
                <Row height="24" vertical="center">
                  {billing === "yearly" && (
                    <Tag variant="brand" size="s" prefixIcon="sparkles" label={YEARLY_DISCOUNT_LABEL} />
                  )}
                </Row>
              </Column>
            </Row>
          )}

          <Grid columns="2" gap="24" s={{ columns: 1 }}>
            {teaserMode ? (
              PRO_PLANS.map((plan, index) => (
                <ProPlanCard
                  key={plan.id}
                  plan={plan}
                  index={index}
                  mode="teaser"
                  billing={billing}
                  promoActive={promoActive}
                />
              ))
            ) : (
              <>
                <FreeColumnCard index={0} />
                <ProPlanCard
                  key={singlePlan.id}
                  plan={singlePlan}
                  index={1}
                  mode="priced"
                  billing={billing}
                  promoActive={promoActive}
                />
              </>
            )}
          </Grid>
        </Column>
      </Column>

      {/* Free vs Pro: comparativa discreta, detalle en tooltip al hover */}
      <Column fillWidth horizontal="center" paddingX="24">
        <Column fillWidth maxWidth="m" gap="24" minWidth={0}>
          <Column gap="16" minWidth={0}>
            <Column gap="4">
              <Heading as="h2" variant="display-strong-xs">
                Free vs. Pro
              </Heading>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Free ya incluye lo esencial para trabajar en Hub-Nerds.
              </Text>
            </Column>
            <Row gap="8" wrap>
              {FREE_FEATURES.map((feature) => (
                <Tag key={feature} variant="neutral" size="s" label={feature} />
              ))}
            </Row>
          </Column>

          <Column
            fillWidth
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            padding="8"
            minWidth={0}
          >
            {COMPARISON_ROWS.map((row, index) => (
              <Row
                key={row.feature}
                fillWidth
                horizontal="between"
                vertical="center"
                gap="16"
                paddingX="16"
                paddingY="12"
                borderTop={index > 0 ? "neutral-alpha-weak" : undefined}
                s={{ direction: "column", horizontal: "start" }}
              >
                <Row gap="4" vertical="center" minWidth={0}>
                  <Text variant="body-default-s" onBackground="neutral-strong">
                    {row.feature}
                  </Text>
                  <IconButton
                    icon="infoCircle"
                    variant="ghost"
                    size="s"
                    tooltip={row.detail}
                    aria-label={`Detalle de ${row.feature}`}
                  />
                </Row>
                <Row gap="24" vertical="center">
                  <ComparisonCell label="Free" value={row.free} />
                  <ComparisonCell label="Pro" value={row.pro} highlighted />
                </Row>
              </Row>
            ))}
          </Column>
        </Column>
      </Column>
    </Column>
  );
}

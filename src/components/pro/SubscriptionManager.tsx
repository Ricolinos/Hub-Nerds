"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Column,
  Dialog,
  Feedback,
  Icon,
  Line,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";
import {
  cancelProSubscription,
  changeProInterval,
  createPortalSession,
  resumeProSubscription,
  type SubscriptionInfo,
} from "@/app/actions/billing";
import { IVA_INCLUDED_LABEL, PRO_PLANS, PROMO_PRICES, formatMXN, type ProPlanId } from "@/lib/proPlans";
import type { Role } from "@/lib/roles";

function formatFechaEsMX(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

// El redirect de una server action ("use server") navega el propio navegador
// vía un throw especial de Next (digest NEXT_REDIRECT) — nunca llega a
// resolverse la promesa en un cliente sano; solo se atrapan aquí errores
// reales (mismo criterio que ProPricing.tsx).
function isRedirectThrow(err: unknown): boolean {
  return err instanceof Error && err.message.includes("NEXT_REDIRECT");
}

interface SubscriptionManagerProps {
  info: SubscriptionInfo | null;
  role: Role | undefined;
}

export function SubscriptionManager({ info, role }: SubscriptionManagerProps) {
  const router = useRouter();

  const [portalPending, startPortal] = useTransition();
  const [portalError, setPortalError] = useState<string | null>(null);

  const handlePortal = () => {
    setPortalError(null);
    startPortal(async () => {
      try {
        await createPortalSession();
      } catch (err) {
        if (isRedirectThrow(err)) return;
        setPortalError(
          err instanceof Error ? err.message : "No se pudo abrir el portal de pagos. Intenta de nuevo.",
        );
      }
    });
  };

  // ── Free: sin suscripción activa ──────────────────────────────────────────
  if (!info || info.plan === "free") {
    return (
      <Column
        background="surface"
        border="neutral-alpha-weak"
        radius="l"
        padding="32"
        gap="16"
        fillWidth
        horizontal="center"
        align="center"
      >
        <Icon name="creditCard" size="l" onBackground="neutral-weak" />
        <Text variant="body-default-m" onBackground="neutral-weak" align="center">
          No tienes una suscripción activa.
        </Text>
        <Button href="/pro" arrowIcon>
          Descubre Hub-Nerds Pro
        </Button>
      </Column>
    );
  }

  const planId: ProPlanId = role === "client" ? "client" : "freelancer";
  const planName = role === "client" ? "Client Pro" : "Freelancer Pro";
  const intervalLabel = info.interval === "year" ? "año" : "mes";
  const periodEndLabel = formatFechaEsMX(info.currentPeriodEnd);

  // ── past_due: el último cobro falló ───────────────────────────────────────
  if (info.status === "past_due") {
    return (
      <Column background="surface" border="danger-alpha-medium" radius="l" padding="24" gap="16" fillWidth>
        <Feedback
          variant="danger"
          title="Tu último cobro falló"
          description="Actualiza tu método de pago desde el portal de Stripe para mantener tu plan Pro activo."
        />
        {portalError && <Feedback variant="danger" description={portalError} />}
        <Row>
          <Button onClick={handlePortal} loading={portalPending}>
            Actualizar método de pago
          </Button>
        </Row>
      </Column>
    );
  }

  return (
    <ProActiveCard
      info={info}
      planId={planId}
      planName={planName}
      intervalLabel={intervalLabel}
      periodEndLabel={periodEndLabel}
      portalPending={portalPending}
      portalError={portalError}
      onPortal={handlePortal}
      onRefresh={() => router.refresh()}
    />
  );
}

// ── Pro activo (o con cancelación programada) ────────────────────────────────
function ProActiveCard({
  info,
  planId,
  planName,
  intervalLabel,
  periodEndLabel,
  portalPending,
  portalError,
  onPortal,
  onRefresh,
}: {
  info: SubscriptionInfo;
  planId: ProPlanId;
  planName: string;
  intervalLabel: string;
  periodEndLabel: string;
  portalPending: boolean;
  portalError: string | null;
  onPortal: () => void;
  onRefresh: () => void;
}) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [changePending, startChange] = useTransition();
  const [cancelPending, startCancel] = useTransition();
  const [resumePending, startResume] = useTransition();

  const currentInterval = info.interval ?? "month";
  const targetInterval: "month" | "year" = currentInterval === "month" ? "year" : "month";
  const targetIntervalLabel = targetInterval === "year" ? "anual" : "mensual";
  const targetBilling = targetInterval === "year" ? "yearly" : "monthly";
  const plan = PRO_PLANS.find((p) => p.id === planId);
  const newAmount = plan
    ? info.isPromo
      ? PROMO_PRICES[planId][targetBilling]
      : plan.price[targetBilling]
    : null;

  const handleChangeInterval = () => {
    setActionError(null);
    startChange(async () => {
      const result = await changeProInterval(targetInterval);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setChangeOpen(false);
      onRefresh();
    });
  };

  const handleCancel = () => {
    setActionError(null);
    startCancel(async () => {
      const result = await cancelProSubscription();
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setCancelOpen(false);
      onRefresh();
    });
  };

  const handleResume = () => {
    setActionError(null);
    startResume(async () => {
      const result = await resumeProSubscription();
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setResumeOpen(false);
      onRefresh();
    });
  };

  return (
    <Column background="surface" border="neutral-alpha-weak" radius="l" padding="24" gap="20" fillWidth>
      <Column gap="4">
        <Row gap="8" vertical="center" wrap>
          <Text variant="label-strong-s">{planName}</Text>
          <Badge
            textVariant="label-default-xs"
            background="brand-alpha-weak"
            onBackground="brand-medium"
            paddingX="8"
            paddingY="2"
            radius="full"
          >
            Pro
          </Badge>
          {info.isPromo && (
            <Tag variant="brand" size="s" prefixIcon="sparkles" label="Promo de lanzamiento" />
          )}
        </Row>
        <Row vertical="end" gap="8">
          <Text variant="display-strong-m">{formatMXN(info.amountMXN ?? 0)}</Text>
          <Text variant="label-default-s" onBackground="neutral-weak" paddingBottom="4">
            / {intervalLabel}
          </Text>
        </Row>
        <Text variant="label-default-xs" onBackground="neutral-weak">
          {IVA_INCLUDED_LABEL}
        </Text>
      </Column>

      {info.cancelAtPeriodEnd ? (
        <Feedback
          variant="warning"
          title="Cancelación programada"
          description={`Tu plan Pro seguirá activo hasta el ${periodEndLabel}. Después pasarás a Free automáticamente.`}
        />
      ) : (
        periodEndLabel && (
          <Row gap="8" vertical="center">
            <Icon name="calendar" size="xs" onBackground="neutral-weak" />
            <Text variant="body-default-s" onBackground="neutral-weak">
              Se renueva automáticamente el {periodEndLabel}
            </Text>
          </Row>
        )
      )}

      {actionError && <Feedback variant="danger" description={actionError} />}
      {portalError && <Feedback variant="danger" description={portalError} />}

      <Line background="neutral-alpha-weak" />

      {info.cancelAtPeriodEnd ? (
        <Row gap="8" wrap>
          <Button onClick={() => setResumeOpen(true)} prefixIcon="refreshCw">
            Reactivar
          </Button>
          <Button variant="secondary" size="m" onClick={onPortal} loading={portalPending}>
            Métodos de pago y facturas
          </Button>
        </Row>
      ) : (
        <Row gap="8" wrap>
          <Button variant="secondary" size="m" onClick={() => setChangeOpen(true)}>
            Cambiar a {targetIntervalLabel}
          </Button>
          <Button variant="secondary" size="m" onClick={onPortal} loading={portalPending}>
            Métodos de pago y facturas
          </Button>
          <Button variant="tertiary" size="m" onClick={() => setCancelOpen(true)}>
            Cancelar suscripción
          </Button>
        </Row>
      )}

      {/* ── Confirmar cambio de periodicidad ──────────────────────────────── */}
      <Dialog
        isOpen={changeOpen}
        onClose={() => !changePending && setChangeOpen(false)}
        title={`Cambiar a plan ${targetIntervalLabel}`}
        closeOnClickaway={!changePending}
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => setChangeOpen(false)}
              disabled={changePending}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleChangeInterval} loading={changePending}>
              Confirmar cambio
            </Button>
          </Row>
        }
      >
        <Column gap="12" fillWidth>
          <Text variant="body-default-m">
            El cambio se aplica de inmediato. Stripe ajustará el cobro de forma justa: se acredita el
            tiempo no utilizado de tu periodo actual y solo pagas la diferencia.
          </Text>
          {newAmount != null && (
            <Text variant="label-strong-s">
              Nuevo monto: {formatMXN(newAmount)} / {targetInterval === "year" ? "año" : "mes"}
            </Text>
          )}
        </Column>
      </Dialog>

      {/* ── Confirmar cancelación ─────────────────────────────────────────── */}
      <Dialog
        isOpen={cancelOpen}
        onClose={() => !cancelPending && setCancelOpen(false)}
        title="¿Cancelar tu suscripción Pro?"
        closeOnClickaway={!cancelPending}
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => setCancelOpen(false)}
              disabled={cancelPending}
            >
              Seguir con Pro
            </Button>
            <Button variant="danger" size="m" onClick={handleCancel} loading={cancelPending}>
              Sí, cancelar
            </Button>
          </Row>
        }
      >
        <Feedback
          variant="warning"
          icon
          description={`Tu plan Pro seguirá activo hasta el ${periodEndLabel}. Después no se te volverá a cobrar y tu cuenta pasará a Free. Puedes reactivarla cuando quieras antes de esa fecha.`}
        />
      </Dialog>

      {/* ── Confirmar reactivación ────────────────────────────────────────── */}
      <Dialog
        isOpen={resumeOpen}
        onClose={() => !resumePending && setResumeOpen(false)}
        title="Reactivar suscripción"
        closeOnClickaway={!resumePending}
        footer={
          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => setResumeOpen(false)}
              disabled={resumePending}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="m" onClick={handleResume} loading={resumePending}>
              Reactivar
            </Button>
          </Row>
        }
      >
        <Text variant="body-default-m">
          Se reanudará el cobro automático al final de tu periodo actual, el {periodEndLabel}. Seguirás
          en el plan Pro sin interrupciones.
        </Text>
      </Dialog>
    </Column>
  );
}

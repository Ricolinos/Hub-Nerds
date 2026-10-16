"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getOrCreateUser } from "@/lib/syncUser";
import { normalizeRole } from "@/lib/roles";
import { resolvePriceLookupKey } from "@/lib/plan";
import type Stripe from "stripe";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// Asegura que el User tenga un Stripe Customer asociado (metadata.app_user_id
// para poder localizarlo de vuelta desde el webhook) y lo persiste en la BD.
// Nunca se pasa `customer_email` a Checkout: siempre `customer`, así Stripe
// reutiliza el mismo Customer en pagos futuros en vez de crear uno nuevo por
// cada sesión. Exportado: reutilizado por
// src/app/actions/contestPayments.ts (pagos de premios de convocatorias).
export async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { app_user_id: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// Inicia el checkout hosted de Stripe para el plan Pro (Freelancer o Client,
// según el rol del usuario) y redirige a session.url. El precio se resuelve
// SIEMPRE por lookup_key (nunca un price ID hardcodeado): ver
// src/lib/plan.ts y scripts/stripe-setup.mjs.
export async function createProCheckoutSession(interval: "month" | "year"): Promise<never> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const dbUser = await getOrCreateUser();
  if (!dbUser) throw new Error("No se pudo cargar el usuario");

  const role = normalizeRole(dbUser.role);
  if (!role) throw new Error("El usuario no tiene un rol válido");

  const customerId = await ensureStripeCustomer(dbUser);

  const lookupKey = resolvePriceLookupKey(role, interval);
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const price = prices.data[0];
  if (!price) {
    throw new Error(
      `No se encontró el Price de Stripe con lookup_key "${lookupKey}". ` +
        `Corre scripts/stripe-setup.mjs para aprovisionarlo.`,
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${APP_URL}/pro/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/pro`,
    metadata: { userId, plan: role },
    subscription_data: {
      metadata: { userId, plan: role },
    },
  });

  if (!session.url) throw new Error("Stripe no devolvió una URL de checkout");

  redirect(session.url);
}

// Abre el Customer Portal de Stripe (gestionar/cancelar suscripción, cambiar
// método de pago, ver facturas) para el usuario autenticado.
export async function createPortalSession(): Promise<never> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    throw new Error("Este usuario todavía no tiene una suscripción de Stripe asociada.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${APP_URL}/pro`,
    // Configuración custom (cancel_at_period_end, cambio de price entre los
    // 8 lookup_keys de Pro, etc.) aprovisionada por scripts/stripe-setup.mjs.
    // Si no está seteada, Stripe cae a la configuración default de la cuenta.
    ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
      ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
      : {}),
  });

  redirect(session.url);
}

/* ══ Panel de suscripción (/pro/suscripcion) ════════════════════════════
   Shape consumido por la página — ver contrato en el prompt del agente de
   datos: plan/status/interval/currentPeriodEnd/cancelAtPeriodEnd/amountMXN/
   isPromo, todo derivado en vivo de Stripe (nunca solo de la BD) salvo el
   caso "free" que no necesita llamar a Stripe. ══════════════════════════ */

export type SubscriptionInfo = {
  plan: "free" | "pro";
  status: string | null;
  interval: "month" | "year" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  amountMXN: number | null;
  isPromo: boolean;
};

const FREE_SUBSCRIPTION_INFO: SubscriptionInfo = {
  plan: "free",
  status: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  amountMXN: null,
  isPromo: false,
};

// Trae, para el usuario autenticado, la suscripción de Stripe más reciente
// (preferentemente no cancelada) y la resume al shape que consume la página
// /pro/suscripcion. Devuelve null solo si no hay sesión.
export async function getSubscriptionInfo(): Promise<SubscriptionInfo | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, stripeCustomerId: true },
  });
  if (!dbUser) return null;
  if (!dbUser.stripeCustomerId || dbUser.plan !== "pro") return FREE_SUBSCRIPTION_INFO;

  const subscriptions = await stripe.subscriptions.list({
    customer: dbUser.stripeCustomerId,
    status: "all",
    limit: 10,
  });
  if (subscriptions.data.length === 0) return FREE_SUBSCRIPTION_INFO;

  // Prioriza una suscripción vigente (no canceled/incomplete_expired) sobre
  // el resto; si todas están cerradas, cae a la más reciente (created desc,
  // ya viene ordenado así por la API de Stripe).
  const subscription =
    subscriptions.data.find(
      (sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired",
    ) ?? subscriptions.data[0];

  const item = subscription.items.data[0];
  const price = item?.price;

  return {
    plan: dbUser.plan === "pro" ? "pro" : "free",
    status: subscription.status,
    interval: (price?.recurring?.interval as "month" | "year" | undefined) ?? null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    amountMXN: typeof price?.unit_amount === "number" ? price.unit_amount / 100 : null,
    isPromo: typeof price?.lookup_key === "string" && price.lookup_key.endsWith("_promo50"),
  };
}

// Cambia la periodicidad (mensual↔anual) de la suscripción activa del
// usuario. `proration_behavior: "always_invoice"` factura de inmediato la
// diferencia (o acredita el tiempo no usado), en ambas direcciones.
export async function changeProInterval(
  newInterval: "month" | "year",
): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "No autenticado" };

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, plan: true, stripeCustomerId: true },
  });
  if (!dbUser?.stripeCustomerId || dbUser.plan !== "pro") {
    return { error: "No tienes una suscripción Pro activa." };
  }

  const role = normalizeRole(dbUser.role);
  if (!role) return { error: "El usuario no tiene un rol válido." };

  const subscriptions = await stripe.subscriptions.list({
    customer: dbUser.stripeCustomerId,
    status: "active",
    limit: 1,
  });
  const subscription = subscriptions.data[0];
  if (!subscription) return { error: "No se encontró una suscripción activa para cambiar." };

  const item = subscription.items.data[0];
  if (!item) return { error: "La suscripción no tiene un ítem de precio válido." };

  if (item.price.recurring?.interval === newInterval) {
    return { error: "Ya tienes esa periodicidad activa." };
  }

  const lookupKey = resolvePriceLookupKey(role, newInterval);
  const prices = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const newPrice = prices.data[0];
  if (!newPrice) {
    return { error: "No se encontró el nuevo precio en Stripe. Contacta a soporte." };
  }

  try {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: newPrice.id }],
      proration_behavior: "always_invoice",
      payment_behavior: "allow_incomplete",
    });
  } catch (error) {
    console.error("changeProInterval: fallo actualizando la suscripción en Stripe", error);
    return { error: "No se pudo cambiar la periodicidad. Intenta de nuevo en unos minutos." };
  }

  // Optimista: la verdad final la escribe el webhook
  // (customer.subscription.updated) al llegar.
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { planInterval: newInterval },
  });

  return { ok: true };
}

// Resuelve la suscripción activa (o en gracia past_due) del customer del
// usuario autenticado; helper compartido por cancel/resume.
async function findManageableSubscription(
  stripeCustomerId: string,
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });
  return (
    subscriptions.data.find((sub) => sub.status === "active" || sub.status === "trialing" || sub.status === "past_due") ??
    null
  );
}

// Marca la suscripción para cancelarse al final del periodo vigente. NUNCA
// cancelación inmediata: el usuario sigue Pro hasta planPeriodEnd, y es el
// webhook customer.subscription.deleted el que finalmente baja el plan a
// "free" cuando Stripe cierre la suscripción de verdad.
export async function cancelProSubscription(): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "No autenticado" };

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!dbUser?.stripeCustomerId) return { error: "No tienes una suscripción Pro activa." };

  const subscription = await findManageableSubscription(dbUser.stripeCustomerId);
  if (!subscription) return { error: "No se encontró una suscripción activa para cancelar." };

  try {
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
  } catch (error) {
    console.error("cancelProSubscription: fallo actualizando la suscripción en Stripe", error);
    return { error: "No se pudo cancelar la suscripción. Intenta de nuevo en unos minutos." };
  }

  return { ok: true };
}

// Revierte una cancelación programada (cancel_at_period_end vuelve a false)
// antes de que el periodo termine.
export async function resumeProSubscription(): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "No autenticado" };

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!dbUser?.stripeCustomerId) return { error: "No tienes una suscripción Pro activa." };

  const subscription = await findManageableSubscription(dbUser.stripeCustomerId);
  if (!subscription) return { error: "No se encontró una suscripción para reactivar." };
  if (!subscription.cancel_at_period_end) return { error: "Esta suscripción no está programada para cancelarse." };

  try {
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false });
  } catch (error) {
    console.error("resumeProSubscription: fallo actualizando la suscripción en Stripe", error);
    return { error: "No se pudo reactivar la suscripción. Intenta de nuevo en unos minutos." };
  }

  return { ok: true };
}

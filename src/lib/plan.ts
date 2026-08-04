import { isPromoActive } from "@/lib/proPlans";

// Lookup keys de los Prices recurrentes en Stripe (ver
// scripts/stripe-setup.mjs, que los crea/asegura de forma idempotente).
// Nunca se hardcodean price IDs: siempre se resuelven por lookup_key
// (stripe.prices.list({ lookup_keys: [...] })) para poder rotar montos sin
// tocar código.
export const PLAN_LOOKUP_KEYS = {
  freelancer_pro_monthly: "freelancer_pro_monthly",
  freelancer_pro_yearly: "freelancer_pro_yearly",
  client_pro_monthly: "client_pro_monthly",
  client_pro_yearly: "client_pro_yearly",
  freelancer_pro_monthly_promo50: "freelancer_pro_monthly_promo50",
  freelancer_pro_yearly_promo50: "freelancer_pro_yearly_promo50",
  client_pro_monthly_promo50: "client_pro_monthly_promo50",
  client_pro_yearly_promo50: "client_pro_yearly_promo50",
} as const;

export type PlanLookupKey = (typeof PLAN_LOOKUP_KEYS)[keyof typeof PLAN_LOOKUP_KEYS];

// Resuelve el lookup_key del Price a cobrar según rol + periodicidad. Con la
// promo de lanzamiento activa (isPromoActive(), corte automático el
// 3-ago-2027 sin deploy: ver src/lib/proPlans.ts) devuelve la variante
// "_promo50" (50% de descuento), si no la tarifa regular.
export function resolvePriceLookupKey(
  role: "freelancer" | "client",
  interval: "month" | "year",
  now: Date = new Date(),
): PlanLookupKey {
  const cycle = interval === "month" ? "monthly" : "yearly";
  const base = `${role}_pro_${cycle}` as const;
  return (isPromoActive(now) ? `${base}_promo50` : base) as PlanLookupKey;
}

// "Acceso Pro" efectivo: plan pagado Y en un status que no debe cortar el
// acceso todavía. past_due entra con gracia (Stripe ya está reintentando el
// cobro; se corta hasta que el webhook reciba customer.subscription.deleted
// o el status cambie a canceled/unpaid).
export function isPro(user: { plan?: string | null; planStatus?: string | null }): boolean {
  return (
    user.plan === "pro" &&
    !!user.planStatus &&
    ["active", "trialing", "past_due"].includes(user.planStatus)
  );
}

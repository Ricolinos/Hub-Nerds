import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/* ══ Webhook de Stripe: única fuente de verdad del plan Pro ════════════════
   Configurar en el Dashboard de Stripe (o `stripe listen` en local) un
   endpoint apuntando a /api/webhooks/stripe con los eventos:
   checkout.session.completed, customer.subscription.created,
   customer.subscription.updated, customer.subscription.deleted,
   invoice.payment_failed. Copiar el "Signing secret" a
   STRIPE_WEBHOOK_SECRET. Mismo patrón que src/app/api/webhooks/clerk/route.ts
   (raw body, verificación de firma en try/catch, P2025 benigno). ══════════ */

// Localiza al User por metadata.userId (checkout.session.completed) o por
// stripeCustomerId (eventos de subscription/invoice, que no siempre traen
// metadata propia si la suscripción no nació de nuestro checkout).
async function findUserId(customerId: string, metadataUserId?: string | null) {
  if (metadataUserId) return metadataUserId;
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}

// plan="pro" solo si el status de Stripe todavía cuenta como acceso vigente
// (mismo criterio que isPro() en src/lib/plan.ts).
function planFromStatus(status: Stripe.Subscription.Status): "pro" | "free" {
  return status === "active" || status === "trialing" || status === "past_due" ? "pro" : "free";
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const userId = await findUserId(customerId, subscription.metadata?.userId);
  if (!userId) {
    console.error(`stripe webhook: no se encontró User para customer ${customerId}`);
    return;
  }

  const item = subscription.items.data[0];
  const planInterval = item?.price?.recurring?.interval ?? null;
  const periodEndSeconds = item?.current_period_end ?? null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planFromStatus(subscription.status),
      planStatus: subscription.status,
      planInterval,
      planPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
      stripeCustomerId: customerId,
    },
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("stripe webhook: falta STRIPE_WEBHOOK_SECRET en el entorno");
    return NextResponse.json({ error: "Error de configuración" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Falta el header stripe-signature");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("stripe webhook: firma inválida", error);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  // Dedupe: si ya procesamos este event.id (reintento de Stripe), no repetir
  // efectos secundarios. P2002 = ya existía la fila.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, skipped: "evento-duplicado" });
    }
    console.error("stripe webhook: no se pudo registrar el dedupe", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Pago de premio/fee de convocatoria (Fase 3, Términos §3.3-§3.5):
        // mode "payment", nunca "subscription". Distinto del checkout de
        // plan Pro de abajo (ese SIEMPRE trae metadata.userId sin
        // metadata.type). Ver src/app/actions/contestPayments.ts.
        if (session.metadata?.type === "contest_payment") {
          const contestPaymentId = session.metadata?.contestPaymentId;
          if (contestPaymentId) {
            // P2025 (la fila ya no existe) se maneja de forma benigna en el
            // catch de abajo, igual que el resto de este webhook.
            await prisma.contestPayment.update({
              where: { id: contestPaymentId },
              data: { status: "PAID", paidAt: new Date(), stripeSessionId: session.id },
            });
          } else {
            console.error(
              "stripe webhook: checkout.session.completed (contest_payment) sin metadata.contestPaymentId",
              session.id,
            );
          }
          break;
        }

        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: "pro",
              planStatus: "active",
              ...(customerId ? { stripeCustomerId: customerId } : {}),
            },
          });
        } else {
          console.error("stripe webhook: checkout.session.completed sin metadata.userId", session.id);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const userId = await findUserId(customerId, subscription.metadata?.userId);
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: { plan: "free", planStatus: "canceled" },
          });
        } else {
          console.error(`stripe webhook: no se encontró User para customer ${customerId} (subscription.deleted)`);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
          if (user) {
            await prisma.user.update({ where: { id: user.id }, data: { planStatus: "past_due" } });
          } else {
            console.error(`stripe webhook: no se encontró User para customer ${customerId} (payment_failed)`);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // P2025: la fila ya no existía (usuario borrado mientras tanto) — no es
    // un error accionable por reintentos, mismo criterio que el webhook de
    // Clerk (ver src/app/api/webhooks/clerk/route.ts).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: true });
    }
    console.error(`stripe webhook: fallo procesando "${event.type}"`, error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

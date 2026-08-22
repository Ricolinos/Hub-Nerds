import Stripe from "stripe";

// Singleton del SDK de Stripe (patrón análogo a src/lib/prisma.ts: una sola
// instancia reutilizada entre requests en dev gracias al HMR de Next.js).
// apiVersion fijo a la versión instalada del SDK (stripe@22.4.0) para que
// las respuestas de la API no cambien de forma bajo nuestros pies sin que
// también actualicemos el paquete.
const globalForStripe = globalThis as unknown as { stripe?: Stripe };

function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Fallback para build time: en Vercel/dev sin la key configurada el build
    // seguiría, pero cualquier uso real de Stripe falla en runtime con un
    // mensaje claro. Se reemplaza por el cliente real en cuanto se configure
    // STRIPE_SECRET_KEY en el dashboard de Vercel.
    return new Proxy({} as Stripe, {
      get(_, prop) {
        throw new Error(
          `Stripe no está configurado: falta STRIPE_SECRET_KEY (propiedad "${String(prop)}").`,
        );
      },
    });
  }
  return new Stripe(key, {
    apiVersion: "2026-07-29.dahlia",
    maxNetworkRetries: 2,
  });
}

export const stripe = globalForStripe.stripe ?? createStripeClient();

if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;

// Aprovisiona (idempotente) los Products y Prices de Stripe para el plan Pro
// de Hub-Nerds. Correrlo tantas veces como haga falta no duplica nada: busca
// por lookup_key/nombre antes de crear. Si un Price ya existe con un monto
// distinto al configurado aquí, se archiva (active:false, Stripe no permite
// borrar Prices) y se crea uno nuevo con el mismo lookup_key transferido
// (transfer_lookup_key: true) para que el código de la app siga resolviendo
// el precio vigente sin cambios.
//
// Uso: node --env-file=.env.local scripts/stripe-setup.mjs
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Falta STRIPE_SECRET_KEY en el entorno (.env.local).");
  process.exit(1);
}

const stripe = new Stripe(secretKey, {
  apiVersion: "2026-07-29.dahlia",
  maxNetworkRetries: 2,
});

const PRODUCTS = {
  freelancer: { name: "Hub-Nerds Freelancer Pro" },
  client: { name: "Hub-Nerds Client Pro" },
};

// unit_amount en centavos de MXN. tax_behavior "inclusive": el IVA ya va
// incluido en el monto (no se suma aparte al checkout).
const PRICES = [
  { role: "freelancer", interval: "month", lookupKey: "freelancer_pro_monthly", unitAmount: 12000 },
  { role: "freelancer", interval: "year", lookupKey: "freelancer_pro_yearly", unitAmount: 119900 },
  { role: "client", interval: "month", lookupKey: "client_pro_monthly", unitAmount: 19900 },
  { role: "client", interval: "year", lookupKey: "client_pro_yearly", unitAmount: 199900 },
  // Promo de lanzamiento (50%), vigente hasta PROMO_END en src/lib/proPlans.ts
  { role: "freelancer", interval: "month", lookupKey: "freelancer_pro_monthly_promo50", unitAmount: 6000 },
  { role: "freelancer", interval: "year", lookupKey: "freelancer_pro_yearly_promo50", unitAmount: 59900 },
  { role: "client", interval: "month", lookupKey: "client_pro_monthly_promo50", unitAmount: 9900 },
  { role: "client", interval: "year", lookupKey: "client_pro_yearly_promo50", unitAmount: 99900 },
];

async function findProductByName(name) {
  const list = await stripe.products.list({ limit: 100, active: true });
  return list.data.find((product) => product.name === name) ?? null;
}

async function ensureProduct(role) {
  const { name } = PRODUCTS[role];
  const existing = await findProductByName(name);
  if (existing) {
    console.log(`Product ya existe: ${name} (${existing.id})`);
    return existing;
  }
  const created = await stripe.products.create({
    name,
    metadata: { role },
  });
  console.log(`Product creado: ${name} (${created.id})`);
  return created;
}

async function findPriceByLookupKey(lookupKey) {
  const list = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  return list.data[0] ?? null;
}

async function ensurePrice(product, spec) {
  const existing = await findPriceByLookupKey(spec.lookupKey);

  if (existing) {
    const sameAmount = existing.unit_amount === spec.unitAmount;
    const sameCurrency = existing.currency === "mxn";
    const sameInterval = existing.recurring?.interval === spec.interval;

    if (sameAmount && sameCurrency && sameInterval) {
      console.log(`Price sin cambios: ${spec.lookupKey} (${existing.id}) = ${spec.unitAmount}¢ MXN`);
      return existing;
    }

    console.log(
      `Price desactualizado: ${spec.lookupKey} (${existing.id}) — archivando y recreando ` +
        `(${existing.unit_amount}¢ → ${spec.unitAmount}¢)`,
    );
    // Stripe no permite borrar Prices; se desactiva y se libera el
    // lookup_key para que el nuevo lo tome.
    await stripe.prices.update(existing.id, { active: false, lookup_key: null });
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: "mxn",
    unit_amount: spec.unitAmount,
    tax_behavior: "inclusive",
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: { role: spec.role },
  });
  console.log(`Price creado: ${spec.lookupKey} (${created.id}) = ${spec.unitAmount}¢ MXN / ${spec.interval}`);
  return created;
}

// Busca una Billing Portal Configuration ya aprovisionada por este script
// (metadata.app === "hub-nerds"). El portal no tiene lookup por metadata en
// el listado, así que se filtra en memoria (la cuenta rara vez tiene más de
// un puñado de configuraciones).
async function findExistingPortalConfiguration() {
  const list = await stripe.billingPortal.configurations.list({ limit: 100 });
  return list.data.find((config) => config.metadata?.app === "hub-nerds") ?? null;
}

// Crea (o actualiza in-place si ya existe) la Billing Portal Configuration
// que usa createPortalSession (src/app/actions/billing.ts) vía
// STRIPE_PORTAL_CONFIGURATION_ID. Permite cancelar solo al final del periodo
// (nunca inmediato) y cambiar entre los Prices de Pro con prorrateo
// "always_invoice" (cobra/acredita la diferencia de inmediato, en ambas
// direcciones). Si Stripe rechaza mezclar precios promo/no-promo en el mismo
// `products[].prices`, se reintenta solo con los no-promo.
async function ensurePortalConfiguration(products, priceResults) {
  const priceIdByLookupKey = new Map(priceResults.map((r) => [r.lookupKey, r.priceId]));
  const nonPromoPriceIds = (role) =>
    [`${role}_pro_monthly`, `${role}_pro_yearly`].map((key) => priceIdByLookupKey.get(key));
  const allPriceIds = (role) =>
    [
      `${role}_pro_monthly`,
      `${role}_pro_yearly`,
      `${role}_pro_monthly_promo50`,
      `${role}_pro_yearly_promo50`,
    ].map((key) => priceIdByLookupKey.get(key));

  const buildParams = (includePromo) => ({
    metadata: { app: "hub-nerds" },
    business_profile: {
      headline: "Hub-Nerds Pro",
    },
    features: {
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        proration_behavior: "always_invoice",
        products: [
          { product: products.freelancer.id, prices: includePromo ? allPriceIds("freelancer") : nonPromoPriceIds("freelancer") },
          { product: products.client.id, prices: includePromo ? allPriceIds("client") : nonPromoPriceIds("client") },
        ],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });

  const existing = await findExistingPortalConfiguration();

  const tryConfigure = async (includePromo) => {
    const params = buildParams(includePromo);
    if (existing) {
      const updated = await stripe.billingPortal.configurations.update(existing.id, params);
      return { configuration: updated, includePromo };
    }
    const created = await stripe.billingPortal.configurations.create(params);
    return { configuration: created, includePromo };
  };

  try {
    return await tryConfigure(true);
  } catch (error) {
    console.log(
      `Billing Portal Configuration: Stripe rechazó mezclar prices promo/no-promo (${error.message}). ` +
        `Reintentando solo con precios regulares.`,
    );
    return await tryConfigure(false);
  }
}

async function main() {
  const products = {
    freelancer: await ensureProduct("freelancer"),
    client: await ensureProduct("client"),
  };

  const results = [];
  for (const spec of PRICES) {
    const product = products[spec.role];
    const price = await ensurePrice(product, spec);
    results.push({ lookupKey: spec.lookupKey, priceId: price.id, unitAmount: spec.unitAmount });
  }

  const { configuration, includePromo } = await ensurePortalConfiguration(products, results);
  console.log(
    `\nBilling Portal Configuration: ${configuration.id} ` +
      `(${includePromo ? "con" : "sin"} precios promo en subscription_update.products)`,
  );
  console.log(`Añade a .env.local: STRIPE_PORTAL_CONFIGURATION_ID=${configuration.id}`);

  console.log("\n── Resumen de lookup_keys → price IDs ──");
  for (const r of results) {
    console.log(`${r.lookupKey.padEnd(32)} ${r.priceId}`);
  }
}

main().catch((error) => {
  console.error("stripe-setup: fallo", error);
  process.exit(1);
});

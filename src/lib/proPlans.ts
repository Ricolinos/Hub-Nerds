import type { IconName } from "@once-ui-system/core";

// ─────────────────────────────────────────────────────────────────────────
// Precios y contenido de referencia para la landing /pro (definidos por
// Ricardo, 2026-08). Freelancer Pro: $120/mes ó $1,199/año. Client Pro:
// $199/mes ó $1,999/año. Todos los montos de esta tabla YA incluyen IVA
// (ver IVA_INCLUDED_LABEL) — no se le suma nada más en checkout.
// ─────────────────────────────────────────────────────────────────────────

export type BillingCycle = "monthly" | "yearly";
export type ProPlanId = "freelancer" | "client";

export interface ProAdvantage {
  icon: IconName;
  text: string;
}

export interface ProPlan {
  id: ProPlanId;
  name: string;
  audience: string;
  tagline: string;
  price: { monthly: number; yearly: number };
  advantages: ProAdvantage[];
}

export const PRO_PLANS: ProPlan[] = [
  {
    id: "freelancer",
    name: "Freelancer Pro",
    audience: "Para Freelancers",
    tagline: "Destaca tu talento y consigue más proyectos.",
    price: { monthly: 120, yearly: 1199 },
    advantages: [
      { icon: "document", text: "CV Live en tu perfil (experiencia y skills)" },
      { icon: "search", text: "Prioridad en la búsqueda de freelancers" },
      { icon: "sparkles", text: "Posibilidad de aparecer destacado en el feed y el Hero" },
      { icon: "shield", text: "Tarjeta Designerd exclusiva Pro con insignia" },
      { icon: "eye", text: "Estadísticas de perfil (vistas y likes)" },
      { icon: "shapes", text: "Hasta 5 especialidades visibles" },
      { icon: "rocket", text: "Aplicación destacada en Convocatorias" },
    ],
  },
  {
    id: "client",
    name: "Client Pro",
    audience: "Para Clients",
    tagline: "Encuentra al freelancer correcto más rápido y gestiona todo desde un solo lugar.",
    price: { monthly: 199, yearly: 1999 },
    advantages: [
      {
        icon: "mapPin",
        text: "Sugerencias de freelancers más precisas según tus datos (p. ej. cercanos a tu zona)",
      },
      { icon: "grid", text: "Gestión simultánea de varios proyectos" },
      { icon: "chat", text: "Mejor administración de grupos de chat" },
      { icon: "compare", text: "Sección de Gráficas de rendimiento" },
      { icon: "bell", text: "Alertas a tus freelancers" },
      {
        icon: "phone",
        text: "Acceso a datos de contacto de freelancers que lo permitan",
      },
    ],
  },
];

// Lo que ya existe hoy para todos (Free), sin importar el rol.
export const FREE_FEATURES: string[] = [
  "Portafolio y perfil públicos",
  "Mensajes con clients y freelancers",
  "Colaboración en proyectos",
  "1 convocatoria activa",
];

export const YEARLY_DISCOUNT_LABEL = "2 meses gratis";

export interface ComparisonRow {
  feature: string;
  free: boolean | string;
  pro: boolean | string;
  detail: string;
}

// Comparativa discreta Free vs Pro (icono +/− con detalle en tooltip al
// hover, ver ProPricing.tsx) — resumen cruzado de ambos planes Pro.
export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Portafolio y perfil",
    free: true,
    pro: true,
    detail: "En Pro tu perfil suma CV Live (freelancer) o mejores herramientas de gestión (client).",
  },
  {
    feature: "Mensajes y colaboración",
    free: true,
    pro: true,
    detail:
      "Igual en ambos planes; Pro suma una tarjeta Designerd con insignia (freelancer) y mejor administración de grupos de chat (client).",
  },
  {
    feature: "Convocatorias",
    free: "1 activa",
    pro: "Destacadas y sin límite",
    detail: "Free limita a una convocatoria activa a la vez; Pro las destaca y quita el límite.",
  },
  {
    feature: "Visibilidad en búsqueda",
    free: false,
    pro: true,
    detail:
      "Prioridad en resultados de búsqueda. El feed y el Hero de la home rotan al azar entre las piezas publicadas, dando prioridad a las de usuarios Pro — no es un espacio fijo garantizado.",
  },
  {
    feature: "Estadísticas y espacio extra",
    free: false,
    pro: true,
    detail: "Vistas y likes de perfil (freelancer); Gráficas de rendimiento y alertas (client).",
  },
];

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(amount);
}

// Todos los precios de PRO_PLANS y PROMO_PRICES ya incluyen IVA — la landing
// nunca debe sumar impuestos aparte, solo mostrar esta leyenda.
export const IVA_INCLUDED_LABEL = "IVA incluido";

// ─────────────────────────────────────────────────────────────────────────
// Promo de lanzamiento: 50% de descuento hasta la medianoche del 3 de
// agosto de 2027 en Ciudad de México (UTC−6 → 2027-08-04T06:00:00Z). Se
// evalúa por request en el server (ver src/app/pro/page.tsx), nunca en
// build time, para que el corte sea automático sin redeploy.
// ─────────────────────────────────────────────────────────────────────────
export const PROMO_END = new Date("2027-08-04T06:00:00Z");

export function isPromoActive(now: Date = new Date()): boolean {
  return now < PROMO_END;
}

export const PROMO_DISCOUNT = 0.5;

// El 50% exacto de $120/$1,199 (freelancer) y $199/$1,999 (client) da
// $60/$599.50 y $99.50/$999.50 — redondeado hacia abajo a favor del
// usuario. Anotado para Ricardo: revisar si prefiere .50 exactos.
export const PROMO_PRICES: Record<ProPlanId, { monthly: number; yearly: number }> = {
  freelancer: { monthly: 60, yearly: 599 },
  client: { monthly: 99, yearly: 999 },
};

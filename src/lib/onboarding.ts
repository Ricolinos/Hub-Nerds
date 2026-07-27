/* ══════════════════════════════════════════════════════════════════════════
 * Bienvenida guiada del Freelancer (/bienvenida).
 *
 * Se ve UNA SOLA VEZ, justo después del registro: es el momento en que el
 * usuario está más dispuesto a hablar de sí mismo. Todo lo que captura aquí
 * es su perfil real — no hay formulario aparte ni datos que se dupliquen.
 *
 * El "ya lo vio" vive en `publicMetadata.onboardedAt` de Clerk, NO en una
 * columna de Postgres: la base es compartida con producción y una migración
 * desde una rama sin mergear se aplicaría a los datos reales.
 * ══════════════════════════════════════════════════════════════════════════ */

export const ONBOARDING_STEPS = ["roles", "presentacion", "imagen", "listo"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Pasos en los que el usuario captura algo; "listo" es solo la celebración.
export const EDITABLE_STEPS = ONBOARDING_STEPS.filter((s) => s !== "listo");

/**
 * Rutas "enfocadas": se renderizan sin nav, sin footer y sin burbuja de chat.
 * La bienvenida compite con todo lo demás por la atención de alguien que
 * acaba de llegar; quitar los escapes del layout es justo lo que la vuelve
 * un recorrido y no una página más del sitio. La salida sigue existiendo,
 * pero explícita ("Lo hago luego"), no como un menú al que irse por accidente.
 */
export function isFocusRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/bienvenida" || pathname.startsWith("/bienvenida/");
}

export const MAX_HEADLINE_CHARS = 60;
export const MAX_BIO_CHARS = 280;
export const MAX_CARD_QUOTE_CHARS = 180;

type ClerkMetadata = Record<string, unknown> | undefined | null;

/** Un usuario que ya pasó (o saltó) la bienvenida no debe volver a verla. */
export function hasSeenOnboarding(publicMetadata: ClerkMetadata): boolean {
  const value = publicMetadata?.onboardedAt;
  return typeof value === "string" && value.length > 0;
}

/** El tour del dashboard se ofrece una sola vez, después de la bienvenida. */
export function hasSeenTour(publicMetadata: ClerkMetadata): boolean {
  const value = publicMetadata?.tourSeenAt;
  return typeof value === "string" && value.length > 0;
}

export interface TourStop {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** A dónde lleva el botón; `:username` se sustituye en tiempo de render. */
  href: string;
  cta: string;
}

/**
 * Guion del tour post-bienvenida. Responde las dos preguntas que tiene alguien
 * que acaba de llegar: qué puedo hacer aquí, y cómo llego.
 */
export const TOUR_STOPS: TourStop[] = [
  {
    id: "perfil",
    icon: "person",
    title: "Tu perfil es tu carta de presentación",
    body: "Todo lo que acabas de llenar vive aquí. Puedes seguir editándolo cuando quieras desde el menú de tu avatar.",
    href: "/:username",
    cta: "Ver mi perfil",
  },
  {
    id: "proyectos",
    icon: "rocket",
    title: "Sube tu trabajo",
    body: "Cada proyecto se arma con un editor de bloques: portada, texto, imágenes y video. Es lo que más peso tiene cuando alguien te está considerando.",
    href: "/:username",
    cta: "Crear un proyecto",
  },
  {
    id: "explorar",
    icon: "gallery",
    title: "Aparece en Explorar",
    body: "Tu tarjeta se muestra junto a la del resto del talento. Ahí es donde los clientes descubren con quién quieren trabajar.",
    href: "/explorar/designerds",
    cta: "Ver Explorar",
  },
  {
    id: "convocatorias",
    icon: "sparkles",
    title: "Compite por proyectos reales",
    body: "En Convocatorias las marcas publican briefs. Te postulas con el portafolio que ya tienes: aquí nadie trabaja gratis para concursar.",
    href: "/convocatorias",
    cta: "Ver convocatorias",
  },
  {
    id: "mensajes",
    icon: "chat",
    title: "Todo se coordina en un lugar",
    body: "Cuando un cliente te contacta, la conversación y las tareas del proyecto viven en tu centro de mensajes.",
    href: "/mensajes",
    cta: "Abrir mensajes",
  },
];

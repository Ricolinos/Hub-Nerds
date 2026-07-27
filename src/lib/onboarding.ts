/* ══════════════════════════════════════════════════════════════════════════
 * Bienvenida guiada del Freelancer (/bienvenida).
 *
 * Se muestra al registrarse y SIGUE APARECIENDO en cada inicio de sesión
 * mientras el perfil esté incompleto: "Lo hago luego" pospone, no silencia.
 * Solo deja de aparecer cuando el usuario la termina o cuando su perfil ya
 * tiene lo mínimo (ver isProfileComplete).
 *
 * `onboardedAt` vive en publicMetadata de Clerk, NO en una columna de
 * Postgres: la base es compartida con producción y una migración desde una
 * rama sin mergear se aplicaría a los datos reales.
 * ══════════════════════════════════════════════════════════════════════════ */

export const ONBOARDING_STEPS = ["roles", "presentacion", "imagen", "listo"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

// Pasos en los que el usuario captura algo; "listo" es solo la celebración.
export const EDITABLE_STEPS = ONBOARDING_STEPS.filter((s) => s !== "listo");

export const MAX_HEADLINE_CHARS = 60;
export const MAX_BIO_CHARS = 280;
export const MAX_CARD_QUOTE_CHARS = 180;

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

type ClerkMetadata = Record<string, unknown> | undefined | null;

/** Terminó la bienvenida de forma explícita (no basta con posponerla). */
export function hasFinishedOnboarding(publicMetadata: ClerkMetadata): boolean {
  const value = publicMetadata?.onboardedAt;
  return typeof value === "string" && value.length > 0;
}

/** El tour del dashboard se ofrece solo una vez de forma automática. */
export function hasSeenTour(publicMetadata: ClerkMetadata): boolean {
  const value = publicMetadata?.tourSeenAt;
  return typeof value === "string" && value.length > 0;
}

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Mínimo con el que un perfil ya "se sostiene" solo: cómo se presenta
 * (profesión) y quién es. La imagen destacada y los colores quedan fuera a
 * propósito — son deseables, pero condicionar la salida de la bienvenida a
 * subir una foto convertiría el recorrido en un peaje.
 */
export function isProfileComplete(user: {
  primaryRole?: string | null;
  bio?: string | null;
}): boolean {
  return filled(user.primaryRole) && filled(user.bio);
}

/**
 * ¿Hay que mandar a este usuario a la bienvenida? Solo freelancers que ni la
 * terminaron ni tienen ya el perfil armado (p. ej. quien lo llenó a mano).
 */
export function shouldSeeOnboarding(
  publicMetadata: ClerkMetadata,
  user: { primaryRole?: string | null; bio?: string | null } | null,
): boolean {
  if (hasFinishedOnboarding(publicMetadata)) return false;
  if (!user) return true;
  return !isProfileComplete(user);
}

/* ── Tour ────────────────────────────────────────────────────────────────
 * El paso vivo se guarda en localStorage y el tour se monta en el layout
 * raíz, no en el dashboard: así sobrevive a la navegación y el usuario puede
 * seguir el recorrido hasta el destino que cada parada le propone, en vez de
 * perder el tour en cuanto hace clic.                                      */
export const TOUR_STORAGE_KEY = "hubnerds:tour-step";

export interface TourStop {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** `:username` se sustituye en tiempo de render. */
  href: string;
  cta: string;
}

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
    href: "/explorar/freelancers",
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

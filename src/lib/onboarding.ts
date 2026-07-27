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
 * Mínimo para un client: quién es (empresa o marca). No se le pide más para
 * dejar de insistir — un client viene a encontrar talento, no a llenar una
 * ficha, y cada campo extra obligatorio es una razón para abandonar.
 */
export function isClientProfileComplete(user: {
  company?: string | null;
  brand?: string | null;
}): boolean {
  return filled(user.company) || filled(user.brand);
}

interface OnboardingUserShape {
  role?: string | null;
  primaryRole?: string | null;
  bio?: string | null;
  company?: string | null;
  brand?: string | null;
}

/**
 * ¿Hay que mandar a este usuario a la bienvenida? Quien ya la terminó, o ya
 * tiene su perfil armado a mano, no la vuelve a ver. El mínimo es distinto
 * según el rol: un freelancer necesita presentarse (profesión + descripción);
 * a un client le basta con decir de qué empresa o marca viene.
 */
export function shouldSeeOnboarding(
  publicMetadata: ClerkMetadata,
  user: OnboardingUserShape | null,
  role?: "client" | "freelancer",
): boolean {
  if (hasFinishedOnboarding(publicMetadata)) return false;
  if (!user) return true;
  const resolved = role ?? (user.role === "client" ? "client" : "freelancer");
  return resolved === "client" ? !isClientProfileComplete(user) : !isProfileComplete(user);
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
  /** `:username` se sustituye en tiempo de render. Sin href, la parada solo informa. */
  href?: string;
  cta?: string;
  /**
   * Selector CSS del elemento real que hay que resaltar. El overlay oscurece
   * todo menos ese rectángulo y bloquea el clic fuera de él, de modo que el
   * usuario aprende DÓNDE está la opción en vez de que el tour se la sirva.
   * Si el selector no existe en la página actual (layouts distintos), el
   * recorrido cae con elegancia a una tarjeta centrada sin recorte.
   */
  target?: string;
  /** Instrucción concreta sobre el elemento resaltado. */
  hint?: string;
  /**
   * De qué lado del elemento resaltado se coloca la ventana del tour.
   * Importa cuando el elemento ABRE algo (un menú desplegable, un panel):
   * dejar la tarjeta justo debajo del avatar tapaba el menú que el propio
   * tour pide abrir. "auto" elige debajo/arriba según el espacio libre.
   */
  placement?: "auto" | "left" | "right" | "below" | "above";
}

export const TOUR_STOPS: TourStop[] = [
  {
    id: "perfil",
    icon: "person",
    title: "Tu perfil es tu carta de presentación",
    body: "Todo lo que acabas de llenar vive aquí. Puedes volver a editarlo cuando quieras.",
    target: '[data-tour="user-menu"]',
    hint: "Abre el menú de tu avatar y entra a “Perfil”.",
    placement: "left",
    href: "/:username",
    cta: "Ir a mi perfil",
  },
  {
    id: "proyectos",
    icon: "rocket",
    title: "Sube tu trabajo",
    body: "Cada proyecto se arma con un editor de bloques: portada, texto, imágenes y video. Es lo que más peso tiene cuando alguien te está considerando.",
    target: '[data-tour="add-project"]',
    hint: "Desde aquí publicas un proyecto nuevo.",
    href: "/:username",
    cta: "Crear un proyecto",
  },
  {
    id: "explorar",
    icon: "gallery",
    title: "Aparece en Explorar",
    body: "Tu tarjeta se muestra junto a la del resto del talento. Ahí es donde los clientes descubren con quién quieren trabajar.",
    target: '[data-tour="nav-explorar"]',
    hint: "Explorar vive en el menú principal.",
    href: "/explorar/freelancers",
    cta: "Ver Explorar",
  },
  {
    id: "convocatorias",
    icon: "sparkles",
    title: "Compite por proyectos reales",
    body: "En Convocatorias las marcas publican briefs. Te postulas con el portafolio que ya tienes: aquí nadie trabaja gratis para concursar.",
    target: '[data-tour="nav-convocatorias"]',
    hint: "Las convocatorias abiertas están en este menú.",
    href: "/convocatorias",
    cta: "Ver convocatorias",
  },
  {
    id: "mensajes",
    icon: "chat",
    title: "Todo se coordina en un lugar",
    body: "Cuando un cliente te contacta, la conversación y las tareas del proyecto viven en tu centro de mensajes.",
    target: '[data-tour="chat-bubble"]',
    hint: "Esta burbuja te avisa de mensajes nuevos en cualquier parte del sitio.",
    placement: "left",
    href: "/mensajes",
    cta: "Abrir mensajes",
  },
  {
    id: "listo",
    icon: "check",
    title: "Ya estás listo",
    body: "Eso es todo lo que necesitabas saber. Sube tu primer proyecto, asómate a las convocatorias abiertas y deja que el trabajo hable por ti. Nos da gusto tenerte aquí.",
  },
];

/* ── Tour del client ─────────────────────────────────────────────────────
 * Mismo formato con foco que el del freelancer, pero contando otra historia:
 * el freelancer viene a que lo encuentren, el client viene a encontrar. */
export const CLIENT_TOUR_STOPS: TourStop[] = [
  {
    id: "explorar",
    icon: "userGroup",
    title: "Aquí encuentras al talento",
    body: "Animadores, diseñadores, ilustradores y estudios de toda Latinoamérica, cada uno con su portafolio a la vista. Puedes escribirle a quien te interese sin intermediarios.",
    target: '[data-tour="nav-explorar"]',
    hint: "Explorar vive en el menú principal.",
    href: "/explorar/freelancers",
    cta: "Ver el talento",
  },
  {
    id: "convocatorias",
    icon: "sparkles",
    title: "¿No sabes a quién elegir? Publica un brief",
    body: "Describe tu proyecto y deja que el talento se postule con el trabajo que ya tiene hecho. Tú eliges a tres finalistas y solo esa etapa se paga: aquí nadie trabaja gratis para concursar.",
    target: '[data-tour="nav-convocatorias"]',
    hint: "Desde este menú publicas y sigues tus convocatorias.",
    href: "/convocatorias/nueva",
    cta: "Publicar un brief",
  },
  {
    id: "cotizador",
    icon: "creditCard",
    title: "Si necesitas una idea del presupuesto",
    body: "El cotizador te da un estimado por tipo de proyecto antes de hablar con nadie, para que llegues a la conversación con una referencia.",
    target: '[data-tour="nav-servicios"]',
    hint: "El cotizador está dentro de Servicios.",
    href: "/servicios/cotizador",
    cta: "Abrir el cotizador",
  },
  {
    id: "mensajes",
    icon: "chat",
    title: "El proyecto se coordina en un solo lugar",
    body: "Cuando empiezas a trabajar con alguien, la conversación, las tareas y los archivos del proyecto viven juntos. Nada de perseguir hilos por correo.",
    target: '[data-tour="chat-bubble"]',
    placement: "left",
    hint: "Esta burbuja te avisa de mensajes nuevos en cualquier parte del sitio.",
    href: "/mensajes",
    cta: "Abrir mensajes",
  },
  {
    id: "listo",
    icon: "check",
    title: "Ya estás listo",
    body: "Eso es todo. Date una vuelta por Explorar, y cuando tengas claro qué necesitas, publica tu brief. Nos da gusto tenerte aquí.",
  },
];

/* ══════════════════════════════════════════════════════════════════════════
 * Fuerza de perfil del Freelancer.
 *
 * Deriva qué tan completo está un perfil a partir de los campos que ya
 * existen en `User` y del número de piezas públicas de su portafolio. No hay
 * columna en la base de datos: recalcular es barato y evita que el valor
 * quede desincronizado cuando el usuario edita su perfil desde /[username].
 *
 * Decisión de producto (ver análisis del onboarding de Fiverr): esto NUNCA
 * bloquea. El freelancer es visible en Explorar desde el minuto uno con lo
 * que tenga; la barra mide qué tan bien se presenta, no si existe. Por eso
 * no hay candados, ni prerequisitos, ni copy del tipo "aún no eres visible".
 * ══════════════════════════════════════════════════════════════════════════ */

// Modal de /[username] que abre cada sugerencia (ver ProfileView, openDialog).
export type ProfileStrengthTarget = "info" | "featured" | "avatar" | "proyecto";

const EDIT_TARGETS: ProfileStrengthTarget[] = ["info", "featured", "avatar", "proyecto"];

/**
 * Interpreta el parámetro `?editar=` de /[username]. `"1"` es el valor legado
 * del menú del avatar del Header ("Editar Perfil"), que siempre abrió el
 * modal de información; se mantiene para no romper ese enlace.
 */
export function parseEditTarget(value: string | undefined): ProfileStrengthTarget | null {
  if (value === "1") return "info";
  return EDIT_TARGETS.includes(value as ProfileStrengthTarget)
    ? (value as ProfileStrengthTarget)
    : null;
}

export interface ProfileStrengthItem {
  id: string;
  /** Nombre de icono registrado en src/resources/icons.ts. */
  icon: string;
  /** Qué le falta, en imperativo y en una línea. */
  label: string;
  /** Por qué le conviene. El copy va orientado al beneficio, no a la tarea. */
  benefit: string;
  /** Texto del botón. */
  cta: string;
  target: ProfileStrengthTarget;
  done: boolean;
}

export interface ProfileStrengthInput {
  imageUrl: string | null;
  headline: string | null;
  bio: string | null;
  primaryRole: string | null;
  featuredImageUrl: string | null;
  cardQuote: string | null;
  publicPieceCount: number;
}

export interface ProfileStrength {
  /** Los 8 ítems, en orden de impacto, resueltos y sin resolver. */
  items: ProfileStrengthItem[];
  pendingItems: ProfileStrengthItem[];
  /** La sugerencia de mayor impacto pendiente, o null si ya está completo. */
  nextItem: ProfileStrengthItem | null;
  completed: number;
  total: number;
  /** 0–100, para LinearGauge. */
  percent: number;
  isComplete: boolean;
}

// Trata "" y "   " como vacío: las server actions guardan cadenas vacías
// cuando el usuario borra un campo en vez de null.
function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * El orden del array ES el orden de impacto: `nextItem` toma el primer
 * pendiente. Lo que más mueve la aguja va primero (clasificación en Explorar
 * y el aspecto de la tarjeta Designerd), y los remates de texto al final.
 */
export function computeProfileStrength(input: ProfileStrengthInput): ProfileStrength {
  const items: ProfileStrengthItem[] = [
    {
      id: "primaryRole",
      icon: "person",
      label: "Elige tu rol principal",
      benefit: "Es lo que te coloca en la categoría correcta cuando alguien explora talento.",
      cta: "Elegir rol",
      target: "info",
      done: filled(input.primaryRole),
    },
    {
      id: "featuredImage",
      icon: "gallery",
      label: "Sube tu imagen destacada",
      benefit: "Es la cara de tu tarjeta en Explorar; sin ella se ve vacía junto a las demás.",
      cta: "Subir imagen",
      target: "featured",
      done: filled(input.featuredImageUrl),
    },
    {
      id: "firstPiece",
      icon: "rocket",
      label: "Publica tu primer proyecto",
      benefit: "Un perfil sin trabajo visible da poco que juzgar a quien te está considerando.",
      cta: "Crear proyecto",
      target: "proyecto",
      done: input.publicPieceCount >= 1,
    },
    {
      id: "headline",
      icon: "briefcase",
      label: "Escribe tu puesto",
      benefit: "Aparece bajo tu nombre y resume en tres palabras a qué te dedicas.",
      cta: "Escribir puesto",
      target: "info",
      done: filled(input.headline),
    },
    {
      id: "avatar",
      icon: "camera",
      label: "Pon una foto de perfil",
      benefit: "Las personas conectan antes con una cara que con una inicial.",
      cta: "Subir foto",
      target: "avatar",
      done: filled(input.imageUrl),
    },
    {
      id: "bio",
      icon: "edit",
      label: "Cuenta quién eres",
      benefit: "Tu descripción es lo que se lee al voltear tu tarjeta.",
      cta: "Escribir descripción",
      target: "info",
      done: filled(input.bio),
    },
    {
      id: "morePieces",
      icon: "photoStack",
      label: "Llega a tres proyectos",
      benefit: "Tres piezas ya dejan ver un estilo; una sola parece un accidente.",
      cta: "Agregar proyecto",
      target: "proyecto",
      done: input.publicPieceCount >= 3,
    },
    {
      id: "cardQuote",
      icon: "sparkles",
      label: "Agrega tu cita",
      benefit: "El remate personal de tu tarjeta: una frase con la que quieras que te recuerden.",
      cta: "Escribir cita",
      target: "info",
      done: filled(input.cardQuote),
    },
  ];

  const pendingItems = items.filter((item) => !item.done);
  const completed = items.length - pendingItems.length;

  return {
    items,
    pendingItems,
    nextItem: pendingItems[0] ?? null,
    completed,
    total: items.length,
    percent: Math.round((completed / items.length) * 100),
    isComplete: pendingItems.length === 0,
  };
}

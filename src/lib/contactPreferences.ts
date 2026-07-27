/* Canales por los que un client acepta que lo contacten.
 *
 * Se guardan en la MISMA columna `User.contactPreference` (String) como una
 * lista separada por comas, p. ej. "plataforma,email". No se migra a String[]
 * a propósito: la base es compartida con producción y una migración desde una
 * rama sin mergear tocaría datos reales (ver el historial de drift del
 * proyecto). Los valores viejos de un solo canal ("email", "whatsapp") siguen
 * siendo válidos: son simplemente una lista de un elemento.
 *
 * Módulo compartido server/client: NO agregar "use server".
 */

export const CONTACT_CHANNELS = [
  {
    value: "plataforma",
    label: "Mensajes de Hub-Nerds",
    description: "Dentro de la plataforma, junto a las tareas del proyecto",
    icon: "chat",
  },
  {
    value: "email",
    label: "Correo",
    description: "A tu correo de la cuenta",
    icon: "email",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    description: "Al número que registraste",
    icon: "whatsapp",
  },
] as const;

export type ContactChannel = (typeof CONTACT_CHANNELS)[number]["value"];

const VALID = CONTACT_CHANNELS.map((c) => c.value) as readonly string[];

export function isContactChannel(value: string): boolean {
  return VALID.includes(value);
}

/** "plataforma,email" → ["plataforma", "email"]. Tolera nulos y basura. */
export function parseContactPreference(value: string | null | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => part.trim())
        .filter(isContactChannel),
    ),
  );
}

/** Serializa respetando el orden del catálogo, para que se lea siempre igual. */
export function serializeContactPreference(channels: string[]): string | null {
  const ordered = CONTACT_CHANNELS.map((c) => c.value).filter((value) =>
    channels.includes(value),
  );
  return ordered.length > 0 ? ordered.join(",") : null;
}

export function contactChannelLabel(value: string): string {
  return CONTACT_CHANNELS.find((c) => c.value === value)?.label ?? value;
}

/* ── Horario de contacto ──────────────────────────────────────────────────
 * Se compone en un texto corto ("L-V 9:00-18:00") que es lo que ya guarda
 * `User.contactHours`, para no cambiar el formato de los perfiles existentes.
 *
 * OJO: los componentes de fecha de Once UI (DateInput/DatePicker) son
 * calendarios para elegir una fecha concreta —con `timePicker` opcional—, no
 * sirven para una disponibilidad semanal recurrente. Por eso esto se arma con
 * opciones predefinidas en vez de un date picker.                          */

export const CONTACT_DAY_PRESETS = [
  { value: "L-V", label: "Entre semana" },
  { value: "L-S", label: "Lunes a sábado" },
  { value: "Todos los días", label: "Todos los días" },
] as const;

export const CONTACT_HOUR_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 6; // 6:00 … 22:00
  return `${hour}:00`;
});

export const DEFAULT_HOURS_FROM = "9:00";
export const DEFAULT_HOURS_TO = "18:00";

export function composeContactHours(days: string, from: string, to: string): string {
  return `${days} ${from}-${to}`;
}

/** Deshace `composeContactHours`; si el texto es libre (perfiles viejos) cae a los defaults. */
export function parseContactHours(value: string | null | undefined): {
  days: string;
  from: string;
  to: string;
} {
  const fallback = {
    days: CONTACT_DAY_PRESETS[0].value as string,
    from: DEFAULT_HOURS_FROM,
    to: DEFAULT_HOURS_TO,
  };
  if (!value) return fallback;

  const match = value.match(/^(.+?)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) return fallback;

  const [, days, from, to] = match;
  return {
    days: CONTACT_DAY_PRESETS.some((d) => d.value === days) ? days : fallback.days,
    from: CONTACT_HOUR_OPTIONS.includes(from) ? from : fallback.from,
    to: CONTACT_HOUR_OPTIONS.includes(to) ? to : fallback.to,
  };
}

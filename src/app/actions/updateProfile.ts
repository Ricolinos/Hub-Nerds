"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { validateExternalUrl } from "@/lib/externalLink";
import { MAX_SECONDARY_ROLES, isFreelancerSpecialty } from "@/lib/freelancerRoles";
import { isFreelancerRole } from "@/lib/roles";
import {
  parseContactPreference,
  serializeContactPreference,
} from "@/lib/contactPreferences";

export interface ProfileInfoInput {
  whatsapp: string;
  secondaryEmail: string;
  address: string;
  company: string;
  brand: string;
  motto: string;
  // Opcionales: la UI existente (EditInfoDialog) aún no los expone; se
  // agregan de forma retrocompatible para el nuevo formulario "Editar perfil".
  contactPreference?: string;
  contactHours?: string;
  website?: string;
  industry?: string;
}

const MAX_MOTTO_CHARS = 40;
const MAX_CONTACT_HOURS_CHARS = 60;
const MAX_INDUSTRY_CHARS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

function clean(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

// Actualiza la información editable del perfil del client.
export async function updateProfileInfo(input: ProfileInfoInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const motto = clean(input.motto);
  if (motto && motto.length > MAX_MOTTO_CHARS) {
    throw new Error(`El lema no puede exceder los ${MAX_MOTTO_CHARS} caracteres.`);
  }

  const secondaryEmail = clean(input.secondaryEmail);
  if (secondaryEmail && !EMAIL_RE.test(secondaryEmail)) {
    throw new Error("El segundo correo electrónico no es válido.");
  }

  // Lista de canales separada por comas (ver src/lib/contactPreferences.ts).
  // Los valores viejos de un solo canal siguen validando: son una lista de un
  // elemento. Se re-serializa para dejarlos siempre en el mismo orden.
  const contactPreferenceRaw = clean(input.contactPreference);
  const contactPreferenceInput = contactPreferenceRaw
    ? serializeContactPreference(parseContactPreference(contactPreferenceRaw))
    : null;
  if (contactPreferenceRaw && !contactPreferenceInput) {
    throw new Error("La preferencia de contacto no es válida.");
  }

  const contactHours = clean(input.contactHours);
  if (contactHours && contactHours.length > MAX_CONTACT_HOURS_CHARS) {
    throw new Error(`El horario de contacto no puede exceder ${MAX_CONTACT_HOURS_CHARS} caracteres.`);
  }

  const industry = clean(input.industry);
  if (industry && industry.length > MAX_INDUSTRY_CHARS) {
    throw new Error(`El giro/industria no puede exceder ${MAX_INDUSTRY_CHARS} caracteres.`);
  }

  const websiteInput = clean(input.website);
  const website = websiteInput ? validateExternalUrl(websiteInput) : null;
  if (websiteInput && !website) {
    throw new Error("El sitio web no es una URL válida.");
  }

  let user;
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        whatsapp: clean(input.whatsapp),
        secondaryEmail,
        address: clean(input.address),
        company: clean(input.company),
        brand: clean(input.brand),
        motto,
        contactPreference: contactPreferenceInput,
        contactHours,
        website,
        industry,
      },
    });
  } catch (error) {
    console.error("updateProfileInfo:", error);
    throw new Error("No se pudieron guardar los cambios. Intenta de nuevo.");
  }

  if (user.username) revalidatePath(`/${user.username}`);
}

export interface UpdateClientIdentityInput {
  password: string;
  firstName: string;
  lastName: string;
  username: string;
}

export type UpdateClientIdentityResult = { ok: true; username: string } | { ok: false; error: string };

// Cambia nombre/apellido/username del client en Clerk, confirmando la
// identidad con la contraseña actual antes de aplicar el cambio.
export async function updateClientIdentity(
  input: UpdateClientIdentityInput,
): Promise<UpdateClientIdentityResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "No autenticado" };

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim().toLowerCase();

  if (!firstName) return { ok: false, error: "El nombre es obligatorio" };
  if (!username) return { ok: false, error: "El nombre de usuario es obligatorio" };
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "El nombre de usuario debe tener 3-30 caracteres: minúsculas, números, guiones o guion bajo.",
    };
  }

  const client = await clerkClient();

  try {
    const result = await client.users.verifyPassword({ userId, password: input.password });
    if (!result || (result as { verified?: boolean }).verified === false) {
      return { ok: false, error: "Contraseña incorrecta" };
    }
  } catch (error: unknown) {
    const clerkError = error as { errors?: Array<{ code?: string }> };
    const isMissingPassword = clerkError.errors?.some(
      (e) => e.code === "no_password_on_account" || e.code === "form_password_not_allowed",
    );
    if (isMissingPassword) {
      return {
        ok: false,
        error:
          "Tu cuenta usa inicio de sesión con Google/Facebook y no tiene contraseña; administra tu nombre desde el panel de seguridad.",
      };
    }
    return { ok: false, error: "Contraseña incorrecta" };
  }

  const previousUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });

  try {
    await client.users.updateUser(userId, { username, firstName, lastName });
  } catch (error: unknown) {
    const clerkError = error as { errors?: Array<{ code?: string; meta?: { paramName?: string } }> };
    const isDuplicateUsername = clerkError.errors?.some(
      (e) =>
        e.code === "form_identifier_exists" ||
        (e.code === "form_param_exists" && e.meta?.paramName === "username"),
    );
    if (isDuplicateUsername) {
      return { ok: false, error: "Ese nombre de usuario ya está en uso. Por favor elige otro." };
    }
    console.error("updateClientIdentity:", error);
    return { ok: false, error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  const name = `${firstName} ${lastName}`.trim();
  await prisma.user.update({ where: { id: userId }, data: { username, name } });

  if (previousUser?.username) revalidatePath(`/${previousUser.username}`);
  revalidatePath(`/${username}`);

  return { ok: true, username };
}

// Sin bucket de Storage disponible: la portada viaja como data URL JPEG ya
// comprimida en el cliente. El límite protege el peso de la fila en BD.
const MAX_COVER_DATA_URL_CHARS = 700_000; // ≈ 500KB de imagen
const MAX_CARD_QUOTE_CHARS = 180;
const MAX_HEADLINE_CHARS = 60;
const MAX_BIO_CHARS = 280;

function validateDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Formato de imagen no válido.");
  }
  if (dataUrl.length > MAX_COVER_DATA_URL_CHARS) {
    throw new Error("La imagen es demasiado pesada.");
  }
}

async function requireFreelancer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, username: true },
  });
  if (!user || !isFreelancerRole(user.role)) throw new Error("Solo disponible para Freelancers.");
  return user;
}

// Actualiza (o quita, con null) la imagen de portada del perfil de Freelancer.
export async function updateCoverImage(dataUrl: string | null): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  if (dataUrl !== null) {
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
      throw new Error("Formato de imagen no válido.");
    }
    if (dataUrl.length > MAX_COVER_DATA_URL_CHARS) {
      throw new Error("La imagen de portada es demasiado pesada.");
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { coverImageUrl: dataUrl } });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
}

// Visibilidad del Freelancer en Explorar/freelancers. El perfil directo por
// username sigue siendo accesible aunque sea privado.
export async function updateFreelancerVisibility(isPublic: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  await prisma.user.update({ where: { id: userId }, data: { isPublic } });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
  revalidatePath("/explorar/freelancers");
}

// Opt-in del Freelancer para exponer su WhatsApp en su perfil. Aun activado,
// solo lo ven usuarios logueados de la plataforma, nunca visitantes anónimos
// (el filtro por sesión vive en src/app/[username]/page.tsx).
export async function updateFreelancerContactSharing(shareWhatsapp: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  await prisma.user.update({ where: { id: userId }, data: { shareWhatsapp } });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
}

// Actualiza (o quita, con null) la imagen destacada de la tarjeta de Freelancer
// en Explorar. Mismo mecanismo de data URL que la portada del perfil.
export async function updateFeaturedImage(dataUrl: string | null): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  if (dataUrl !== null) validateDataUrl(dataUrl);

  await prisma.user.update({ where: { id: userId }, data: { featuredImageUrl: dataUrl } });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
  revalidatePath("/explorar/freelancers");
}

export interface DesignerCardInput {
  cardQuote: string;
  headline: string;
  bio: string;
}

// Actualiza el contenido editorial de la tarjeta de Freelancer (cita, puesto y
// bio breve del reverso) del propio Freelancer.
export async function updateDesignerCard(input: DesignerCardInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  const cardQuote = clean(input.cardQuote);
  if (cardQuote && cardQuote.length > MAX_CARD_QUOTE_CHARS) {
    throw new Error(`La cita no puede exceder ${MAX_CARD_QUOTE_CHARS} caracteres.`);
  }

  const headline = clean(input.headline);
  if (headline && headline.length > MAX_HEADLINE_CHARS) {
    throw new Error(`El puesto no puede exceder ${MAX_HEADLINE_CHARS} caracteres.`);
  }

  const bio = clean(input.bio);
  if (bio && bio.length > MAX_BIO_CHARS) {
    throw new Error(`La biografía no puede exceder ${MAX_BIO_CHARS} caracteres.`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { cardQuote, headline, bio },
  });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
  revalidatePath("/explorar/freelancers");
}

export interface FreelancerRolesInput {
  primaryRole: string;
  secondaryRoles: string[];
}

// Actualiza el rol principal y hasta 2 roles secundarios del Freelancer (matriz
// de roles, Fase 4). Validación estricta: valores dentro del catálogo de
// freelancerRoles.ts, máx. MAX_SECONDARY_ROLES secundarios, sin duplicar el
// principal ni entre sí.
export async function updateFreelancerRoles(input: FreelancerRolesInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  const primaryRole = clean(input.primaryRole);
  if (primaryRole && !isFreelancerSpecialty(primaryRole)) {
    throw new Error("El rol principal no es válido.");
  }

  const secondaryRolesInput = Array.isArray(input.secondaryRoles) ? input.secondaryRoles : [];
  const secondaryRoles = [...new Set(secondaryRolesInput.map((role) => role.trim()).filter(Boolean))];

  if (secondaryRoles.length > MAX_SECONDARY_ROLES) {
    throw new Error(`Puedes elegir hasta ${MAX_SECONDARY_ROLES} roles secundarios.`);
  }
  if (secondaryRoles.some((role) => !isFreelancerSpecialty(role))) {
    throw new Error("Uno de los roles secundarios no es válido.");
  }
  if (primaryRole && secondaryRoles.includes(primaryRole)) {
    throw new Error("Un rol secundario no puede repetir el rol principal.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { primaryRole, secondaryRoles },
  });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
  revalidatePath("/explorar/freelancers");
}

const PROFILE_BRAND_COLORS = [
  "blue",
  "indigo",
  "violet",
  "magenta",
  "pink",
  "red",
  "orange",
  "yellow",
  "moss",
  "green",
  "emerald",
  "aqua",
  "cyan",
] as const;
const PROFILE_NEUTRAL_COLORS = ["gray", "sand", "slate", "dusk", "mint", "rose"] as const;
const PROFILE_BORDER_STYLES = ["rounded", "playful", "conservative", "sharp"] as const;

export interface ProfileAppearanceInput {
  brand?: string | null;
  accent?: string | null;
  neutral?: string | null;
  border?: string | null;
}

function cleanAppearanceValue<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  label: string,
): T | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!(allowed as readonly string[]).includes(trimmed)) {
    throw new Error(`${label} no es válido.`);
  }
  return trimmed as T;
}

// Personalización de apariencia del perfil de Freelancer (esquema de color,
// acento, neutro y estilo de bordes). null = restablecer al default de la
// marca. Solo el propio Freelancer dueño del registro puede modificarla.
export async function updateProfileAppearance(input: ProfileAppearanceInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const freelancer = await requireFreelancer(userId);

  const profileBrand = cleanAppearanceValue(input.brand, PROFILE_BRAND_COLORS, "El color de marca");
  const profileAccent = cleanAppearanceValue(input.accent, PROFILE_BRAND_COLORS, "El color de acento");
  const profileNeutral = cleanAppearanceValue(input.neutral, PROFILE_NEUTRAL_COLORS, "El color neutro");
  const profileBorder = cleanAppearanceValue(input.border, PROFILE_BORDER_STYLES, "El estilo de bordes");

  await prisma.user.update({
    where: { id: userId },
    data: { profileBrand, profileAccent, profileNeutral, profileBorder },
  });
  if (freelancer.username) revalidatePath(`/${freelancer.username}`);
  revalidatePath("/explorar/freelancers");
}

// Tras user.setProfileImage() en el cliente, Clerk ya tiene la imagen nueva;
// esto copia la URL resultante a la BD para que el perfil no quede desfasado.
export async function syncProfileImage(): Promise<void> {
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("No autenticado");

  const user = await prisma.user.update({
    where: { id: clerkUser.id },
    data: { imageUrl: clerkUser.imageUrl },
  });

  if (user.username) revalidatePath(`/${user.username}`);
}

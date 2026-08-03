"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isFreelancerSpecialty, MAX_SECONDARY_ROLES } from "@/lib/freelancerRoles";
import { isFreelancerRole } from "@/lib/roles";
import {
  isContactChannel,
  serializeContactPreference,
} from "@/lib/contactPreferences";
import {
  MAX_BIO_CHARS,
  MAX_CARD_QUOTE_CHARS,
  ONBOARDING_POSTPONED_COOKIE,
} from "@/lib/onboarding";

/* Acciones de la bienvenida guiada (/bienvenida).
 *
 * Guardan directamente sobre el perfil real — la bienvenida NO es un
 * formulario aparte cuyos datos haya que trasvasar después. Cada paso
 * persiste al avanzar, así que abandonar a medias no pierde lo ya escrito.
 *
 * Se escriben aquí en vez de reusar updateProfile.ts porque aquel valida
 * "todo o nada" por diálogo, y aquí cada paso guarda su parcial. */

function clean(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

async function requireFreelancer() {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !isFreelancerRole(user.role)) {
    throw new Error("Solo los freelancers tienen bienvenida guiada");
  }
  return { userId, user };
}

export interface OnboardingRolesInput {
  primaryRole: string;
  secondaryRoles: string[];
}

/**
 * Paso 1: profesión principal y hasta 2 secundarias.
 *
 * La profesión elegida se copia también a `headline` — es el título con el
 * que la persona se presenta y lo que se lee bajo su nombre en la tarjeta.
 * Por eso el paso 2 ya no vuelve a pedir "puesto". Solo se copia si el
 * usuario no tiene ya un headline propio, para no pisar uno escrito a mano.
 */
export async function saveOnboardingRoles(input: OnboardingRolesInput): Promise<void> {
  const { userId, user } = await requireFreelancer();

  const primaryRole = input.primaryRole.trim();
  if (!isFreelancerSpecialty(primaryRole)) {
    throw new Error("Elige una profesión de la lista");
  }

  const secondaryRoles = Array.from(new Set(input.secondaryRoles.map((r) => r.trim())))
    .filter((r) => r !== "" && r !== primaryRole)
    .filter(isFreelancerSpecialty);

  if (secondaryRoles.length > MAX_SECONDARY_ROLES) {
    throw new Error(`Puedes elegir máximo ${MAX_SECONDARY_ROLES} especialidades más`);
  }

  const keepHeadline = clean(user.headline);
  await prisma.user.update({
    where: { id: userId },
    data: {
      primaryRole,
      secondaryRoles,
      headline: keepHeadline ?? primaryRole,
    },
  });
}

export interface OnboardingPresentationInput {
  bio: string;
  cardQuote: string;
}

/** Paso 2: los textos del reverso de la tarjeta. */
export async function saveOnboardingPresentation(
  input: OnboardingPresentationInput,
): Promise<void> {
  const { userId } = await requireFreelancer();

  const bio = clean(input.bio);
  const cardQuote = clean(input.cardQuote);

  if (bio && bio.length > MAX_BIO_CHARS) {
    throw new Error(`La descripción no puede pasar de ${MAX_BIO_CHARS} caracteres`);
  }
  if (cardQuote && cardQuote.length > MAX_CARD_QUOTE_CHARS) {
    throw new Error(`La cita no puede pasar de ${MAX_CARD_QUOTE_CHARS} caracteres`);
  }

  await prisma.user.update({ where: { id: userId }, data: { bio, cardQuote } });
}

// Mismo techo que FeaturedImageUploadDialog: el data URL viaja en el payload
// de la server action, así que un archivo grande reventaría el límite del body.
const MAX_FEATURED_DATA_URL_CHARS = 700_000;

/** Paso 3: imagen destacada de la tarjeta (data URL ya recortada en cliente). */
export async function saveOnboardingFeaturedImage(dataUrl: string | null): Promise<void> {
  const { userId } = await requireFreelancer();

  if (dataUrl && dataUrl.length > MAX_FEATURED_DATA_URL_CHARS) {
    throw new Error("La imagen es demasiado pesada. Intenta con una más ligera.");
  }
  if (dataUrl && !dataUrl.startsWith("data:image/")) {
    throw new Error("Formato de imagen no válido");
  }

  await prisma.user.update({ where: { id: userId }, data: { featuredImageUrl: dataUrl } });
}

// Mismas whitelists que updateProfileAppearance (AppearancePanel).
const BRANDS = [
  "blue", "indigo", "violet", "magenta", "pink", "red", "orange",
  "yellow", "moss", "green", "emerald", "aqua", "cyan",
];
const NEUTRALS = ["gray", "sand", "slate", "dusk", "mint", "rose"];

export interface OnboardingAppearanceInput {
  brand: string | null;
  accent: string | null;
  neutral: string | null;
}

/** Paso 3: paleta del perfil y de la tarjeta. null = hereda la marca. */
export async function saveOnboardingAppearance(
  input: OnboardingAppearanceInput,
): Promise<void> {
  const { userId } = await requireFreelancer();

  const pick = (value: string | null, allowed: string[]) =>
    value && allowed.includes(value) ? value : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      profileBrand: pick(input.brand, BRANDS),
      profileAccent: pick(input.accent, BRANDS),
      profileNeutral: pick(input.neutral, NEUTRALS),
    },
  });
}

/* ── Bienvenida del client ──────────────────────────────────────────────
 * El client no arma tarjeta ni portafolio: lo suyo es decir de dónde viene y
 * cómo prefiere que lo contacten. Dos pasos, a propósito más corto que el del
 * freelancer.                                                              */

async function requireClient() {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || isFreelancerRole(user.role)) {
    throw new Error("Esta bienvenida es para clients");
  }
  return { userId, user };
}

const MAX_COMPANY_CHARS = 80;
const MAX_INDUSTRY_CHARS = 60;
const MAX_CONTACT_HOURS_CHARS = 60;

export interface OnboardingClientBusinessInput {
  company: string;
  brand: string;
  industry: string;
}

/**
 * Paso: de dónde viene el client.
 *
 * Empresa y marca son OPCIONALES: no todos los clients representan a una
 * organización — mucha gente llega por su cuenta buscando quien le ayude, y
 * exigirle un nombre de empresa la obligaba a inventarse uno.
 */
export async function saveOnboardingClientBusiness(
  input: OnboardingClientBusinessInput,
): Promise<void> {
  const { userId } = await requireClient();

  const company = clean(input.company);
  const brand = clean(input.brand);
  const industry = clean(input.industry);

  if (company && company.length > MAX_COMPANY_CHARS) {
    throw new Error(`El nombre de la empresa no puede pasar de ${MAX_COMPANY_CHARS} caracteres`);
  }
  if (brand && brand.length > MAX_COMPANY_CHARS) {
    throw new Error(`El nombre de la marca no puede pasar de ${MAX_COMPANY_CHARS} caracteres`);
  }
  if (industry && industry.length > MAX_INDUSTRY_CHARS) {
    throw new Error(`El giro no puede pasar de ${MAX_INDUSTRY_CHARS} caracteres`);
  }

  await prisma.user.update({ where: { id: userId }, data: { company, brand, industry } });
}

export interface OnboardingClientContactInput {
  /** Uno o más canales; se guardan separados por comas en contactPreference. */
  contactChannels: string[];
  contactHours: string;
  website: string;
}

/** Paso: por dónde y cuándo prefiere que lo busquen. */
export async function saveOnboardingClientContact(
  input: OnboardingClientContactInput,
): Promise<void> {
  const { userId } = await requireClient();

  // Varios canales a la vez, con al menos uno obligatorio: el client elige
  // por dónde prefiere que lo busquen y qué alternativas acepta.
  const channels = input.contactChannels.filter(isContactChannel);
  if (channels.length === 0) {
    throw new Error("Elige al menos un canal por el que quieras que te contacten");
  }
  const contactPreference = serializeContactPreference(channels);
  const contactHours = clean(input.contactHours);
  const website = clean(input.website);

  if (contactHours && contactHours.length > MAX_CONTACT_HOURS_CHARS) {
    throw new Error(`El horario no puede pasar de ${MAX_CONTACT_HOURS_CHARS} caracteres`);
  }
  if (website && !/^https?:\/\//i.test(website)) {
    throw new Error("El sitio web debe empezar con http:// o https://");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { contactPreference, contactHours, website },
  });
}

/**
 * Cierra la bienvenida DE FORMA DEFINITIVA (el usuario llegó al final).
 *
 * Deliberadamente NO se llama al posponer: si alguien sale a medias, la
 * bienvenida debe volver a aparecer en su próximo inicio de sesión mientras
 * su perfil siga incompleto (ver shouldSeeOnboarding).
 */
export async function finishOnboarding(): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const user = await currentUser();
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    publicMetadata: {
      ...(user?.publicMetadata ?? {}),
      onboardedAt: new Date().toISOString(),
    },
  });

  // La posposición ("Lo hago luego") deja de tener sentido al terminar:
  // se limpia la cookie para no arrastrar estado muerto.
  (await cookies()).delete(ONBOARDING_POSTPONED_COOKIE);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/freelancer");
}

/** Marca el tour como visto (deja de ofrecerse solo; se puede relanzar). */
export async function finishTour(): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const user = await currentUser();
  const client = await clerkClient();
  await client.users.updateUser(userId, {
    publicMetadata: {
      ...(user?.publicMetadata ?? {}),
      tourSeenAt: new Date().toISOString(),
    },
  });
}

"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isFreelancerSpecialty, MAX_SECONDARY_ROLES } from "@/lib/freelancerRoles";
import { isFreelancerRole } from "@/lib/roles";
import { MAX_BIO_CHARS, MAX_CARD_QUOTE_CHARS, MAX_HEADLINE_CHARS } from "@/lib/onboarding";

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

/** Paso 1: especialidad principal y hasta 2 secundarias. */
export async function saveOnboardingRoles(input: OnboardingRolesInput): Promise<void> {
  const { userId } = await requireFreelancer();

  const primaryRole = input.primaryRole.trim();
  if (!isFreelancerSpecialty(primaryRole)) {
    throw new Error("Elige una especialidad principal de la lista");
  }

  const secondaryRoles = Array.from(new Set(input.secondaryRoles.map((r) => r.trim())))
    .filter((r) => r !== "" && r !== primaryRole)
    .filter(isFreelancerSpecialty);

  if (secondaryRoles.length > MAX_SECONDARY_ROLES) {
    throw new Error(`Puedes elegir máximo ${MAX_SECONDARY_ROLES} especialidades secundarias`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { primaryRole, secondaryRoles },
  });
}

export interface OnboardingPresentationInput {
  headline: string;
  bio: string;
  cardQuote: string;
}

/** Paso 2: los textos que se leen en la tarjeta y en el perfil. */
export async function saveOnboardingPresentation(
  input: OnboardingPresentationInput,
): Promise<void> {
  const { userId } = await requireFreelancer();

  const headline = clean(input.headline);
  const bio = clean(input.bio);
  const cardQuote = clean(input.cardQuote);

  if (headline && headline.length > MAX_HEADLINE_CHARS) {
    throw new Error(`El puesto no puede pasar de ${MAX_HEADLINE_CHARS} caracteres`);
  }
  if (bio && bio.length > MAX_BIO_CHARS) {
    throw new Error(`La descripción no puede pasar de ${MAX_BIO_CHARS} caracteres`);
  }
  if (cardQuote && cardQuote.length > MAX_CARD_QUOTE_CHARS) {
    throw new Error(`La cita no puede pasar de ${MAX_CARD_QUOTE_CHARS} caracteres`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { headline, bio, cardQuote },
  });
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

  await prisma.user.update({
    where: { id: userId },
    data: { featuredImageUrl: dataUrl },
  });
}

/**
 * Cierra la bienvenida. `onboardedAt` en publicMetadata de Clerk es lo que
 * impide que vuelva a aparecer; se marca igual si el usuario la salta, porque
 * volver a empujarla sería justo el acoso que este flujo quiere evitar.
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/freelancer");
}

/** Marca el tour del dashboard como visto (se ofrece una sola vez). */
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

  revalidatePath("/dashboard/freelancer");
}

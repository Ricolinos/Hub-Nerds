"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { LEGAL_VERSION } from "@/resources";

interface CompleteProfileInput {
  role: Role;
  username: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
  acceptedTerms: boolean;
}

// Completa el perfil del usuario: actualiza Clerk (username, nombre,
// publicMetadata con rol y WhatsApp) y sincroniza el registro en Prisma.
export async function completeProfile(input: CompleteProfileInput): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const username = input.username.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const whatsapp = input.whatsapp.trim();
  const role: Role = input.role === "freelancer" ? "freelancer" : "client";

  if (!username) throw new Error("El nombre de usuario es obligatorio");
  if (!firstName) throw new Error("El nombre es obligatorio");
  if (!whatsapp) throw new Error("El número de WhatsApp es obligatorio");
  if (!input.acceptedTerms) {
    throw new Error("Debes aceptar los Términos y Condiciones para continuar.");
  }

  const client = await clerkClient();
  // client.users.updateUser REEMPLAZA publicMetadata en vez de mergearla
  // (mismo patrón que src/app/dashboard/page.tsx:44): hay que partir de la
  // metadata actual del usuario para no perder claves ya guardadas.
  const existingUser = await client.users.getUser(userId);
  try {
    await client.users.updateUser(userId, {
      username,
      firstName,
      lastName,
      publicMetadata: {
        ...existingUser.publicMetadata,
        role,
        whatsapp,
        termsAcceptedAt: new Date().toISOString(),
        termsVersion: LEGAL_VERSION,
      },
    });
  } catch (error: unknown) {
    const clerkError = error as { errors?: Array<{ code?: string; meta?: { paramName?: string } }> };
    const isDuplicateUsername = clerkError.errors?.some(
      (e) =>
        e.code === "form_identifier_exists" ||
        (e.code === "form_param_exists" && e.meta?.paramName === "username"),
    );
    if (isDuplicateUsername) {
      throw new Error("Ese nombre de usuario ya está en uso. Por favor elige otro.");
    }
    throw error;
  }

  const name = `${firstName} ${lastName}`.trim();
  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  try {
    await prisma.user.upsert({
      where: { id: userId },
      update: { username, name, role, whatsapp },
      create: { id: userId, email, username, name, role, whatsapp },
    });
  } catch (error) {
    // P2002 aquí NO es el caso benigno de "otro render lo creó primero": el
    // `where` busca por `id` (el de Clerk, que es la PK), así que si cae en la
    // rama `create` es porque esta cuenta de Clerk no tenía fila. El choque
    // viene de OTRA fila que ya ocupa el mismo `email` (@unique) bajo un id de
    // Clerk distinto — típicamente una fila huérfana de una cuenta borrada en
    // Clerk antes de que existiera el webhook de sync (ver el comentario de
    // cabecera en src/app/api/webhooks/clerk/route.ts).
    //
    // Sin este catch, el P2002 sube tal cual y en producción el usuario solo
    // ve "An error occurred in the Server Components render", sin ninguna
    // pista de qué hacer.
    //
    // Se confirma consultando por email en vez de leer `error.meta.target`: con
    // el driver adapter de Prisma 7 ese `target` no viene poblado (el meta solo
    // trae `modelName` y `driverAdapterError`), así que depender de él sería
    // frágil.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const enUso = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (enUso) {
        throw new Error(
          "Ese correo ya está registrado en la plataforma con otra cuenta. " +
            "Inicia sesión con esa cuenta o usa un correo distinto.",
        );
      }
    }
    throw error;
  }
}

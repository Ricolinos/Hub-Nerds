"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

interface CompleteProfileInput {
  role: Role;
  username: string;
  firstName: string;
  lastName: string;
  whatsapp: string;
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

  const client = await clerkClient();
  try {
    await client.users.updateUser(userId, {
      username,
      firstName,
      lastName,
      publicMetadata: { role, whatsapp },
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

  await prisma.user.upsert({
    where: { id: userId },
    update: { username, name, role, whatsapp },
    create: { id: userId, email, username, name, role, whatsapp },
  });
}

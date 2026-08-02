import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/roles";

// Just-in-Time sync: siembra el usuario de Clerk en la base de datos
// la primera vez que renderiza una ruta crítica, sin webhooks.
export async function getOrCreateUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const clerkId = clerkUser.id;
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const existing = await prisma.user.findUnique({ where: { id: clerkId } });
  if (existing) return existing;

  const rawRole = (clerkUser.publicMetadata?.role ?? clerkUser.unsafeMetadata?.role) as
    | string
    | undefined;
  const role = normalizeRole(rawRole) ?? "client";
  const whatsapp =
    ((clerkUser.publicMetadata?.whatsapp ?? clerkUser.unsafeMetadata?.whatsapp) as
      | string
      | undefined) ?? null;

  try {
    return await prisma.user.create({
      data: {
        id: clerkId,
        email,
        name:
          `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
          "Usuario de HUB-NERDS",
        username: clerkUser.username,
        imageUrl: clerkUser.imageUrl,
        role,
        whatsapp,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Caso benigno: otro render concurrente creó la MISMA fila (mismo
      // clerkId) entre el findUnique de arriba y este create; recupérala.
      const propia = await prisma.user.findUnique({ where: { id: clerkId } });
      if (propia) return propia;

      // Si no aparece, el choque no fue por `id` sino por `email` (@unique):
      // otra fila, con un id de Clerk distinto, ya ocupa este correo —
      // típicamente una huérfana de una cuenta borrada en Clerk antes de que
      // existiera el webhook de sync (ver la cabecera de
      // src/app/api/webhooks/clerk/route.ts).
      //
      // Antes se devolvía ese `null` como si nada: cada página que llama a
      // getOrCreateUser() (dashboard, /[username], convocatorias…) reventaba
      // más adelante al usar el usuario, con un error sin relación aparente
      // con la causa real. Mejor fallar aquí, donde sí se puede explicar.
      throw new Error(
        `No se pudo crear el usuario ${clerkId}: el correo ${email} ya pertenece ` +
          `a otra cuenta en la base de datos. Hay que liberar o reasignar esa fila.`,
      );
    }
    throw error;
  }
}

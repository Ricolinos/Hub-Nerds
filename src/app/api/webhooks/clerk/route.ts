import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeRole } from "@/lib/roles";

/* ══ Sync Clerk → Prisma vía webhook ═══════════════════════════════════
   Antes solo existía sync JIT (src/lib/syncUser.ts): crea la fila la
   primera vez que el usuario visita una ruta crítica, pero nunca se
   entera si la cuenta se edita o se borra directamente en Clerk. Esto
   dejó filas huérfanas (User con id de una cuenta de Clerk ya borrada)
   bloqueando el unique constraint de email en altas nuevas.

   Configurar en el Clerk Dashboard → Webhooks: endpoint apuntando a
   /api/webhooks/clerk, eventos user.created / user.updated / user.deleted,
   y copiar el "Signing Secret" a CLERK_WEBHOOK_SIGNING_SECRET. En local
   requiere un túnel (ngrok o similar) para que Clerk pueda alcanzar
   localhost; en producción usa el dominio público directamente. ═══════ */

export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("clerk webhook: firma inválida", error);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data;
        const email =
          data.email_addresses.find((e) => e.id === data.primary_email_address_id)
            ?.email_address ?? data.email_addresses[0]?.email_address;
        if (!email) break;

        const rawRole = (data.public_metadata?.role ?? data.unsafe_metadata?.role) as
          | string
          | undefined;
        const role = normalizeRole(rawRole);
        const whatsapp = data.public_metadata?.whatsapp as string | undefined;
        const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null;

        if (role) {
          await prisma.user.upsert({
            where: { id: data.id },
            create: {
              id: data.id,
              email,
              username: data.username,
              name,
              imageUrl: data.image_url,
              role,
              whatsapp: whatsapp ?? null,
            },
            update: {
              email,
              username: data.username,
              name,
              imageUrl: data.image_url,
              role,
              ...(whatsapp !== undefined ? { whatsapp } : {}),
            },
          });
        } else {
          // Sin rol en Clerk (ni publicMetadata ni unsafeMetadata): NO se
          // inventa "client". Si la fila ya existe (p. ej. login por Google
          // antes de completar perfil, luego edita nombre/avatar en Clerk)
          // se actualiza igual; si no existe, updateMany no crea nada — la
          // creará getOrCreateUser()/completeProfile() cuando ya haya un rol
          // real elegido por la persona (mismo criterio que syncUser.ts).
          await prisma.user.updateMany({
            where: { id: data.id },
            data: {
              email,
              username: data.username,
              name,
              imageUrl: data.image_url,
              ...(whatsapp !== undefined ? { whatsapp } : {}),
            },
          });
        }
        break;
      }
      case "user.deleted": {
        // onDelete: Cascade en el schema limpia Connection/CollabProject/
        // Message/etc. asociados automáticamente.
        if (event.data.id) {
          await prisma.user.delete({ where: { id: event.data.id } });
        }
        break;
      }
    }
  } catch (error) {
    // P2025: la fila ya no existía (delete duplicado/race) — no es un error real.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ ok: true });
    }
    console.error(`clerk webhook: fallo procesando "${event.type}"`, error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

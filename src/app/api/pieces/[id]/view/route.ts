import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Registra una vista de PortfolioPiece. Route handler (no server action):
// necesita leer/escribir la cookie de dedupe y responder rápido sin
// re-render, algo que una server action invocada desde un Client Component
// también podría hacer, pero un POST directo evita el roundtrip de
// serialización de Server Actions para una llamada de "fire and forget"
// desde useEffect (ver RegisterView.tsx).

// Anti-inflado: NO hay tabla de eventos (la BD es compartida prod/dev, un
// registro por vista crecería sin límite para cero beneficio analítico
// declarado) — solo una cookie httpOnly de dedupe. Protege contra recargas
// inmediatas; NO contra bots ni una pestaña de incógnito nueva (ver
// PLAN-AUDITORIA.md, Bloque B, "Qué NO está incluido").
const DEDUPE_COOKIE_PREFIX = "pv_";
const DEDUPE_MAX_AGE_SECONDS = 60 * 60; // 1 hora — decidido con el usuario.

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieName = `${DEDUPE_COOKIE_PREFIX}${id}`;

  if (request.cookies.get(cookieName)) {
    return NextResponse.json({ counted: false, reason: "deduped" });
  }

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id },
    select: { userId: true, isPublic: true },
  });
  if (!piece || !piece.isPublic) {
    // No se fija cookie: un id inválido no debe "gastar" la ventana de
    // dedupe de un id real que el visitante pueda pedir después.
    return NextResponse.json({ counted: false, reason: "not-found" }, { status: 404 });
  }

  // El dueño no cuenta sus propias vistas (decidido con el usuario) — mismo
  // criterio que el like en likes.ts. Igual se fija la cookie: sin esto, el
  // propio dueño revisando su pieza dispararía esta consulta en cada
  // recarga sin necesidad.
  const { userId } = await auth();
  const isOwner = userId !== null && userId === piece.userId;

  if (!isOwner) {
    await prisma.portfolioPiece.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  const response = NextResponse.json({ counted: !isOwner });
  response.cookies.set(cookieName, "1", {
    maxAge: DEDUPE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

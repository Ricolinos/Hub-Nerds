"use server";

import { auth } from "@clerk/nextjs/server";
import type { MDXRemoteSerializeResult } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import {
  selfCloseVoidHtmlTags,
  stripHtmlComments,
  stripInlineStyleAttrs,
} from "@/components/mdx-shared";
import type { ProfileAppearanceValue } from "@/components/profile/AppearancePanel";
import { prisma } from "@/lib/prisma";

// FEATURE (botón "Previsualizar" del editor, ver PreviewOverlay.tsx): compila
// el Markdown/MDX del borrador EN VIVO con el MISMO pipeline que usa el visor
// público (CustomMDX en mdx.tsx) — mismos sanitizadores (stripHtmlComments/
// stripInlineStyleAttrs/selfCloseVoidHtmlTags, ver mdx-shared.tsx), para que
// lo que el autor ve en el overlay sea fiel a lo que verá publicado.
//
// DIFERENCIA DELIBERADA con CustomMDX: ese usa `compileMDX` de
// `next-mdx-remote/rsc` (Server Component, compila Y renderiza en un solo
// paso, imposible de invocar desde una server action que solo puede devolver
// datos serializables). Esta acción usa `serialize()` de
// `next-mdx-remote/serialize` — la MISMA función que `compileMDX` llama por
// dentro (ver next-mdx-remote/dist/rsc.js: `compileMDX` es un wrapper de
// `serialize(source, options, /* rsc */ true)`), pero invocada con su
// tercer parámetro `rsc` en su default `false`: esa es justo la variante
// pensada para hidratarse en el CLIENTE con `<MDXRemote>` (next-mdx-remote,
// sin /rsc), que es como renderiza `PreviewOverlay`. El resultado
// (`compiledSource`/`scope`/`frontmatter`) es JSON plano, apto para viajar de
// vuelta al cliente como retorno de esta server action.
//
// SEGURIDAD: requiere sesión (igual que `searchPublicFreelancers` en
// portfolioPieces.ts) — la previsualización no es contenido público, es el
// borrador de un usuario autenticado.
export type PreviewAppearance = ProfileAppearanceValue;

export type SerializePreviewMdxResult =
  | (MDXRemoteSerializeResult & { appearance: PreviewAppearance })
  | { error: string };

export async function serializePreviewMdx(markdown: string): Promise<SerializePreviewMdxResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  // Mismo orden que CustomMDX (mdx.tsx): comentarios HTML → estilos inline →
  // autocierre de tags vacíos, ver mdx-shared.tsx para el detalle de cada
  // sanitizador.
  const normalizedSource = selfCloseVoidHtmlTags(stripInlineStyleAttrs(stripHtmlComments(markdown)));

  // Paleta guardada del DUEÑO (el usuario actual, autor del borrador) — ya
  // hace falta un round-trip a BD para validar la sesión, así que sumar estas
  // 3 columnas al mismo SELECT es gratis (ver AppearanceScope.tsx, mismo
  // shape que ya usa el visor público en [username]/proyecto/[slug]/page.tsx).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileBrand: true, profileAccent: true, profileNeutral: true },
  });
  const appearance: PreviewAppearance = {
    brand: user?.profileBrand ?? null,
    accent: user?.profileAccent ?? null,
    neutral: user?.profileNeutral ?? null,
  };

  try {
    const result = await serialize(normalizedSource);
    return { ...result, appearance };
  } catch (error) {
    console.error("[serializePreviewMdx] error al compilar MDX/markdown", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo interpretar el Markdown/MDX. Revisa que las etiquetas de componentes estén bien cerradas.",
    };
  }
}

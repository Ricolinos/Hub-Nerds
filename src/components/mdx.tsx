import { compileMDX, MDXRemoteProps } from "next-mdx-remote/rsc";

import type { PieceAttachment } from "@/app/actions/portfolioPieces";
import { Feedback } from "@once-ui-system/core";
// REFACTOR (tarea "rendimiento del editor + previsualizar"): los
// sanitizadores y el mapa de `components` vivían antes en este mismo
// archivo — se movieron a mdx-shared.tsx (client-safe, SIN el import de
// next-mdx-remote/rsc de arriba) para poder reutilizarlos desde
// `serializePreviewMdx` (actions/mdxPreview.ts, server action) y desde
// `PreviewOverlay` (cliente, <MDXRemote> de next-mdx-remote a secas) sin
// arrastrar este import Server Component-only. `CustomMDX` (abajo) queda
// IDÉNTICA: mismo normalizado, mismos components, mismo try/catch.
import {
  buildComponents,
  selfCloseVoidHtmlTags,
  stripHtmlComments,
  stripInlineStyleAttrs,
} from "@/components/mdx-shared";

type CustomMDXProps = MDXRemoteProps & {
  components?: ReturnType<typeof buildComponents>;
  // FEATURE (Modo Pro): adjuntos con nombre del proyecto (ver
  // PortfolioPiece.attachments) — `img`/`Media` los resuelven por nombre
  // (ver resolveAttachmentSrc/buildComponents en mdx-shared.tsx).
  attachments?: PieceAttachment[];
};

// FEATURE (Modo Pro, markdown/MDX nativo): a diferencia del constructor
// asistido —que solo produce Markdown/JSX que el propio editor generó y por
// lo tanto siempre es válido—, el modo Pro deja al usuario escribir MDX a
// mano. `<MDXRemote>` (RSC) compila y lanza la excepción DENTRO del árbol de
// Server Components de forma asíncrona: sin capturarla, un MDX inválido
// tumba la página completa (Next.js cae al error boundary más cercano →
// 500), incluso para piezas que nunca pasaron por el modo Pro. Por eso acá
// se compila con `compileMDX` (misma función que usa `MDXRemote` por dentro,
// ver next-mdx-remote/dist/rsc.js) en un try/catch propio: si falla, la
// página sigue respondiendo 200 con un aviso (`Feedback`, ya registrado en
// el mapa de `components` de mdx-shared.tsx) en vez de tronar.
export async function CustomMDX({ source, attachments = [], ...props }: CustomMDXProps) {
  const normalizedSource =
    typeof source === "string"
      ? selfCloseVoidHtmlTags(stripInlineStyleAttrs(stripHtmlComments(source)))
      : source;
  const mergedComponents = { ...buildComponents(attachments), ...(props.components || {}) };

  try {
    const { content } = await compileMDX({
      source: normalizedSource,
      options: props.options,
      components: mergedComponents,
    });
    return content;
  } catch (error) {
    console.error("[CustomMDX] error al compilar MDX/markdown", error);
    return (
      <Feedback
        variant="danger"
        title="El contenido tiene un error de sintaxis"
        description="Este proyecto se escribió en modo Pro y el Markdown/MDX no se pudo interpretar. Revisa desde el editor que las etiquetas de componentes (Media, Carousel, etc.) estén bien cerradas."
      />
    );
  }
}

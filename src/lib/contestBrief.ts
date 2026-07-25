/* ══ Brief-hub: bloques de brief/cláusulas (server-safe) ══════════════════
   DESVIACIÓN DOCUMENTADA (ver informe de la tarea): el plan original
   reusaba blocksToMarkdown/ContentBlockCard/createBlock de
   src/components/profile/ContentBlocks.tsx (el editor del freelancer) tal
   cual. Confirmado en runtime (`npm run dev`, /convocatorias/[slug]) que
   ESO ROMPE el boundary de React Server Components: ese archivo lleva
   "use client" en la cabecera, y Next.js lanza
   "Attempted to call blocksToMarkdown() from the server but
   blocksToMarkdown is on the client" en cuanto un Server Component intenta
   invocarlo para renderizar el brief público — no es invocable fuera de un
   Client Component. Este módulo reimplementa, SIN "use client", un
   subconjunto mínimo del mismo modelo (párrafo/sección/divisor, los únicos
   tipos que necesita un brief) para poder serializar a Markdown tanto en
   Server Components (visor de /convocatorias/[slug]) como desde el wizard
   client (/convocatorias/nueva). El Markdown resultante lo renderiza el
   MISMO visor (`CustomMDX`) que ya usan los casos de estudio de freelancers.

   Forma de bloque "paragraph"/"content" (no "text"/"html" como el Canvas
   del freelancer) para coincidir con el shape YA sembrado por la capa de
   datos (scripts/seed-demo-contest.ts, DEMO_BRIEF: `{ type: "paragraph",
   content }[]`, sin campo `id`) — la convocatoria demo ya vive en la BD
   compartida con ese shape exacto, así que el lector debe aceptarlo tal
   cual en vez de forzar un formato propio distinto. `id` se agrega solo
   como campo de conveniencia para el editor (key de React); no se asume
   presente al leer JSON externo. ═══════════════════════════════════════ */

export type ContestBlock =
  | { id: string; type: "paragraph"; content: string }
  | { id: string; type: "section"; title: string }
  | { id: string; type: "divider" };

export type ContestBlockType = ContestBlock["type"];

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createContestBlock(type: ContestBlockType): ContestBlock {
  switch (type) {
    case "paragraph":
      return { id: newId(), type, content: "" };
    case "section":
      return { id: newId(), type, title: "" };
    case "divider":
      return { id: newId(), type };
  }
}

// Escapa los caracteres que el pipeline MDX interpreta como marcado/JSX
// (mismo criterio que escapeJsxText en ContentBlocks.tsx, reimplementado
// aquí porque ese archivo no es invocable desde un Server Component — ver
// comentario de cabecera) para que el texto libre del client nunca rompa
// el render ni se interprete como una etiqueta.
function escapeMdx(text: string): string {
  return text.replace(/[<>{}]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "{":
        return "&#123;";
      case "}":
        return "&#125;";
      default:
        return char;
    }
  });
}

// Lectura defensiva: `brief`/`terms` es un Prisma Json? sin validación de
// runtime (tipado `unknown` en ContestDetail) — un registro escrito a mano
// o por otra herramienta podría traer un `type` desconocido o faltarle un
// campo esperado; nunca debe tumbar el render público.
function contestBlockToMarkdown(block: Record<string, unknown>): string {
  const type = typeof block.type === "string" ? block.type : "";
  switch (type) {
    case "paragraph": {
      const raw = typeof block.content === "string" ? block.content : "";
      const content = raw.trim();
      if (!content) return "";
      // Párrafos separados por línea en blanco: cada línea no vacía del
      // Textarea es su propio párrafo (remark ya los separa con "\n\n").
      return content
        .split(/\n{2,}/)
        .map((paragraph) => escapeMdx(paragraph.trim()))
        .filter((paragraph) => paragraph !== "")
        .join("\n\n");
    }
    case "section": {
      const raw = typeof block.title === "string" ? block.title : "";
      const title = raw.trim();
      // "---\n\n## título": mismo patrón que el bloque "Nueva sección" del
      // editor de piezas (blockToMarkdown, case "section") — la línea en
      // blanco entre el divisor y el heading es obligatoria para que remark
      // los lea como dos nodos de bloque separados.
      return title ? `---\n\n## ${escapeMdx(title)}` : "";
    }
    case "divider":
      return "---";
    default:
      return "";
  }
}

export function contestBlocksToMarkdown(blocks: ContestBlock[]): string {
  return blocks
    .map((block) => contestBlockToMarkdown(block as unknown as Record<string, unknown>))
    .filter((text) => text.trim() !== "")
    .join("\n\n");
}

// Lectura permisiva de Contest.brief/terms (Prisma Json?, tipado `unknown`
// en ContestDetail): solo valida forma de array, mismo criterio que el
// resto del pipeline de bloques.
export function toContestBlocks(value: unknown): ContestBlock[] {
  return Array.isArray(value) ? (value as ContestBlock[]) : [];
}

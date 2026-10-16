// Elección de título + piezas de cada ventana de cristal del Hero
// (HeroParallax.tsx). Módulo puro, sin "use client": se ejecuta SOLO en el
// server (page.tsx), una vez por regeneración ISR (`revalidate = 300` en
// page.tsx) — así el resultado queda fijo durante esos 5 minutos y no hay
// Math.random() corriendo en el render del cliente (evita mismatch de
// hidratación, ver HeroParallax.tsx que ya solo consume el resultado).

import { PIECE_CATEGORIES, type PieceCategory } from "@/lib/pieceCategories";
import type { HeroPiece } from "./HeroParallax";

// Cuántos proyectos muestra cada ventana, en orden izquierda / centro /
// derecha. Única fuente de verdad para AMBOS lados: page.tsx (server) lo usa
// como `slotCounts` de `pickHeroPanels` más abajo, y HeroParallax.tsx
// (client) para el tamaño de cada `ProjectGrid`/`PlaceholderGrid`. Vive
// aquí, en un módulo SIN "use client", a propósito — ver el comentario en
// HeroParallax.tsx sobre por qué no puede vivir allá.
export const PANEL_SLOTS = [4, 2, 4] as const;

interface HeroTitleEntry {
  label: string;
  categories: PieceCategory[];
}

// Catálogo de títulos que puede anunciar una ventana: las categorías reales
// de PortfolioPiece (PIECE_CATEGORIES) más los sinónimos/etiquetas naturales
// que Ricardo pidió (2026-08) cuando mapean 1:1 a una categoría real (p.ej.
// "Rebranding" -> Branding, "Edición de video"/"Motion" -> Motion Design).
// `satisfies` deja que TS avise si algún `categories` usa un valor fuera de
// PIECE_CATEGORIES.
const HERO_TITLE_POOL: HeroTitleEntry[] = [
  { label: "Diseño gráfico", categories: ["Diseño"] },
  { label: "Ilustración", categories: ["Ilustración"] },
  { label: "Arte digital", categories: ["Ilustración"] },
  { label: "Animación", categories: ["Animación"] },
  { label: "Motion", categories: ["Motion Design"] },
  { label: "Edición de video", categories: ["Motion Design"] },
  { label: "Branding", categories: ["Branding"] },
  { label: "Rebranding", categories: ["Branding"] },
  { label: "Modelado 3D", categories: ["Modelado 3D"] },
  { label: "UX/UI", categories: ["UX/UI"] },
  { label: "Fotografía", categories: ["Fotografía"] },
  { label: "Programación", categories: ["Programación"] },
] satisfies HeroTitleEntry[];

// Referencia muda: garantiza en compilación que toda categoría real tiene al
// menos un título en el pool de arriba (si se agrega una a
// PIECE_CATEGORIES sin sumarla aquí, esta línea deja de tipar).
const _coverage: Record<PieceCategory, true> = Object.fromEntries(
  PIECE_CATEGORIES.map((c) => [c, true as const]),
) as Record<PieceCategory, true>;
void _coverage;

// Categorías afines por cercanía visual/temática: SOLO se usan para rellenar
// una ventana cuando su categoría exacta no tiene piezas suficientes (ver
// `pickHeroPanels`), antes de recurrir al feed completo sin distinción.
const CATEGORY_AFFINITY: Record<PieceCategory, PieceCategory[]> = {
  Diseño: ["Branding", "Ilustración", "UX/UI"],
  Ilustración: ["Diseño", "Animación", "Modelado 3D"],
  Branding: ["Diseño", "UX/UI"],
  Animación: ["Motion Design", "Ilustración"],
  "Motion Design": ["Animación", "Fotografía"],
  "Modelado 3D": ["Ilustración", "Animación"],
  "UX/UI": ["Diseño", "Programación"],
  Fotografía: ["Diseño", "Motion Design"],
  Programación: ["UX/UI"],
};

function normalizeCategory(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function pieceMatches(piece: HeroPiece, categories: readonly PieceCategory[]): boolean {
  if (categories.length === 0) return false;
  const normalized = categories.map(normalizeCategory);
  return normalized.includes(normalizeCategory(piece.tag));
}

/** Fisher–Yates. Server-only (ver cabecera del archivo): nunca se llama
 *  durante el render del cliente. */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface HeroPanelContent {
  title: string;
  /** Ya recortado/rellenado exactamente a `slotCounts[i]` piezas. */
  pieces: HeroPiece[];
  /** true si la categoría exacta del título no tenía piezas suficientes y se
   *  completó con categorías afines o con el resto del feed. */
  usedFallback: boolean;
}

/**
 * Elige un título distinto por ventana (uno por entrada de `slotCounts`)
 * entre los que SÍ tienen al menos una pieza en `pieces`, y arma el listado
 * de cada ventana respetando el ORDEN de llegada de `pieces` (ya viene
 * priorizado — ver getPortfolioFeed/PRO_PLANS): primero piezas de la
 * categoría exacta, luego de categorías afines, luego el resto del feed
 * ciclado, solo si hacen falta para completar el cupo de la ventana.
 */
export function pickHeroPanels(pieces: HeroPiece[], slotCounts: readonly number[]): HeroPanelContent[] {
  const eligible = HERO_TITLE_POOL.filter((entry) => pieces.some((piece) => pieceMatches(piece, entry.categories)));
  // Feed vacío o sin categorías reconocidas (piezas legacy): en vez de dejar
  // las ventanas sin título, cae al pool completo — quedan sin piezas propias
  // (ver más abajo) pero el Hero conserva su diseño con ejemplos de
  // categorías disponibles en la plataforma.
  const pool = eligible.length > 0 ? eligible : HERO_TITLE_POOL;
  const shuffled = shuffle(pool);

  // Varias entradas del pool son sinónimos de la MISMA categoría real (p.ej.
  // "Branding"/"Rebranding"): una primera pasada evita repetir categoría
  // entre ventanas, para que las 3 se sientan distintas entre sí. Solo si no
  // hay suficiente variedad (pool pequeño) se permite repetir.
  const chosen: HeroTitleEntry[] = [];
  const usedCategoryKeys = new Set<string>();
  for (const entry of shuffled) {
    if (chosen.length >= slotCounts.length) break;
    const key = [...entry.categories].sort().join("|");
    if (usedCategoryKeys.has(key)) continue;
    chosen.push(entry);
    usedCategoryKeys.add(key);
  }
  for (let i = 0; chosen.length < slotCounts.length; i++) {
    chosen.push(shuffled[i % shuffled.length]);
  }

  return chosen.map((entry, i) => {
    const count = slotCounts[i] ?? 0;
    const primary = pieces.filter((piece) => pieceMatches(piece, entry.categories));
    const affineCats = entry.categories
      .flatMap((cat) => CATEGORY_AFFINITY[cat] ?? [])
      .filter((cat) => !entry.categories.includes(cat));
    const usedIds = new Set(primary.map((p) => p.id));
    const affine = pieces.filter((piece) => !usedIds.has(piece.id) && pieceMatches(piece, affineCats));
    affine.forEach((p) => usedIds.add(p.id));
    const rest = pieces.filter((piece) => !usedIds.has(piece.id));
    const ranked = [...primary, ...affine, ...rest];
    const usedFallback = primary.length < count && ranked.length > 0;

    const filled: HeroPiece[] =
      ranked.length === 0
        ? []
        : Array.from({ length: count }, (_, slot) => {
            const piece = ranked[slot % ranked.length];
            return { ...piece, id: `${piece.id}-${i}-${slot}` };
          });

    return { title: entry.label, pieces: filled, usedFallback };
  });
}

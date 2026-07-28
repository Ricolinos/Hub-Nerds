"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { ContentBlock } from "@/components/profile/ContentBlocks";
import { Prisma } from "@/generated/prisma/client";
import { isValidPieceCategory } from "@/lib/pieceCategories";
import { getPublicFreelancersByUsernames } from "@/lib/portfolio";
import { prisma } from "@/lib/prisma";
import { FREELANCER_ROLE_VALUES } from "@/lib/roles";
import { isPortfolioMediaUrl } from "@/lib/storageConfig";

// Adjunto con nombre del modo Pro del editor MDX (ver PortfolioPiece.attachments
// en el schema): el MDX referencia el archivo por `name`, nunca por `url`
// directamente. `url` siempre debe apuntar al bucket portfolio-media de
// Supabase Storage (ver isPortfolioMediaUrl), nunca a un origen arbitrario.
export interface PieceAttachment {
  name: string;
  url: string;
  type: "image" | "video";
}

export interface CreatePortfolioPieceInput {
  title: string;
  // Resumen opcional del proyecto (máx. MAX_DESCRIPTION_LENGTH, validado
  // server-side abajo); vacío/solo-espacios se persiste como `null`.
  description?: string;
  content: string;
  // Bloques estructurados del Canvas; se guardan tal cual para poder
  // reabrirlos en modo edición sin depender de parsear el Markdown.
  // FEATURE (Modo Pro, ver CreateProjectModal.tsx): `undefined` = "no
  // tocar" (el default de siempre); `null` = modo Pro, BORRA los bloques
  // existentes explícitamente (ver `toContentBlocksData` abajo) porque el
  // usuario escribió Markdown/MDX a mano y ya no hay Canvas que reabrir.
  contentBlocks?: ContentBlock[] | null;
  category?: string;
  // Data URL (sin bucket de Storage todavía, igual que gallery)
  coverUrl?: string;
  downloadUrl?: string;
  resourcePassword?: string;
  isPublic: boolean;
  // URLs (o data URLs) de los archivos adjuntados desde el editor
  gallery?: string[];
  // Máx. 5, validado abajo. LEGACY: el editor nuevo usa `subcategories`.
  tags?: string[];
  // Subcategorías libres de la pieza (máx. 10, validado abajo). Al menos 1
  // es obligatoria para publicar (isPublic true); los borradores no la exigen.
  subcategories?: string[];
  // Software/herramientas usadas en la pieza (máx. 15, validado abajo)
  software?: string[];
  // Usernames de colaboradores, sin validar contra la tabla User todavía
  collaborators?: string[];
  releaseDate?: Date;
  // FEATURE (Modo Pro): adjuntos con nombre subidos a Supabase Storage que el
  // MDX referencia por `name` (máx. MAX_ATTACHMENTS, validado abajo).
  // `undefined` = no tocar (update); array (incluso vacío) = reemplaza el
  // set completo, igual que `gallery`.
  attachments?: PieceAttachment[];
}

export interface UpdatePortfolioPieceInput extends CreatePortfolioPieceInput {}

export interface PortfolioPieceForEdit {
  id: string;
  title: string;
  description: string | null;
  category: string;
  coverUrl: string;
  contentBlocks: ContentBlock[];
  // FEATURE (Modo Pro): fuente cruda de `content` — el editor la usa para
  // decidir en qué modo abrir (ver CreateProjectModal.tsx: contentBlocks
  // vacío + markdownContent con texto = pro) y para sembrar el Textarea.
  markdownContent: string;
  tags: string[];
  subcategories: string[];
  software: string[];
  collaborators: string[];
  // Perfiles resueltos de `collaborators` (mismo criterio de "freelancer
  // público" que el visor, ver getPublicFreelancersByUsernames en
  // lib/portfolio.ts) — SOLO para pintar avatar/nombre en el panel "Editar
  // proyecto" (CreateProjectModal.tsx). `collaborators` (usernames) sigue
  // siendo la fuente que se guarda: un colaborador que dejó de ser público
  // simplemente no aparece aquí, pero su username no se pierde hasta que el
  // usuario lo quite a mano del panel.
  collaboratorProfiles: PublicFreelancerResult[];
  releaseDate: string | null;
  isPublic: boolean;
  gallery: string[];
  downloadUrl: string;
  resourcePassword: string;
  attachments: PieceAttachment[];
}

const MAX_TAGS = 5;
const MAX_SUBCATEGORIES = 10;
const MAX_SOFTWARE = 15;
const MAX_TAXONOMY_LABEL_LENGTH = 30;
// Descripción breve opcional del proyecto (PortfolioPiece.description).
const MAX_DESCRIPTION_LENGTH = 140;
// FEATURE (Modo Pro): tope duro del Markdown/MDX crudo (markdownContent).
// El asistido rara vez se acerca a esto (lo genera blocksToMarkdown a
// partir de bloques ya acotados), pero el Pro es texto libre — sin límite,
// una pieza gigante podría inflar el payload/BD sin aviso.
const MAX_MARKDOWN_CONTENT_BYTES = 100 * 1024; // 100KB

// FEATURE (Modo Pro): traduce el `contentBlocks` que llega del cliente al
// valor real que espera Prisma para un campo `Json?` — `undefined` (no
// enviado) deja el campo intacto en `update` como siempre; `null` explícito
// (modo Pro) debe escribirse como `Prisma.DbNull` porque el driver de
// Prisma 7 rechaza un `null` de JS a secas en columnas Json (ambiguo entre
// "SQL NULL" y "el valor JSON `null`") — DbNull es la lectura correcta acá:
// sin bloques en absoluto, no un array vacío.
function toContentBlocksData(
  contentBlocks: ContentBlock[] | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (contentBlocks === undefined) return undefined;
  if (contentBlocks === null) return Prisma.DbNull;
  return contentBlocks as unknown as Prisma.InputJsonValue;
}

// FEATURE (Modo Pro): adjuntos con nombre — máx. 30, nombre 1-80 caracteres
// (trim, sin duplicados case-insensitive) y `url` debe pertenecer al bucket
// portfolio-media (ver isPortfolioMediaUrl en lib/storageConfig.ts), nunca un
// origen arbitrario pegado a mano.
const MAX_ATTACHMENTS = 30;
const MAX_ATTACHMENT_NAME_LENGTH = 80;

function normalizeAttachments(attachments: PieceAttachment[]): PieceAttachment[] {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new Error(`Máximo ${MAX_ATTACHMENTS} archivos adjuntos por proyecto`);
  }

  const seen = new Set<string>();
  const result: PieceAttachment[] = [];
  for (const raw of attachments) {
    const name = raw.name?.trim();
    if (!name || name.length > MAX_ATTACHMENT_NAME_LENGTH) {
      throw new Error(`Nombre de adjunto inválido: "${raw.name ?? ""}"`);
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Nombre de adjunto duplicado: "${name}"`);
    }
    if (raw.type !== "image" && raw.type !== "video") {
      throw new Error(`Tipo de adjunto inválido para "${name}"`);
    }
    if (typeof raw.url !== "string" || !isPortfolioMediaUrl(raw.url)) {
      throw new Error(`URL de adjunto no permitida para "${name}"`);
    }
    seen.add(key);
    result.push({ name, url: raw.url, type: raw.type });
  }
  return result;
}

// Mismo patrón que toContentBlocksData: `undefined` (no enviado) deja el
// campo intacto en `update`; un array (incluso vacío) reemplaza el set
// completo — vacío se persiste como `Prisma.DbNull`, no como `[]`.
function toAttachmentsData(
  attachments: PieceAttachment[] | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (attachments === undefined) return undefined;
  const normalized = normalizeAttachments(attachments);
  if (normalized.length === 0) return Prisma.DbNull;
  return normalized as unknown as Prisma.InputJsonValue;
}

const MAX_FREELANCER_RESULTS = 24;
const MAX_SUBCATEGORY_SUGGESTIONS = 8;
// Piezas públicas escaneadas para armar sugerencias de autocompletado
// (getSubcategorySuggestions); dev-simple, sin caché ni índice dedicado.
const SUBCATEGORY_SUGGESTION_SCAN_LIMIT = 200;

// Normaliza una lista de etiquetas libres (subcategories/software): recorta
// espacios, descarta vacías/demasiado largas, deduplica sin distinguir
// mayúsculas/minúsculas (conserva la primera variante de capitalización) y
// aplica el máximo de elementos.
function normalizeTaxonomyList(values: string[] | undefined, max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values ?? []) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > MAX_TAXONOMY_LABEL_LENGTH) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result;
}

// Trim + límite duro; vacío se persiste como `null` (columna opcional).
function normalizeDescription(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres`);
  }
  return trimmed;
}

export interface PublicFreelancerResult {
  id: string;
  username: string;
  name: string | null;
  imageUrl: string | null;
  headline: string | null;
  primaryRole: string | null;
}

// Busca freelancers públicos por nombre/username/headline/rol para la
// herramienta "Freelancers" del Canvas Markdown. Requiere sesión: solo
// usuarios logueados (client o collaborator) pueden buscar para etiquetar
// colaboradores en una pieza de portafolio.
export async function searchPublicFreelancers(
  query: string,
  limit = 12,
): Promise<PublicFreelancerResult[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const take = Math.min(Math.max(limit, 1), MAX_FREELANCER_RESULTS);
  const q = query.trim();

  const freelancers = await prisma.user.findMany({
    where: {
      role: { in: FREELANCER_ROLE_VALUES },
      isPublic: true,
      username: { not: null },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
              { headline: { contains: q, mode: "insensitive" } },
              { primaryRole: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      imageUrl: true,
      headline: true,
      primaryRole: true,
    },
    take,
  });

  return freelancers
    .filter(
      (freelancer): freelancer is typeof freelancer & { username: string } => freelancer.username !== null,
    )
    .map((freelancer) => ({
      id: freelancer.id,
      username: freelancer.username,
      name: freelancer.name,
      imageUrl: freelancer.imageUrl,
      headline: freelancer.headline,
      primaryRole: freelancer.primaryRole,
    }));
}

// Valida category/subcategories entrantes y devuelve los valores ya
// normalizados listos para persistir. Se usa en create y update:
// - category: si viene, debe pertenecer a PIECE_CATEGORIES (piezas viejas
//   con categoría fuera de la lista no se tocan si el cliente no manda una).
// - subcategories: al menos 1 es obligatoria para publicar (isPublic true);
//   los borradores (isPublic false) pueden guardarse sin ninguna.
function validatePieceTaxonomy(input: CreatePortfolioPieceInput) {
  const category = input.category?.trim();
  if (category && !isValidPieceCategory(category)) {
    throw new Error(`Categoría inválida: "${category}"`);
  }

  const subcategories = normalizeTaxonomyList(input.subcategories, MAX_SUBCATEGORIES);
  if (input.isPublic && subcategories.length === 0) {
    throw new Error("Agrega al menos una subcategoría antes de publicar");
  }

  const software = normalizeTaxonomyList(input.software, MAX_SOFTWARE);

  return { category, subcategories, software };
}

// Tope duro del Markdown/MDX guardado (ver MAX_MARKDOWN_CONTENT_BYTES):
// aplica igual a asistido y Pro — en la práctica solo Pro (texto libre) se
// acerca al límite.
function validateContentSize(content: string) {
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_MARKDOWN_CONTENT_BYTES) {
    throw new Error(
      `El contenido es demasiado grande (${(bytes / 1024).toFixed(0)}KB). El máximo es ${MAX_MARKDOWN_CONTENT_BYTES / 1024}KB.`,
    );
  }
}

// Crea una pieza de portafolio desde el editor de Markdown del Freelancer.
// El contenido se guarda como texto plano; siempre queda ligada al usuario
// autenticado vía Clerk, nunca a un userId recibido del cliente.
export async function createPortfolioPiece(
  input: CreatePortfolioPieceInput,
): Promise<{ id: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error("El título es obligatorio");
  if (!content) throw new Error("El contenido es obligatorio");
  validateContentSize(content);

  const { category, subcategories, software } = validatePieceTaxonomy(input);
  const description = normalizeDescription(input.description);

  const piece = await prisma.portfolioPiece.create({
    data: {
      title,
      description,
      markdownContent: content,
      contentBlocks: toContentBlocksData(input.contentBlocks),
      category: category || undefined,
      coverUrl: input.coverUrl || null,
      downloadUrl: input.downloadUrl?.trim() || null,
      resourcePassword: input.resourcePassword?.trim() || null,
      isPublic: input.isPublic,
      gallery: input.gallery && input.gallery.length > 0 ? input.gallery : undefined,
      attachments: toAttachmentsData(input.attachments),
      tags: (input.tags ?? []).slice(0, MAX_TAGS),
      subcategories,
      software,
      collaborators: input.collaborators ?? [],
      releaseDate: input.releaseDate ?? null,
      userId,
    },
    select: { id: true },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  if (user?.username) revalidatePath(`/${user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");

  return { id: piece.id };
}

// Trae una pieza completa para precargar el Canvas en modo edición.
// Solo el dueño puede leerla (incluye borradores).
export async function getPortfolioPieceForEdit(pieceId: string): Promise<PortfolioPieceForEdit> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      coverUrl: true,
      contentBlocks: true,
      markdownContent: true,
      tags: true,
      subcategories: true,
      software: true,
      collaborators: true,
      releaseDate: true,
      isPublic: true,
      gallery: true,
      attachments: true,
      downloadUrl: true,
      resourcePassword: true,
      userId: true,
    },
  });
  if (!piece || piece.userId !== userId) throw new Error("No autorizado");

  const collaboratorProfiles = await getPublicFreelancersByUsernames(piece.collaborators);

  return {
    id: piece.id,
    title: piece.title,
    description: piece.description,
    category: piece.category,
    coverUrl: piece.coverUrl ?? "",
    contentBlocks: Array.isArray(piece.contentBlocks)
      ? (piece.contentBlocks as unknown as ContentBlock[])
      : [],
    markdownContent: piece.markdownContent ?? "",
    tags: piece.tags,
    subcategories: piece.subcategories,
    software: piece.software,
    collaborators: piece.collaborators,
    collaboratorProfiles,
    releaseDate: piece.releaseDate ? piece.releaseDate.toISOString() : null,
    isPublic: piece.isPublic,
    gallery: Array.isArray(piece.gallery) ? (piece.gallery as unknown as string[]) : [],
    attachments: Array.isArray(piece.attachments)
      ? (piece.attachments as unknown as PieceAttachment[])
      : [],
    downloadUrl: piece.downloadUrl ?? "",
    resourcePassword: piece.resourcePassword ?? "",
  };
}

// Actualiza una pieza existente desde el Canvas. Mismas reglas que crear:
// solo el dueño puede editarla, nunca se confía en un userId del cliente.
export async function updatePortfolioPiece(
  pieceId: string,
  input: UpdatePortfolioPieceInput,
): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error("El título es obligatorio");
  if (!content) throw new Error("El contenido es obligatorio");
  validateContentSize(content);

  const existing = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!existing || existing.userId !== userId) throw new Error("No autorizado");

  const { category, subcategories, software } = validatePieceTaxonomy(input);
  const description = normalizeDescription(input.description);

  await prisma.portfolioPiece.update({
    where: { id: pieceId },
    data: {
      title,
      description,
      markdownContent: content,
      contentBlocks: toContentBlocksData(input.contentBlocks),
      category: category || undefined,
      coverUrl: input.coverUrl || null,
      downloadUrl: input.downloadUrl?.trim() || null,
      resourcePassword: input.resourcePassword?.trim() || null,
      isPublic: input.isPublic,
      gallery: input.gallery && input.gallery.length > 0 ? input.gallery : undefined,
      attachments: toAttachmentsData(input.attachments),
      tags: (input.tags ?? []).slice(0, MAX_TAGS),
      subcategories,
      software,
      collaborators: input.collaborators ?? [],
      releaseDate: input.releaseDate ?? null,
    },
  });

  if (existing.user.username) revalidatePath(`/${existing.user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");
}

// Elimina una pieza. Irreversible: sin soft-delete, coherente con el aviso
// que se muestra antes de confirmar en el diálogo del cliente.
export async function deletePortfolioPiece(pieceId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!piece || piece.userId !== userId) throw new Error("No autorizado");

  await prisma.portfolioPiece.delete({ where: { id: pieceId } });

  if (piece.user.username) revalidatePath(`/${piece.user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");
}

// Cambia la visibilidad de una pieza (público ↔ borrador).
// Solo el dueño de la pieza puede modificarla.
export async function setPieceVisibility(pieceId: string, isPublic: boolean): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const piece = await prisma.portfolioPiece.findUnique({
    where: { id: pieceId },
    select: { userId: true, user: { select: { username: true } } },
  });
  if (!piece || piece.userId !== userId) throw new Error("No autorizado");

  await prisma.portfolioPiece.update({
    where: { id: pieceId },
    data: { isPublic },
  });

  // Los borradores desaparecen de perfil público, Explorar y Home.
  if (piece.user.username) revalidatePath(`/${piece.user.username}`);
  revalidatePath("/explorar");
  revalidatePath("/");
}

// Sugerencias de autocompletado para el campo "subcategorías" del editor:
// subcategorías ya usadas en piezas PÚBLICAS de cualquier usuario que
// empiecen o contengan `query`. Prisma no soporta distinct sobre columnas
// array, así que se trae un lote razonable de piezas públicas y se
// aplana/dedup/filtra en memoria — dev-simple, sin caché.
export async function getSubcategorySuggestions(
  query: string,
  limit = MAX_SUBCATEGORY_SUGGESTIONS,
): Promise<string[]> {
  const q = query.trim().toLowerCase();
  const take = Math.min(Math.max(limit, 1), MAX_SUBCATEGORY_SUGGESTIONS);

  const pieces = await prisma.portfolioPiece.findMany({
    where: { isPublic: true, subcategories: { isEmpty: false } },
    select: { subcategories: true },
    orderBy: { createdAt: "desc" },
    take: SUBCATEGORY_SUGGESTION_SCAN_LIMIT,
  });

  const seen = new Set<string>();
  const suggestions: string[] = [];
  for (const piece of pieces) {
    for (const subcategory of piece.subcategories) {
      const key = subcategory.toLowerCase();
      if (seen.has(key)) continue;
      if (q && !key.includes(q)) continue;
      seen.add(key);
      suggestions.push(subcategory);
      if (suggestions.length >= take) return suggestions;
    }
  }
  return suggestions;
}

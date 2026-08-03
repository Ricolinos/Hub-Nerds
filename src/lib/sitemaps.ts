import { prisma } from "@/lib/prisma";
import { baseURL, LEGAL_ROUTES } from "@/resources";
import { CATEGORY_SLUGS } from "@/components/explore/categories";
import { RESOURCE_CATEGORY_SLUGS } from "@/components/resources/categories";
import { FREELANCER_ROLE_VALUES } from "@/lib/roles";
import { slugifyTitle } from "@/lib/caseStudies";

/* Generación del sitemap index y sus sub-sitemaps (/sitemap.xml → /sitemaps/*).
 *
 * Solo entra contenido alcanzable por un visitante ANÓNIMO: las rutas tras
 * login (mensajes, proyectos conjuntos, dashboards) producen soft-404s ante
 * el crawler y perjudican la evaluación del sitio, así que quedan fuera y
 * además bloqueadas en robots.ts. Los perfiles de client tampoco entran:
 * responden 404 a terceros por diseño (privacidad de perfiles). */

export interface SitemapEntry {
  loc: string;
  /** Fecha real de última modificación (YYYY-MM-DD). Se omite si no hay una
   *  verdadera: un lastmod inventado "hoy" en cada request hace que Google
   *  ignore la señal completa. */
  lastmod?: string;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function entryXml(entry: SitemapEntry): string {
  const lastmod = entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : "";
  return `<url><loc>${xmlEscape(entry.loc)}</loc>${lastmod}</url>`;
}

export function urlsetXml(entries: SitemapEntry[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries.map(entryXml).join("\n") +
    `\n</urlset>\n`
  );
}

export function sitemapIndexXml(locs: string[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    locs.map((loc) => `<sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join("\n") +
    `\n</sitemapindex>\n`
  );
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

/** Páginas públicas fijas: home, listados, categorías (de las mismas
 *  constantes que generan las rutas SSG) y legal. */
export function staticPageEntries(): SitemapEntry[] {
  const paths = [
    "/",
    "/explorar",
    ...Object.keys(CATEGORY_SLUGS).map((slug) => `/explorar/${slug}`),
    "/recursos",
    ...Object.keys(RESOURCE_CATEGORY_SLUGS).map((slug) => `/recursos/${slug}`),
    "/servicios",
    "/servicios/cotizador",
    "/servicios/informacion",
    "/servicios/facturacion",
    "/convocatorias",
    "/legal",
    LEGAL_ROUTES.terms,
    LEGAL_ROUTES.privacy,
  ];
  return paths.map((path) => ({ loc: `${baseURL}${path === "/" ? "" : path}` }));
}

/** Perfiles públicos de freelancers (los de client responden 404 a terceros). */
export async function profileEntries(): Promise<SitemapEntry[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: FREELANCER_ROLE_VALUES },
      isPublic: true,
      username: { not: null },
    },
    select: { username: true, updatedAt: true },
    orderBy: { username: "asc" },
  });
  return users
    .filter((u): u is { username: string; updatedAt: Date } => u.username !== null)
    .map((u) => ({
      loc: `${baseURL}/${encodeURIComponent(u.username)}`,
      lastmod: fmtDate(u.updatedAt),
    }));
}

/** Casos de estudio publicados y visitables: pieza pública con markdown
 *  (sin markdownContent el visor responde 404), de un freelancer con perfil
 *  público. La URL usa slugifyTitle(title) — la columna `slug` de la BD está
 *  en null en todas las piezas: el visor resuelve por título slugificado
 *  (src/app/[username]/proyecto/[slug]/page.tsx), no por esa columna. */
export async function pieceEntries(): Promise<SitemapEntry[]> {
  const pieces = await prisma.portfolioPiece.findMany({
    where: {
      isPublic: true,
      AND: [{ markdownContent: { not: null } }, { markdownContent: { not: "" } }],
      user: {
        role: { in: FREELANCER_ROLE_VALUES },
        isPublic: true,
        username: { not: null },
      },
    },
    select: { title: true, updatedAt: true, user: { select: { username: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return pieces
    .map((p) => ({
      username: p.user.username,
      slug: slugifyTitle(p.title),
      updatedAt: p.updatedAt,
    }))
    .filter(
      (p): p is typeof p & { username: string } => p.username !== null && p.slug !== "",
    )
    .map((p) => ({
      loc: `${baseURL}/${encodeURIComponent(p.username)}/proyecto/${encodeURIComponent(p.slug)}`,
      lastmod: fmtDate(p.updatedAt),
    }));
}

/** Convocatorias visibles al público: activas, en Terna o falladas.
 *  DRAFT nunca se lista y las canceladas/incumplidas no aportan a búsqueda. */
export async function contestEntries(): Promise<SitemapEntry[]> {
  const contests = await prisma.contest.findMany({
    where: { status: { in: ["PUBLISHED", "SHORTLIST", "AWARDED"] } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return contests.map((c) => ({
    loc: `${baseURL}/convocatorias/${encodeURIComponent(c.slug)}`,
    lastmod: fmtDate(c.updatedAt),
  }));
}

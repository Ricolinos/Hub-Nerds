import fs from "fs";
import path from "path";
import { getPosts } from "@/utils/utils";

// Casos de estudio MDX de piezas publicadas por Freelancers.
// Un archivo por pieza en src/content/portfolio/<username>/<slug>.mdx,
// donde <slug> es el título de la pieza slugificado.
const CONTENT_ROOT = ["src", "content", "portfolio"];

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function freelancerDir(username: string) {
  return path.join(process.cwd(), ...CONTENT_ROOT, username);
}

// Una pieza tiene visor si existe su .mdx legado en disco O si se creó desde
// el editor de Markdown propio (hasDbContent = markdownContent no vacío).
export function caseStudyHref(
  username: string,
  title: string,
  hasDbContent = false,
): string | undefined {
  const slug = slugifyTitle(title);
  if (hasDbContent) return `/${username}/proyecto/${slug}`;
  const file = path.join(freelancerDir(username), `${slug}.mdx`);
  return fs.existsSync(file) ? `/${username}/proyecto/${slug}` : undefined;
}

export function getCaseStudy(username: string, slug: string) {
  if (!fs.existsSync(freelancerDir(username))) return null;
  return getPosts([...CONTENT_ROOT, username]).find((post) => post.slug === slug) ?? null;
}

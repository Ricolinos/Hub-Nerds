import { baseURL } from "@/resources";
import { sitemapIndexXml, xmlResponse } from "@/lib/sitemaps";

/* Sitemap INDEX: apunta a los sub-sitemaps por tipo de contenido.
 * Sustituye al src/app/sitemap.ts del template (lista plana estática con
 * lastmod "hoy" que además incluía rutas tras login como /mensajes). */

export const revalidate = 3600;

export function GET() {
  return xmlResponse(
    sitemapIndexXml([
      `${baseURL}/sitemaps/paginas.xml`,
      `${baseURL}/sitemaps/perfiles.xml`,
      `${baseURL}/sitemaps/proyectos.xml`,
      `${baseURL}/sitemaps/convocatorias.xml`,
    ]),
  );
}

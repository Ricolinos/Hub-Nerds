import { baseURL } from "@/resources";

// Páginas internas que existen para revisar cómo renderiza el sitio, no para
// que llegue nadie por búsqueda. Se acceden por enlace directo; el `noindex`
// de su propio metadata ya evita que se indexen, y este `Disallow` hace que
// los rastreadores ni siquiera las pidan.
const UNLISTED_PATHS = ["/ejercicios/markdown-showcase"];

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: UNLISTED_PATHS,
      },
    ],
    sitemap: `${baseURL}/sitemap.xml`,
  };
}

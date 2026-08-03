import { baseURL } from "@/resources";

// Páginas internas que existen para revisar cómo renderiza el sitio, no para
// que llegue nadie por búsqueda. Se acceden por enlace directo; el `noindex`
// de su propio metadata ya evita que se indexen, y este `Disallow` hace que
// los rastreadores ni siquiera las pidan.
const UNLISTED_PATHS = ["/ejercicios/markdown-showcase", "/ejercicios/editor-audit"];

// Zonas tras login: al crawler anónimo le responden con redirect a /sign-in
// (soft-404 a ojos de Google, resta calidad al sitio). Bloquearlas ahorra
// crawl budget y evita que aparezcan como "indexada sin contenido".
const AUTH_ONLY_PATHS = [
  "/mensajes",
  "/proyectos",
  "/dashboard",
  "/complete-profile",
  "/bienvenida",
  "/sso-callback",
];

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: [...UNLISTED_PATHS, ...AUTH_ONLY_PATHS],
      },
    ],
    sitemap: `${baseURL}/sitemap.xml`,
  };
}

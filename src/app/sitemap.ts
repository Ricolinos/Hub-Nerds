import { baseURL, routes as routesConfig, LEGAL_ROUTES } from "@/resources";

export default async function sitemap() {
  // Ya no se recorren src/app/blog/posts ni src/app/work/projects: esas rutas
  // eran del template original y se eliminaron. getPosts() hace readdirSync
  // sobre la carpeta, así que dejarlo apuntando ahí reventaba el sitemap.
  const activeRoutes = Object.keys(routesConfig).filter(
    (route) => routesConfig[route as keyof typeof routesConfig],
  );

  // "/legal" es la única entrada en routesConfig (índice); sus dos documentos
  // son rutas estáticas hijas que no viven en routesConfig, así que se
  // agregan a mano igual que el índice.
  const legalDocRoutes = [LEGAL_ROUTES.terms, LEGAL_ROUTES.privacy];

  return [...activeRoutes, ...legalDocRoutes].map((route) => ({
    url: `${baseURL}${route !== "/" ? route : ""}`,
    lastModified: new Date().toISOString().split("T")[0],
  }));
}

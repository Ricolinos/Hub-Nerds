import { baseURL, routes as routesConfig } from "@/resources";

export default async function sitemap() {
  // Ya no se recorren src/app/blog/posts ni src/app/work/projects: esas rutas
  // eran del template original y se eliminaron. getPosts() hace readdirSync
  // sobre la carpeta, así que dejarlo apuntando ahí reventaba el sitemap.
  const activeRoutes = Object.keys(routesConfig).filter(
    (route) => routesConfig[route as keyof typeof routesConfig],
  );

  return activeRoutes.map((route) => ({
    url: `${baseURL}${route !== "/" ? route : ""}`,
    lastModified: new Date().toISOString().split("T")[0],
  }));
}

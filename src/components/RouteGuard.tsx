"use client";

import { usePathname, notFound } from "next/navigation";
import { routes } from "@/resources";

interface RouteGuardProps {
  children: React.ReactNode;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const pathname = usePathname();

  const isRouteEnabled = () => {
    if (!pathname) return false;

    const alwaysAllowed = [
      "/sign-in",
      "/sign-up",
      "/sso-callback",
      "/complete-profile",
      "/bienvenida",
      "/dashboard",
    ];
    if (alwaysAllowed.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;

    if (pathname in routes) {
      return routes[pathname as keyof typeof routes];
    }

    const dynamicRoutes = [
      "/explorar",
      "/recursos",
      "/servicios",
      "/ejercicios",
      "/proyectos",
      "/convocatorias",
      "/legal",
      "/pro",
    ] as const;
    for (const route of dynamicRoutes) {
      if (pathname.startsWith(route) && routes[route]) {
        return true;
      }
    }

    // Vanity profile URLs (e.g. /ricolinos) resolve via the [username] dynamic
    // route. Exclude the app's own static top-level segments.
    //
    // blog/work/gallery/about siguen en esta lista AUNQUE sus rutas ya no
    // existan: al no haber `page.tsx` propio, Next las hace caer en el
    // catch-all /[username] y las trataría como posibles perfiles, devolviendo
    // 200 en vez de 404. Sin esta exclusión, /blog abriría un perfil vacío.
    const staticSegments = ["about", "actions", "api", "blog", "gallery", "work"];
    const segments = pathname.slice(1).split("/");
    const [firstSegment] = segments;
    if (firstSegment && !staticSegments.includes(firstSegment)) {
      if (segments.length === 1) return true;
      // Caso de estudio de una pieza publicada: /<username>/proyecto/<slug>
      if (segments.length === 3 && segments[1] === "proyecto") return true;
      // Página "CV Live" a pantalla completa: /<username>/cv (ver
      // src/app/[username]/cv/page.tsx)
      if (segments.length === 2 && segments[1] === "cv") return true;
      // Hoja imprimible del CV: /<username>/cv/imprimir (ver
      // src/app/[username]/cv/imprimir/page.tsx)
      if (segments.length === 3 && segments[1] === "cv" && segments[2] === "imprimir") return true;
    }

    return false;
  };

  if (!isRouteEnabled()) {
    notFound();
  }

  return <>{children}</>;
};

export { RouteGuard };

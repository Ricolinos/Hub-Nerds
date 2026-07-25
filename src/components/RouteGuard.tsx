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

    const alwaysAllowed = ["/sign-in", "/sign-up", "/sso-callback", "/complete-profile", "/dashboard"];
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
    ] as const;
    for (const route of dynamicRoutes) {
      if (pathname.startsWith(route) && routes[route]) {
        return true;
      }
    }

    // Vanity profile URLs (e.g. /ricolinos) resolve via the [username] dynamic
    // route. Exclude the app's own top-level segments (incluyendo rutas ya
    // retiradas del boilerplate, que ya no tienen page.tsx propio y por eso
    // caerían en [username] si no se excluyen aquí) para que ningún match
    // accidental de perfil se los trague.
    const staticSegments = ["about", "blog", "work", "gallery", "actions", "api"];
    const segments = pathname.slice(1).split("/");
    const [firstSegment] = segments;
    if (firstSegment && !staticSegments.includes(firstSegment)) {
      if (segments.length === 1) return true;
      // Caso de estudio de una pieza publicada: /<username>/proyecto/<slug>
      if (segments.length === 3 && segments[1] === "proyecto") return true;
    }

    return false;
  };

  if (!isRouteEnabled()) {
    notFound();
  }

  return <>{children}</>;
};

export { RouteGuard };

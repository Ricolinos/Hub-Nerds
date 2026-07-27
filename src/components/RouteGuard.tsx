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
      "/blog",
      "/work",
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
    // route. Exclude the app's own static top-level segments so soft-disabled
    // pages (like /about, /gallery) still respect the `routes` config above.
    const staticSegments = ["about", "actions", "api", "gallery"];
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

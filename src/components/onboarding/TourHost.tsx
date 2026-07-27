"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { PlatformTour } from "@/components/onboarding/PlatformTour";
import { isFocusRoute, TOUR_STORAGE_KEY, TOUR_STOPS } from "@/lib/onboarding";
import { isFreelancerRole } from "@/lib/roles";

/* Anfitrión del tour, montado en el layout RAÍZ.
 *
 * Vive aquí y no en el dashboard por una razón concreta: cada parada del tour
 * propone ir a un destino real, y si el tour muriera al navegar el usuario
 * perdería el recorrido en su primer clic (que es exactamente lo que pasaba).
 * Con el paso guardado en localStorage y el componente montado arriba de
 * todo, el tour reaparece ya avanzado en la página de destino.
 *
 * Arranque: `?tour=1` en cualquier URL (lo pone el final de /bienvenida y el
 * botón de "volver a ver el tour" del perfil). El parámetro se limpia de la
 * barra en cuanto se lee, para que recargar no lo reinicie.
 *
 * El search param se lee de window.location y NO con useSearchParams: ese
 * hook obliga a un Suspense boundary y ya rompió el prerender de producción
 * una vez (ver el comentario en [username]/page.tsx). */
export function TourHost() {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [step, setStep] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const isFreelancer = isFreelancerRole(user?.publicMetadata?.role as string | undefined);
  const username = user?.username ?? null;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    setHydrated(true);

    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      window.localStorage.setItem(TOUR_STORAGE_KEY, "0");
      params.delete("tour");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      setStep(0);
      return;
    }

    const stored = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored === null) return;
    const parsed = Number.parseInt(stored, 10);
    setStep(Number.isNaN(parsed) || parsed >= TOUR_STOPS.length ? null : parsed);
  }, [isLoaded, isSignedIn, pathname]);

  const persist = useCallback((next: number | null) => {
    if (next === null) window.localStorage.removeItem(TOUR_STORAGE_KEY);
    else window.localStorage.setItem(TOUR_STORAGE_KEY, String(next));
    setStep(next);
  }, []);

  if (!hydrated || !isSignedIn || !isFreelancer) return null;
  if (step === null) return null;
  // En la bienvenida el tour estorbaría: son dos recorridos distintos.
  if (isFocusRoute(pathname)) return null;

  return <PlatformTour step={step} username={username} onStepChange={persist} />;
}

"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ProfileAppearanceValue } from "./AppearancePanel";
import {
  popAppearanceOverride,
  pushAppearanceOverride,
  updateAppearanceOverride,
} from "./appearanceOverrideController";

interface AppearanceScopeProps {
  // Paleta guardada por el DUEÑO del contenido (perfil o caso de estudio), o
  // el borrador en vivo que se está previsualizando; null en cualquier campo
  // = sin override, hereda la marca Hub-Nerds.
  appearance: ProfileAppearanceValue;
  children: ReactNode;
}

// Componente "sin render" (solo efecto) compartido entre ProfileView (perfil
// de un Freelancer) y el visor de proyecto (/[username]/proyecto/[slug]): mientras
// el visitante está DENTRO del perfil/proyecto de un dueño con paleta propia,
// aplica sus overrides de brand/accent/neutral en <html> — el mismo elemento
// donde layout.tsx ya escribe los data-* de la marca del sitio (y donde
// ThemeProvider los reaplica) — para que TODO lo que cuelga de ahí (fondo de
// página, Header, MegaMenu, burbuja de mensajes) re-resuelva con la paleta del
// dueño, no solo el subárbol de contenido.
//
// Puede haber DOS instancias montadas a la vez sobre el mismo perfil: la
// exterior en src/app/[username]/page.tsx (dueña de la paleta GUARDADA,
// envuelve el <Suspense> para que el skeleton ya nazca teñido) y la interior
// en ProfileView (que arranca en la misma paleta guardada y se desvía en
// vivo con el preview de AppearancePanel). En vez de que cada instancia
// mantenga su propio MutationObserver reafirmando SU valor (se pelean: cada
// una revierte a la otra en el siguiente microtask), toda la lógica de
// aplicar/restaurar/reafirmar vive en un módulo compartido con un stack de
// prioridad (ver appearanceOverrideController.ts) — este componente solo
// empuja/actualiza/retira SU entrada en ese stack.
//
// Ya NO hace falta repetir data-theme/data-solid/data-solid-style aquí (ese
// gotcha era solo para wrappers DESCENDIENTES que necesitaban forzar que el
// bloque de tokens semánticos volviera a resolver bajo ellos): al escribir
// directo en <html>, es el MISMO elemento que ya trae data-theme/data-solid
// correctos, así que solo hace falta tocar las 3 claves que sí cambian.
export function AppearanceScope({ appearance, children }: AppearanceScopeProps) {
  const idRef = useRef<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: se re-ejecuta a
  // propósito solo cuando cambian los 3 campos de la paleta, no en cada
  // render (appearance es un objeto nuevo cada vez).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (idRef.current === null) {
      idRef.current = pushAppearanceOverride(appearance);
    } else {
      updateAppearanceOverride(idRef.current, appearance);
    }
  }, [appearance.brand, appearance.accent, appearance.neutral]);

  // Retiro del stack solo al desmontar de verdad (efecto separado, deps
  // vacías): si viviera en el mismo efecto de arriba, cada cambio de paleta
  // haría pop+push (parpadeo innecesario) en vez de un simple update in-place.
  useEffect(() => {
    return () => {
      if (idRef.current !== null) {
        popAppearanceOverride(idRef.current);
        idRef.current = null;
      }
    };
  }, []);

  return <>{children}</>;
}

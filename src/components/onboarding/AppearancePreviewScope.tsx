"use client";

import type { ReactNode } from "react";
import { useStyle, useTheme } from "@once-ui-system/core";
import type { ProfileAppearanceValue } from "@/components/profile/AppearancePanel";

/* Aplica una paleta SOLO a su subárbol, sin tocar el resto de la página.
 *
 * No se usa AppearanceScope aquí a propósito: aquel empuja los overrides a
 * <html> (correcto cuando visitas el perfil de alguien, para que hasta el
 * Header se tiña), pero en la bienvenida eso repinta el asistente entero. Y
 * con los tres valores en null llega a BORRAR los data-* de marca que pone
 * layout.tsx, dejando la paleta violeta por defecto de Once UI.
 *
 * data-theme/data-solid/data-solid-style se repiten aquí por el mismo motivo
 * documentado en DesignerCard y ProfileView: los tokens SEMÁNTICOS se
 * resuelven en el elemento donde hace match `[data-theme=x]`, así que sin
 * repetirlos un data-brand más abajo en el árbol no alcanza a recalcularlos. */
export function AppearancePreviewScope({
  appearance,
  children,
}: {
  appearance: ProfileAppearanceValue;
  children: ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const { solid, solidStyle } = useStyle();

  const hasOverride = Boolean(appearance.brand || appearance.accent || appearance.neutral);
  const attrs: Record<string, string> = {
    ...(appearance.brand ? { "data-brand": appearance.brand } : {}),
    ...(appearance.accent ? { "data-accent": appearance.accent } : {}),
    ...(appearance.neutral ? { "data-neutral": appearance.neutral } : {}),
    ...(hasOverride
      ? {
          "data-theme": resolvedTheme,
          "data-solid": solid,
          "data-solid-style": solidStyle,
        }
      : {}),
  };

  // `display: contents` para no meter una caja extra en el layout.
  return (
    <div style={{ display: "contents" }} {...attrs}>
      {children}
    </div>
  );
}

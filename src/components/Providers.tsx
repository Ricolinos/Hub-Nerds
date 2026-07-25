"use client";

import {
  BorderStyle,
  ChartMode,
  ChartVariant,
  DataThemeProvider,
  IconProvider,
  LayoutProvider,
  NeutralColor,
  ScalingSize,
  Schemes,
  SolidStyle,
  SolidType,
  SurfaceStyle,
  ThemeProvider,
  ToastProvider,
  TransitionStyle,
} from "@once-ui-system/core";
import { ClerkProvider } from "@clerk/nextjs";
import { style, dataStyle } from "../resources";
import { iconLibrary } from "../resources/icons";

// Limpieza one-time de overrides de estilo GLOBAL dejados por el viejo
// StylePanel (Ajustes solía exponerlo completo a cualquier visitante; ahora
// solo expone Tema — ver Header.tsx). El resto de campos (brand/accent/
// neutral/border/solid/solidStyle/surface/transition/scaling) ahora son fijos
// para todo el sitio (once-ui.config.ts) o, para el Freelancer dueño de un
// perfil, viven en BD vía AppearancePanel/updateProfileAppearance — nunca en
// localStorage global.
//
// DEBE correr en el CUERPO del componente (no en un useEffect) y ANTES de
// montar <ThemeProvider>: ThemeProvider lee estas mismas claves de forma
// SÍNCRONA en su primer render (getStoredStyleValues(), fuera de cualquier
// efecto) para sembrar su estado interno `style`. Limpiar localStorage
// después de eso (p. ej. en un efecto de un descendiente como Header) llega
// tarde: el estado de ThemeProvider ya quedó fijado con los valores viejos,
// y su propio useEffect —que por ser ANCESTRO de todo corre DESPUÉS que el
// de cualquier descendiente— vuelve a escribir esos data-* viejos en <html>,
// deshaciendo cualquier corrección hecha río abajo (confirmado en Edge real:
// un useEffect de limpieza en Header sí borraba localStorage y reescribía
// <html>, pero ThemeProvider los pisaba de nuevo justo después).
// Nota: el script `theme-init.js` (pre-hidratación, en <head>) puede seguir
// pintando la marca vieja un instante ANTES de que React monte; no es
// editable desde aquí (vive en public/), así que un visitante con overrides
// viejos puede ver un parpadeo breve una única vez, que se autocorrige en
// cuanto hidrata y no vuelve a ocurrir (localStorage ya queda limpio).
const STYLE_OVERRIDE_KEYS = [
  "data-neutral",
  "data-brand",
  "data-accent",
  "data-solid",
  "data-solid-style",
  "data-border",
  "data-surface",
  "data-transition",
  "data-scaling",
] as const;

function clearLegacyStyleOverrides() {
  if (typeof window === "undefined") return;
  try {
    for (const key of STYLE_OVERRIDE_KEYS) {
      if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
    }
  } catch {
    // localStorage puede no estar disponible (Safari privado, etc.): no es crítico, se ignora.
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  clearLegacyStyleOverrides();

  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
    <LayoutProvider>
      <ThemeProvider
        brand={style.brand as Schemes}
        accent={style.accent as Schemes}
        neutral={style.neutral as NeutralColor}
        solid={style.solid as SolidType}
        solidStyle={style.solidStyle as SolidStyle}
        border={style.border as BorderStyle}
        surface={style.surface as SurfaceStyle}
        transition={style.transition as TransitionStyle}
        scaling={style.scaling as ScalingSize}
      >
        <DataThemeProvider
          variant={dataStyle.variant as ChartVariant}
          mode={dataStyle.mode as ChartMode}
          height={dataStyle.height}
          axis={{
            stroke: dataStyle.axis.stroke,
          }}
          tick={{
            fill: dataStyle.tick.fill,
            fontSize: dataStyle.tick.fontSize,
            line: dataStyle.tick.line,
          }}
        >
          <ToastProvider>
            <IconProvider icons={iconLibrary}>{children}</IconProvider>
          </ToastProvider>
        </DataThemeProvider>
      </ThemeProvider>
    </LayoutProvider>
    </ClerkProvider>
  );
}

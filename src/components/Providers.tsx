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
  Theme,
  ThemeProvider,
  ToastProvider,
  TransitionStyle,
} from "@once-ui-system/core";
import { ClerkProvider } from "@clerk/nextjs";
import { esMX } from "@clerk/localizations";
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
    /* Clerk renderiza UI propia en dos sitios que no controlamos: la ventana
       de reverificación (al poner contraseña desde una cuenta de Google) y el
       panel de seguridad de la cuenta. Sin esto salían en su morado por
       defecto y en inglés, chocando con el resto del sitio.

       Los colores se pasan como `var(...)` de Once UI en vez de hex fijos:
       así siguen la paleta activa —incluida la personalizada de cada perfil—
       sin tener que duplicar valores aquí. */
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      localization={esMX}
      appearance={{
        variables: {
          colorPrimary: "var(--brand-solid-strong)",
          colorPrimaryForeground: "var(--brand-on-solid-strong)",
          colorBackground: "var(--page-background)",
          colorForeground: "var(--neutral-on-background-strong)",
          colorMutedForeground: "var(--neutral-on-background-weak)",
          colorInput: "var(--neutral-alpha-weak)",
          colorInputForeground: "var(--neutral-on-background-strong)",
          colorBorder: "var(--neutral-alpha-medium)",
          colorDanger: "var(--danger-solid-strong)",
          colorSuccess: "var(--success-solid-strong)",
          borderRadius: "0.75rem",
        },
      }}
    >
    <LayoutProvider>
      <ThemeProvider
        // Antes no se pasaba `theme`, así que el provider caía en su default
        // "system" y resolvía según localStorage / prefers-color-scheme. Ahora
        // se le pasa el valor fijo de once-ui.config.ts ("dark"): al no ser
        // "system", ThemeProvider lo trata como modo forzado y descarta lo
        // guardado en localStorage por visitantes que hubieran elegido claro.
        theme={style.theme as Theme}
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

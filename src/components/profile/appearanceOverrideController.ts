"use client";

import type { ProfileAppearanceValue } from "./AppearancePanel";
import { style } from "@/resources";

// Mecanismo compartido, con prioridad, para que varias instancias de
// AppearanceScope (ver AppearanceScope.tsx) puedan convivir sobre el MISMO
// <html> sin pelearse. Casos reales donde coexisten dos scopes:
//   1. src/app/[username]/page.tsx monta un scope EXTERIOR (dueño de la
//      paleta GUARDADA) apenas resuelve la query ligera, envolviendo el
//      <Suspense> — así el fallback (skeleton) ya nace teñido.
//   2. ProfileView monta un scope INTERIOR con la MISMA paleta guardada por
//      defecto, que se desvía en vivo mientras el propio Freelancer previsualiza
//      cambios en AppearancePanel (antes de guardar).
// Con dos MutationObserver independientes (diseño anterior, cada uno
// reafirmando SU valor) el interior gana un instante y el exterior lo
// revierte en el siguiente microtask (o viceversa): thrashing visible.
// Aquí en cambio hay un ÚNICO observer módulo-global y un stack de
// "entradas" (una por scope montado); solo la de MÁS PRIORIDAD (la última
// empujada, típicamente la más interior/específica) se aplica de verdad al
// DOM. Cuando esa entrada se retira (unmount), automáticamente vuelve a
// mandar la siguiente debajo, y si el stack queda vacío se restaura el
// baseline (los data-* que ya traía <html> del layout, marca del sitio)
// capturado la primera vez que hizo falta overridear algo.
type OverrideField = "brand" | "accent" | "neutral";
const FIELDS: OverrideField[] = ["brand", "accent", "neutral"];
const ATTR: Record<OverrideField, string> = {
  brand: "data-brand",
  accent: "data-accent",
  neutral: "data-neutral",
};

// Atributo temporal en <html> mientras se funde el cambio de paleta (ver
// regla CSS acotada a este selector en src/resources/custom.css): se agrega
// justo antes de tocar brand/accent/neutral y se quita solo tras el tiempo
// de la transición, para no dejar `transition` permanente en body/header.
const TRANSITION_ATTR = "data-appearance-transition";
const TRANSITION_MS = 450;

interface StackEntry {
  id: number;
  override: ProfileAppearanceValue;
}

let entries: StackEntry[] = [];
let nextId = 1;
let baseline: Record<OverrideField, string | null> | null = null;
let mutationObserver: MutationObserver | null = null;
let transitionTimeoutId: number | null = null;

function withTransition(root: HTMLElement, mutate: () => void) {
  root.setAttribute(TRANSITION_ATTR, "");
  mutate();
  if (transitionTimeoutId !== null) {
    window.clearTimeout(transitionTimeoutId);
  }
  transitionTimeoutId = window.setTimeout(() => {
    root.removeAttribute(TRANSITION_ATTR);
    transitionTimeoutId = null;
  }, TRANSITION_MS);
}

// Recalcula y aplica el override de mayor prioridad (tope del stack); si el
// stack está vacío, restaura el baseline. Idempotente: si el DOM ya refleja
// lo deseado no toca nada (ni dispara la transición).
function apply() {
  if (typeof document === "undefined" || !baseline) return;
  const root = document.documentElement;
  const top = entries[entries.length - 1];

  const desired: Record<OverrideField, string | null> = top
    ? {
        brand: top.override.brand ?? baseline.brand,
        accent: top.override.accent ?? baseline.accent,
        neutral: top.override.neutral ?? baseline.neutral,
      }
    : baseline;

  const changed = FIELDS.some((field) => root.getAttribute(ATTR[field]) !== desired[field]);
  if (!changed) return;

  withTransition(root, () => {
    FIELDS.forEach((field) => {
      const value = desired[field];
      if (value === null) {
        root.removeAttribute(ATTR[field]);
      } else {
        root.setAttribute(ATTR[field], value);
      }
    });
  });
}

// Reafirma el tope del stack cuando algo externo (p. ej. el propio
// ThemeProvider de Once UI al resolver `theme`/`setStyle`) reescribe
// brand/accent/neutral en <html> — ver comentario largo en AppearanceScope.tsx
// sobre la carrera con ThemeProvider.
function handleExternalMutation() {
  apply();
}

export function pushAppearanceOverride(override: ProfileAppearanceValue): number {
  if (typeof document === "undefined") return -1;
  const root = document.documentElement;

  if (!baseline) {
    // Fallback a la config del sitio cuando el atributo todavía no está en
    // <html>. Si el primer push ocurre antes de que el ThemeProvider de Once
    // UI escriba brand/accent/neutral, leer el DOM devolvía null y este
    // controlador acababa BORRANDO esos atributos al restaurar, dejando la
    // página con la paleta violeta por defecto de Once UI en vez de la marca
    // (se veía como un tinte morado/rojizo en el perfil y en la bienvenida).
    baseline = {
      brand: root.getAttribute(ATTR.brand) ?? style.brand ?? null,
      accent: root.getAttribute(ATTR.accent) ?? style.accent ?? null,
      neutral: root.getAttribute(ATTR.neutral) ?? style.neutral ?? null,
    };
  }
  if (!mutationObserver) {
    mutationObserver = new MutationObserver(handleExternalMutation);
    mutationObserver.observe(root, {
      attributes: true,
      attributeFilter: FIELDS.map((field) => ATTR[field]),
    });
  }

  const id = nextId++;
  entries.push({ id, override });
  apply();
  return id;
}

export function updateAppearanceOverride(id: number, override: ProfileAppearanceValue) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  entry.override = override;
  apply();
}

export function popAppearanceOverride(id: number) {
  entries = entries.filter((e) => e.id !== id);
  apply();

  if (entries.length === 0) {
    mutationObserver?.disconnect();
    mutationObserver = null;
    baseline = null;
  }
}

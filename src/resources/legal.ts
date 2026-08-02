// Fuente de verdad del versionado de los documentos legales. Sin JSX para
// que sea importable desde client y server components por igual (p.ej.
// desde el footer y desde generateMetadata).

export const LEGAL_VERSION = "2026-08-02";
export const LEGAL_UPDATED_LABEL = "2 de agosto de 2026";

export const LEGAL_ROUTES = {
  terms: "/legal/terminos",
  privacy: "/legal/privacidad",
} as const;

export const LEGAL_DOCS = {
  terms: {
    title: "Términos y Condiciones",
    shortTitle: "Términos y Condiciones",
    description: "Reglas de uso de la plataforma: roles, convocatorias, propiedad intelectual y pagos.",
    href: LEGAL_ROUTES.terms,
  },
  privacy: {
    title: "Política de Privacidad",
    shortTitle: "Privacidad",
    description: "Cómo recopilamos, protegemos y usamos tus datos, incluido el uso de Inteligencia Artificial.",
    href: LEGAL_ROUTES.privacy,
  },
} as const;

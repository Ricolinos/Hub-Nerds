// Slugs deben coincidir con los hrefs "/explorar/{slug}" definidos en el MegaMenu (Header.tsx).
export const CATEGORY_SLUGS: Record<string, string> = {
  animacion: "Animación",
  branding: "Branding",
  ilustracion: "Ilustración",
  freelancers: "Freelancers",
};

// Subconjunto usado para filtrar el feed de shouts: excluye "freelancers",
// que no es una categoría sino la sección de perfiles de diseñadores colaboradores.
export const FEED_CATEGORY_SLUGS: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_SLUGS).filter(([slug]) => slug !== "freelancers"),
);

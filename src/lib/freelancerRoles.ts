// Catálogo fijo de roles de especialidad para Freelancers (Fase 4, matriz de
// roles primario/secundario). Dominio: estudio de diseño gráfico y animación
// mexicano (branding, plecas, videobugs, wippers). Módulo compartido
// server/client: NO agregar "use server".
export const FREELANCER_ROLES = [
  "Diseñador UX/UI",
  "Animador 2D",
  "Animador 3D",
  "Ilustrador",
  "Coder",
  "Modelador 3D",
  "Planner",
  "Director de arte",
  "Motion Designer",
  "Editor de Video",
  "Diseñador de Marca",
  "Copywriter",
  "Fotógrafo",
  "Sound Designer",
] as const;

export type FreelancerRole = (typeof FREELANCER_ROLES)[number];

export const MAX_SECONDARY_ROLES = 2;

// Distinto de isFreelancerRole() en src/lib/roles.ts (esa valida el ROL DE
// CUENTA client/freelancer; esta valida una ESPECIALIDAD del catálogo, ej.
// "Diseñador de Marca").
export function isFreelancerSpecialty(value: string): value is FreelancerRole {
  return (FREELANCER_ROLES as readonly string[]).includes(value);
}

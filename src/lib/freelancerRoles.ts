// Catálogo fijo de roles de especialidad para Freelancers (Fase 4, matriz de
// roles primario/secundario). Dominio: producción audiovisual, diseño gráfico,
// entretenimiento, arte y medios digitales. Módulo compartido server/client:
// NO agregar "use server".
//
// Es el "título" con el que el freelancer se presenta (lo que se lee bajo su
// nombre en la tarjeta de Explorar), no una taxonomía interna.
//
// Las categorías existen solo para agrupar visualmente el selector; la
// validación corre contra la lista plana de abajo. Agregar roles es seguro
// (los valores viejos siguen en la lista); QUITAR uno invalidaría perfiles
// que ya lo tengan guardado.
export const FREELANCER_ROLE_GROUPS = [
  {
    label: "Audiovisual y producción",
    roles: [
      "Director",
      "Productor",
      "Asistente de producción",
      "Camarógrafo",
      "Director de fotografía",
      "Editor de Video",
      "Colorista",
      "Guionista",
      "Storyboarder",
      "Locutor",
    ],
  },
  {
    label: "Animación y 3D",
    roles: [
      "Animador 2D",
      "Animador 3D",
      "Motion Designer",
      "Modelador 3D",
      "Rigger",
      "Artista de VFX",
      "Generalista 3D",
    ],
  },
  {
    label: "Diseño gráfico",
    roles: [
      "Diseñador de Marca",
      "Director de arte",
      "Diseñador editorial",
      "Diseñador de empaque",
      "Diseñador web",
      "Diseñador UX/UI",
      "Tipógrafo",
      "Retocador digital",
    ],
  },
  {
    label: "Ilustración y arte",
    roles: [
      "Ilustrador",
      "Concept artist",
      "Diseñador de personajes",
      "Pintor digital",
      "Letrista",
      "Muralista",
      "Escenógrafo",
    ],
  },
  {
    label: "Sonido y música",
    roles: ["Sound Designer", "Compositor", "Ingeniero de audio", "Productor musical"],
  },
  {
    label: "Contenido y medios digitales",
    roles: [
      "Copywriter",
      "Estratega de contenido",
      "Community manager",
      "Creador de contenido",
      "Productor de podcast",
      "Fotógrafo",
    ],
  },
  {
    label: "Tecnología",
    roles: ["Coder", "Desarrollador creativo", "Diseñador de producto", "Planner"],
  },
] as const;

export const FREELANCER_ROLES = FREELANCER_ROLE_GROUPS.flatMap(
  (group) => group.roles,
) as readonly string[];

export type FreelancerRole = string;

export const MAX_SECONDARY_ROLES = 2;

// Distinto de isFreelancerRole() en src/lib/roles.ts (esa valida el ROL DE
// CUENTA client/freelancer; esta valida una ESPECIALIDAD del catálogo, ej.
// "Diseñador de Marca").
export function isFreelancerSpecialty(value: string): boolean {
  return FREELANCER_ROLES.includes(value);
}

/** Opciones planas para `Select` (searchable), con la categoría como pista. */
export function roleSelectOptions(exclude: string[] = []) {
  return FREELANCER_ROLE_GROUPS.flatMap((group) =>
    group.roles
      .filter((role) => !exclude.includes(role))
      .map((role) => ({ value: role, label: role, description: group.label })),
  );
}

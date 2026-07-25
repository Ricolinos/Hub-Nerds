// Verticales raíz + subcategorías para el formulario predictivo de "Nuevo
// proyecto" (Fase 3, panel de client). No hay catálogo real reutilizable en
// Prisma para esto: AssetCategory/AssetTemplate (ver
// src/app/actions/projectAssets.ts) modela los "Activos" DENTRO de un
// CollabProject ya creado (Branding, Logotipo...), no la vertical/rubro que
// el client elige al levantar un proyecto nuevo — dominios distintos. Mapa
// local fijo con las 3 verticales pedidas y ramificaciones razonables del
// dominio (diseño gráfico / motion / ilustración).
// Módulo compartido server/client: NO agregar "use server".
export const PROJECT_VERTICALS = ["DISEÑO", "ANIMACIÓN", "ILUSTRACIÓN"] as const;

export type ProjectVertical = (typeof PROJECT_VERTICALS)[number];

export const PROJECT_SUBCATEGORIES: Record<ProjectVertical, string[]> = {
  DISEÑO: ["Branding", "Logotipo", "Editorial", "Papelería", "Empaque"],
  ANIMACIÓN: [
    "Motion graphics",
    "Videobug",
    "Wiper",
    "Pleca / Lower third",
    "Animación de personajes",
  ],
  ILUSTRACIÓN: ["Ilustración editorial", "Lettering", "Icon set", "Character design", "Storyboard"],
};

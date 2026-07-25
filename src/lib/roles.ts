// Rol de cuenta de la plataforma. "collaborator" fue el nombre legado del
// segundo rol (ahora "freelancer") — persiste como fallback de lectura
// mientras se migran los datos existentes en Postgres y en publicMetadata de
// Clerk (ver plan de rename); no debe usarse como valor de escritura nuevo.
export type Role = "client" | "freelancer";

const LEGACY_FREELANCER_ROLE = "collaborator";

// Para filtros de Prisma (`where: { role: { in: FREELANCER_ROLE_VALUES } }`):
// no se puede llamar una función JS dentro de un `where`, así que se necesita
// la lista de valores válidos en vez del helper booleano de abajo. Prisma
// espera `string[]` mutable (no una tupla readonly) para `in`.
export const FREELANCER_ROLE_VALUES: string[] = ["freelancer", LEGACY_FREELANCER_ROLE];

export function isFreelancerRole(value: string | null | undefined): boolean {
  return value === "freelancer" || value === LEGACY_FREELANCER_ROLE;
}

export function isClientRole(value: string | null | undefined): boolean {
  return value === "client";
}

// Normaliza un valor de rol entrante (Clerk/Postgres) a los valores vigentes,
// mapeando el legado "collaborator" a "freelancer".
export function normalizeRole(value: string | null | undefined): Role | undefined {
  if (value === "client") return "client";
  if (isFreelancerRole(value)) return "freelancer";
  return undefined;
}

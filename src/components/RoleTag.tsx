import { Tag } from "@once-ui-system/core";

// Tag compartido para mostrar el rol de especialidad de un Freelancer
// (matriz de roles primario/secundario). El display tolera cualquier string
// (incluye valores viejos ya guardados en BD antes del catálogo actual de
// src/lib/freelancerRoles.ts).
interface RoleTagProps {
  role: string;
  variant?: "primary" | "secondary";
}

export function RoleTag({ role, variant = "secondary" }: RoleTagProps) {
  if (variant === "primary") {
    // Rol principal: variante "gradient" nativa del Tag (brand → accent vía
    // tokens del tema) + sombra sutil para darle presencia sin CSS propio.
    return (
      <Tag variant="gradient" size="s" prefixIcon="sparkle" shadow="s">
        {role}
      </Tag>
    );
  }

  return (
    <Tag variant="neutral" size="s">
      {role}
    </Tag>
  );
}

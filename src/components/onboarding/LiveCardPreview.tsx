"use client";

import { Column, Text } from "@once-ui-system/core";
import { DesignerFront, type Designer } from "@/components/explore/DesignerDirectory";

interface LiveCardPreviewProps {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  headline: string;
  bio: string;
  cardQuote: string;
  primaryRole: string | null;
  secondaryRoles: string[];
  featuredImageUrl: string | null;
  /** Texto de apoyo bajo la tarjeta; cambia según el paso. */
  caption?: string;
}

/* Preview en vivo de la tarjeta Designerd durante la bienvenida.
 *
 * Renderiza DesignerFront —el MISMO componente que se ve en Explorar— en vez
 * de una réplica: así lo que el usuario ve mientras escribe es literalmente
 * lo que va a quedar publicado, y el preview no se desincroniza cuando la
 * tarjeta real cambie. */
export function LiveCardPreview({
  name,
  username,
  avatarUrl,
  headline,
  bio,
  cardQuote,
  primaryRole,
  secondaryRoles,
  featuredImageUrl,
  caption,
}: LiveCardPreviewProps) {
  const designer: Designer = {
    id: "preview",
    name: name || username || "Tu nombre",
    username,
    specialty: primaryRole ?? "",
    role: primaryRole ?? "",
    avatar: avatarUrl ?? "",
    projectHref: "",
    projectTitle: "",
    featuredImageUrl: featuredImageUrl || null,
    cardQuote: cardQuote || null,
    headline: headline || primaryRole || "",
    bio: bio || null,
    primaryRole,
    secondaryRoles,
    // La bienvenida no personaliza la paleta: hereda la marca Hub-Nerds.
    profileBrand: null,
    profileAccent: null,
    profileNeutral: null,
    profileBorder: null,
  };

  return (
    <Column fillWidth gap="12" horizontal="center">
      {/* aspectRatio 3/4 explícito: en Explorar la altura de la tarjeta la fija
          FlipFx vía la clase .flipCard; aquí se renderiza la cara suelta, sin
          FlipFx, así que sin esto colapsa a altura 0. */}
      <Column fillWidth maxWidth={24} aspectRatio="3 / 4" radius="l" overflow="hidden">
        {/* seed fijo: en Explorar aleatoriza detalles decorativos por tarjeta;
            aquí un valor estable evita que el preview "salte" en cada tecla. */}
        <DesignerFront designer={designer} seed={7} />
      </Column>
      {caption && (
        <Text variant="body-default-xs" onBackground="neutral-weak" align="center">
          {caption}
        </Text>
      )}
    </Column>
  );
}

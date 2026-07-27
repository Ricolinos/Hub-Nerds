"use client";

import type { ReactNode } from "react";
import { Column, Row, Text } from "@once-ui-system/core";
import { FlipFx } from "@once-ui-system/core";
import {
  DesignerBack,
  DesignerFront,
  type Designer,
} from "@/components/explore/DesignerDirectory";

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
  /** Cara visible. El cambio se anima con FlipFx. */
  face: "front" | "back";
  /** Controles sutiles superpuestos abajo de la tarjeta (subir/editar foto). */
  overlay?: ReactNode;
  caption?: string;
}

/* Preview en vivo de la tarjeta Designerd durante la bienvenida.
 *
 * Renderiza DesignerFront/DesignerBack —los MISMOS componentes que se ven en
 * Explorar— en vez de una réplica: lo que el usuario ve mientras escribe es
 * literalmente lo que va a quedar publicado, y el preview no se desincroniza
 * cuando la tarjeta real cambie.
 *
 * El volteo es CONTROLADO (`flipped` + `disableClickFlip`): aquí la tarjeta
 * se da vuelta porque el asistente avanza de paso, no porque el usuario le dé
 * clic — el clic se reserva para cargar la imagen. */
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
  face,
  overlay,
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
    // La paleta la aplica AppearanceScope desde el asistente, no la tarjeta.
    profileBrand: null,
    profileAccent: null,
    profileNeutral: null,
    profileBorder: null,
  };

  return (
    <Column fillWidth gap="12" horizontal="center">
      <Column fillWidth maxWidth={22} gap="12">
        {/* aspectRatio 3/4 explícito: en Explorar la altura la fija FlipFx vía
            la clase .flipCard; aquí se monta suelto, así que sin esto colapsa. */}
        <Column fillWidth aspectRatio="3 / 4" radius="l" overflow="hidden">
          <FlipFx
            fillWidth
            fillHeight
            radius="l"
            flipped={face === "back"}
            disableClickFlip
            timing={600}
            front={<DesignerFront designer={designer} seed={7} />}
            back={
              <DesignerBack
                designer={designer}
                seed={7}
                matrixActive={face === "back"}
                onFlipBack={() => {}}
              />
            }
          />
        </Column>

        {overlay && (
          <Row fillWidth horizontal="center" gap="8" wrap>
            {overlay}
          </Row>
        )}
      </Column>

      {caption && (
        <Text variant="body-default-xs" onBackground="neutral-weak" align="center">
          {caption}
        </Text>
      )}
    </Column>
  );
}

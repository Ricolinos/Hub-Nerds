"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Column, Row, Text } from "@once-ui-system/core";
import { FlipFx } from "@once-ui-system/core";
import {
  DesignerBack,
  DesignerFront,
  type Designer,
} from "@/components/explore/DesignerDirectory";
// Se reutiliza la MISMA clase que usa el grid de Explorar en vez de duplicar
// la regla: una sola fuente de verdad para la proporción de la tarjeta.
import cardStyles from "@/components/explore/DesignerDirectory.module.scss";

const FLIP_MS = 600;

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
  /* El MatrixFx del reverso dibuja su canvas midiendo el contenedor UNA sola
     vez. Si esa medición cae a mitad del giro 3D de FlipFx, la tarjeta está
     escorzada y el canvas nace angosto (medido: 284px dentro de 352, justo
     352·cos(36°)), dejando una franja sin patrón a la derecha que ya no se
     corrige sola. Se espera a que la transición termine y se remonta el
     reverso con una `key`, de modo que mida con la tarjeta ya plana — y de
     paso la onda se revela después del giro, que se ve mejor. */
  const [settledFace, setSettledFace] = useState(face);
  useEffect(() => {
    const timer = setTimeout(() => setSettledFace(face), FLIP_MS + 80);
    return () => clearTimeout(timer);
  }, [face]);

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
        {/* `.flipCard` es imprescindible, no decorativo: FlipFx fija la altura
            del nodo por JS y ese valor inline NO vuelve a seguir al contenedor
            al redimensionar la ventana — se queda clavado en el alto de la
            ventana más pequeña que se haya visto, y la tarjeta acaba achatada
            dentro de su propia caja. La clase anula ese inline con
            `height: auto !important` y deja mandar al aspect-ratio en CSS,
            que sí responde a cualquier resize. */}
        <Column fillWidth aspectRatio="3 / 4" radius="l" overflow="hidden">
          <FlipFx
            className={cardStyles.flipCard}
            fillWidth
            radius="l"
            flipped={face === "back"}
            disableClickFlip
            timing={FLIP_MS}
            front={<DesignerFront designer={designer} seed={7} />}
            back={
              <DesignerBack
                key={`back-${settledFace}`}
                designer={designer}
                seed={7}
                matrixActive={settledFace === "back"}
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

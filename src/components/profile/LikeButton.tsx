"use client";

import { Button, Row, Text } from "@once-ui-system/core";
import { useLikeToggle } from "@/components/profile/useLikeToggle";

interface LikeButtonProps {
  pieceId: string;
  initialLikes: number;
  initialLiked: boolean;
  /** El dueño de la pieza no puede darse like — se muestra solo el contador. */
  isOwner: boolean;
  /** Resuelto en el servidor (page.tsx via auth()): evita el parpadeo de
   *  useUser()/isLoaded que tendría resolver esto en el cliente. */
  isSignedIn: boolean;
}

// Toggle con UI optimista: el corazón cambia al instante, se revierte (+
// toast) si la server action falla. El dueño ve solo el contador; un
// visitante sin sesión ve el mismo corazón pero como link a /sign-in (mismo
// patrón que ContestApplicationPanel/convocatorias: Button href="/sign-in",
// sin redirect_url — no hay precedente de esa prop en el proyecto).
export function LikeButton({ pieceId, initialLikes, initialLiked, isOwner, isSignedIn }: LikeButtonProps) {
  const { liked, likes, isPending, toggle } = useLikeToggle({ pieceId, initialLikes, initialLiked });

  if (isOwner) {
    return (
      <Row gap="8" vertical="center">
        <Text variant="label-default-m" onBackground="neutral-weak">
          ♥ {likes}
        </Text>
      </Row>
    );
  }

  if (!isSignedIn) {
    return (
      <Button href="/sign-in" variant="tertiary" size="s" prefixIcon="heart">
        {likes}
      </Button>
    );
  }

  return (
    <Button
      onClick={toggle}
      disabled={isPending}
      variant={liked ? "primary" : "tertiary"}
      size="s"
      prefixIcon={liked ? "heartSolid" : "heart"}
    >
      {likes}
    </Button>
  );
}

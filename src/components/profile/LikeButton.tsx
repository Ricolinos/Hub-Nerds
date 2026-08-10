"use client";

import { useState, useTransition } from "react";
import { Button, Row, Text, useToast } from "@once-ui-system/core";
import { toggleLike } from "@/app/actions/likes";

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
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

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

  const handleClick = () => {
    const prevLiked = liked;
    const prevLikes = likes;
    // Optimista primero: el usuario ve el cambio antes de que la red
    // responda. Se revierte en el catch/error de abajo si hace falta.
    setLiked(!prevLiked);
    setLikes(prevLiked ? prevLikes - 1 : prevLikes + 1);

    startTransition(async () => {
      const result = await toggleLike(pieceId);
      if (!result.ok) {
        setLiked(prevLiked);
        setLikes(prevLikes);
        addToast({ variant: "danger", message: result.error });
        return;
      }
      // Confirma con los valores reales del servidor (por si otro visitante
      // dio like al mismo tiempo, el contador no debe quedar "adivinado").
      setLiked(result.liked);
      setLikes(result.likes);
    });
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant={liked ? "primary" : "tertiary"}
      size="s"
      prefixIcon={liked ? "heartSolid" : "heart"}
    >
      {likes}
    </Button>
  );
}

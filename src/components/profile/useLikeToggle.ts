"use client";

import { useState, useTransition } from "react";
import { useToast } from "@once-ui-system/core";
import { toggleLike } from "@/app/actions/likes";

interface UseLikeToggleProps {
  pieceId: string;
  initialLikes: number;
  initialLiked: boolean;
}

// Mecánica de toggle compartida (UI optimista + revert/toast en error) entre
// LikeButton (case study) y los controles de like de HomeShowcase/ExploreFeed
// — mismo comportamiento en las tres superficies, una sola implementación.
export function useLikeToggle({ pieceId, initialLikes, initialLiked }: UseLikeToggleProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const toggle = () => {
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

  return { liked, likes, isPending, toggle };
}

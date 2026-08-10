"use client";

import { useEffect, useRef } from "react";

/**
 * Dispara UNA vez el registro de vista de un PortfolioPiece (POST a
 * /api/pieces/[id]/view — dedupe por cookie 1h, dueño excluido, ver ese
 * route handler). No renderiza nada: es puramente el disparador.
 *
 * El guard por ref (no solo el array de deps vacío) es necesario porque
 * React StrictMode (dev) monta/desmonta/vuelve a montar cada componente una
 * vez a propósito, para aflorar efectos no idempotentes — sin el guard, cada
 * carga en desarrollo contaría 2 vistas en vez de 1.
 */
export function RegisterView({ pieceId }: { pieceId: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch(`/api/pieces/${pieceId}/view`, { method: "POST" }).catch(() => {
      // Fire-and-forget: una vista no contada no debe interrumpir ni
      // notificarse al visitante, igual que presenceHeartbeat().
    });
  }, [pieceId]);

  return null;
}

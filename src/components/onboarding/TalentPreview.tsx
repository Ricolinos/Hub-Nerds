"use client";

import { Column, Text } from "@once-ui-system/core";
import { TalentCoverflow } from "@/components/originkit/TalentCoverflow";

export interface TalentCard {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  featuredImageUrl: string | null;
  headline: string | null;
  primaryRole: string | null;
}

/* Vitrina de talento real durante la bienvenida del client.
 *
 * El freelancer recibe como recompensa su propia tarjeta creciendo mientras
 * escribe. Un client no tiene tarjeta que mirar: lo que le importa es que del
 * otro lado haya gente. Por eso aquí se muestran perfiles REALES de la
 * plataforma (los mismos DesignerFront de Explorar), no ilustraciones. */
export function TalentPreview({ talent }: { talent: TalentCard[] }) {
  if (talent.length === 0) return null;

  return (
    <Column fillWidth gap="12">
      {/* Coverflow 3D en vez de una cuadrícula: con 4 tarjetas en rejilla cada
          una quedaba diminuta y el portafolio —que es justo lo que el client
          vino a ver— no se apreciaba. Aquí la activa se ve a buen tamaño y las
          vecinas insinúan que hay más. */}
      <TalentCoverflow talent={talent.slice(0, 8)} />
      <Text variant="body-default-xs" onBackground="neutral-weak" align="center">
        Parte del talento que ya está aquí
      </Text>
    </Column>
  );
}

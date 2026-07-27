"use client";

import { Column, Grid, Text } from "@once-ui-system/core";
import { DesignerFront, type Designer } from "@/components/explore/DesignerDirectory";

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
      <Grid columns={2} s={{ columns: 2 }} gap="12" fillWidth>
        {talent.slice(0, 4).map((person) => {
          const designer: Designer = {
            id: person.id,
            name: person.name,
            username: person.username,
            specialty: person.primaryRole ?? "",
            role: person.primaryRole ?? "",
            avatar: person.avatar ?? "",
            projectHref: "",
            projectTitle: "",
            featuredImageUrl: person.featuredImageUrl,
            cardQuote: null,
            headline: person.headline ?? person.primaryRole ?? "",
            bio: null,
            primaryRole: person.primaryRole,
            secondaryRoles: [],
            profileBrand: null,
            profileAccent: null,
            profileNeutral: null,
            profileBorder: null,
          };
          return (
            <Column key={person.id} fillWidth aspectRatio="3 / 4" radius="l" overflow="hidden">
              <DesignerFront designer={designer} seed={person.id.length} />
            </Column>
          );
        })}
      </Grid>
      <Text variant="body-default-xs" onBackground="neutral-weak" align="center">
        Parte del talento que ya está aquí
      </Text>
    </Column>
  );
}

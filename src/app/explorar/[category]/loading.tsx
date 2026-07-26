import { Column, Grid, Skeleton } from "@once-ui-system/core";

const CARD_KEYS = ["card-1", "card-2", "card-3", "card-4", "card-5", "card-6"];

// /explorar/[category] bifurca en el server: category === "freelancers" ->
// DesignerDirectory (grid 3/4 de tarjetas flip), cualquier otra categoría ->
// ExploreFeed (mismo listado 2 col que /explorar). loading.js no recibe
// params (ver docs.once-ui / Next.js file conventions), así que no hay forma
// de elegir la rama correcta en build; se replica la de DesignerDirectory
// por ser la más distinta visualmente (heading + grid 3 col de tarjetas con
// aspect-ratio fijo), a costa de un salto de layout en las categorías que
// caen en ExploreFeed (branding, motion, etc. -> ver /explorar/loading.tsx).
export default function ExplorarCategoryLoading() {
  return (
    <Column fillWidth gap="24">
      <Column fillWidth gap="8">
        <Skeleton shape="line" width="m" height="l" />
        <Skeleton shape="line" width="l" height="xs" />
      </Column>

      <Grid columns={3} m={{ columns: 2 }} s={{ columns: 1 }} gap="24" fillWidth>
        {CARD_KEYS.map((key) => (
          <Column key={key} radius="l" overflow="hidden" style={{ aspectRatio: "3 / 4" }} fillWidth>
            <Skeleton shape="block" fillWidth fillHeight />
          </Column>
        ))}
      </Grid>
    </Column>
  );
}

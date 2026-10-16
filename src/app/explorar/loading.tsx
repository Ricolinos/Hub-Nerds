import { Column, Grid, Row, Skeleton } from "@once-ui-system/core";

const CARD_KEYS = ["card-1", "card-2", "card-3", "card-4"];

// Replica ShoutCard de ExploreFeed dentro del slot {children} del layout de
// /explorar (Sidebar y buscador ya están montados por explorar/layout.tsx,
// no se repiten aquí): mismo Grid columns=2 s={{columns:1}} gap 24, cada
// tarjeta con su cabecera (avatar m + nombre + tag), descripción, imagen
// 16/9 y pie (botón de like + link).
export default function ExplorarLoading() {
  return (
    <Grid columns="2" s={{ columns: 1 }} gap="24" fillWidth>
      {CARD_KEYS.map((key) => (
        <Column
          key={key}
          radius="l"
          border="neutral-alpha-weak"
          background="neutral-alpha-weak"
          fillWidth
        >
          <Row
            fillWidth
            horizontal="between"
            vertical="center"
            paddingX="20"
            paddingY="16"
            gap="12"
          >
            <Row gap="12" vertical="center">
              <Skeleton shape="circle" size="m" />
              <Skeleton shape="line" width="33%" size="xs" />
            </Row>
            <Skeleton shape="line" width="25%" size="xs" />
          </Row>

          <Column fillWidth paddingX="20" gap="16">
            <Skeleton shape="line" width="75%" size="xs" />
            <Column fillWidth style={{ aspectRatio: "16 / 9" }}>
              <Skeleton shape="block" fillWidth fillHeight />
            </Column>
          </Column>

          <Row fillWidth horizontal="between" vertical="center" paddingX="20" paddingY="16">
            <Skeleton shape="line" width="25%" size="s" />
            <Skeleton shape="line" width="25%" size="xs" />
          </Row>
        </Column>
      ))}
    </Grid>
  );
}

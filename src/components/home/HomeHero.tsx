"use client";

import {
  Background,
  Button,
  Column,
  Heading,
  Media,
  RevealFx,
  Row,
  Scroller,
  ShineFx,
  Text,
  useStyle,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";

interface HeroCategory {
  label: string;
  href: string;
  icon: IconName;
}

// Mismos iconos que Header.tsx usa para estas categorías en el MegaMenu
// "Explorar" — se mantiene consistencia entre el hero y la navegación.
const HERO_CATEGORIES: HeroCategory[] = [
  { label: "Animación", href: "/explorar/animacion", icon: "film" },
  { label: "Branding", href: "/explorar/branding", icon: "sparkles" },
  { label: "Ilustración", href: "/explorar/ilustracion", icon: "paintBrush" },
  { label: "Designerds", href: "/explorar/designerds", icon: "userGroup" },
];

export function HomeHero() {
  // El hero SIEMPRE se ve oscuro sobre la foto (contraste fijo, no depende
  // del tema del visitante): se fuerza data-theme="dark" en vez de leer
  // resolvedTheme. Solo se repiten solid/solidStyle (no cambian con el
  // tema) porque los tokens semánticos que SÍ pintan Heading/Text/Icon se
  // resuelven con selectores compuestos [data-theme=x][data-solid=y] — el
  // mismo mecanismo que DesignerCard en DesignerDirectory.tsx.
  const { solid, solidStyle } = useStyle();

  return (
    <Column
      fillWidth
      overflow="hidden"
      radius="xl"
      border="neutral-alpha-weak"
      horizontal="center"
      align="center"
      paddingY="64"
      paddingX="24"
      gap="24"
    >
      {/* Foto de fondo full-bleed. `fill` aquí es el prop propio de Media
          (recorta el <Image> al contenedor); fillWidth/fillHeight explícitos
          son los que hacen que el wrapper de Media cubra todo el Column
          (el shorthand genérico `fill` no aplica: Media ya usa ese nombre
          para su propio comportamiento). */}
      <Media
        src="/images/home/hero-workspace.jpg"
        alt=""
        fill
        objectFit="cover"
        position="absolute"
        top="0"
        left="0"
        fillWidth
        fillHeight
        pointerEvents="none"
      />
      {/* Overlay oscuro FIJO (no token semántico): es una foto, no un color
          de marca — debe verse igual en tema claro u oscuro del sitio para
          mantener el contraste del texto sobre ella. */}
      <Column
        position="absolute"
        top="0"
        left="0"
        fill
        pointerEvents="none"
        style={{ backgroundColor: "rgba(8,12,18,0.55)" }}
      />
      <Background
        position="absolute"
        top="0"
        left="0"
        fill
        pointerEvents="none"
        gradient={{
          display: true,
          opacity: 50,
          x: 50,
          y: 0,
          width: 180,
          height: 90,
          tilt: 0,
          colorStart: "brand-alpha-medium",
          colorEnd: "static-transparent",
        }}
      />
      {/* `display: contents` saca el wrapper del box model (no mete una caja
          de layout extra) pero deja cascadear data-theme/data-solid/
          data-solid-style a los descendientes vía herencia de CSS normal. */}
      <div style={{ display: "contents" }} data-theme="dark" data-solid={solid} data-solid-style={solidStyle}>
        <RevealFx translateY="12" fillWidth horizontal="center" zIndex={1}>
          <Column maxWidth={36} horizontal="center" align="center" gap="16">
            <Text variant="label-default-s" onBackground="neutral-weak">
              Guía rápida
            </Text>
            <Heading variant="display-strong-l" align="center" wrap="balance" style={{ maxWidth: "40rem" }}>
              Talento creativo, sin{" "}
              <ShineFx variant="display-strong-l" onBackground="brand-strong">
                el ruido
              </ShineFx>
            </Heading>
            <Text
              variant="body-default-l"
              onBackground="neutral-weak"
              align="center"
              wrap="balance"
              style={{ maxWidth: "34rem" }}
            >
              Hub-Nerds conecta diseñadores, animadores e ilustradores con los proyectos que
              necesitan su trabajo — sin spec-work, sin fricción.
            </Text>
            <Row gap="12" wrap horizontal="center">
              <Button href="/explorar/designerds" variant="primary" size="m" arrowIcon>
                Explorar Designerds
              </Button>
              <Button href="/convocatorias" variant="secondary" size="m">
                Ver convocatorias
              </Button>
            </Row>
          </Column>
        </RevealFx>
        <Scroller fillWidth gap="12" direction="row" zIndex={1}>
          {HERO_CATEGORIES.map((category) => (
            <Button
              key={category.href}
              href={category.href}
              variant="secondary"
              size="s"
              rounded
              prefixIcon={category.icon}
            >
              {category.label}
            </Button>
          ))}
        </Scroller>
      </div>
    </Column>
  );
}

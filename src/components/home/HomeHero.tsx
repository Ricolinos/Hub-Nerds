"use client";

import Image from "next/image";
import {
  Background,
  Button,
  Column,
  Fade,
  Heading,
  Particle,
  RevealFx,
  Row,
  Scroller,
  ShineFx,
  Text,
  useStyle,
} from "@once-ui-system/core";
import type { IconName } from "@/resources/icons";
import { HeroParallax, type HeroPiece } from "./HeroParallax";

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
  { label: "Freelancers", href: "/explorar/freelancers", icon: "userGroup" },
];

export function HomeHero({ pieces = [] }: { pieces?: HeroPiece[] }) {
  // El hero SIEMPRE se ve oscuro sobre la foto (contraste fijo, no depende
  // del tema del visitante): se fuerza data-theme="dark" en vez de leer
  // resolvedTheme. Solo se repiten solid/solidStyle (no cambian con el
  // tema) porque los tokens semánticos que SÍ pintan Heading/Text/Icon se
  // resuelven con selectores compuestos [data-theme=x][data-solid=y] — el
  // mismo mecanismo que DesignerCard en DesignerDirectory.tsx.
  const { solid, solidStyle } = useStyle();

  return (
    // La foto arranca en y=0, POR DETRÁS del header, en vez de justo debajo.
    // El margen negativo compensa los 48px que el header ocupa en el flujo
    // (sticky en desktop) o que ocupa su espaciador (fixed en móvil, ver
    // layout.tsx), de modo que el hero sigue terminando exactamente al final
    // del viewport (de ahí 100dvh y no calc(100dvh - 48px)).
    // Funciona sin tocar el Header porque su fondo al tope de la página es un
    // degradado brand -> transparente (HeaderBackdrop en Header.tsx): la parte
    // opaca de arriba mantiene legible el menú y, al desvanecerse, deja asomar
    // la foto en lugar de cortarla con una línea dura.
    // Sin radius/border: el hero debe leerse como el fondo de la página, no
    // como una tarjeta flotando sobre él. `vertical="end"` ancla el bloque
    // de texto abajo (ver análisis de zonas de la foto más abajo).
    <Column
      fillWidth
      height="100dvh"
      overflow="hidden"
      vertical="end"
      style={{ marginTop: "-48px" }}
    >
      {/* Fondo full-bleed: la foto está separada en 4 capas que se desplazan
          a distinta velocidad con el cursor (parallax), con una quinta capa
          que revela una versión alterna de los paneles bajo un foco que
          sigue al puntero. Ver HeroParallax.tsx para los detalles de
          profundidad, máscara y degradación en táctil/reduced-motion.
          El recorte usa objectPosition 46% 42% (mismo criterio que la
          versión de imagen única que reemplaza): en móvil el recorte de
          "cover" es horizontal y se ve el 100% del alto, así que el eje Y
          casi no importa; en desktop pasa lo contrario. El 46% deja el
          monitor con el logo dentro de la franja visible en móvil. */}
      <HeroParallax pieces={pieces} />
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
      {/* Partículas flotantes sobre la foto: refuerzan la idea del titular
          ("el espacio creativo no tiene límites") con profundidad y una
          interacción sutil — con interactive + mode="repel" se apartan del
          cursor. Va DESPUÉS de la foto y el gradiente (para verse encima de
          ellos) pero ANTES del scrim y del Fade, para que la disolución
          inferior del hero también se las lleve y no queden flotando sobre
          el color plano de la página.
          El `display: contents` con data-theme="dark" es el mismo mecanismo
          que el wrapper del contenido de más abajo: `color` de Particle es un
          token semántico ("brand-on-background-weak" por defecto), y sobre
          una foto siempre oscura necesita resolverse en su variante clara sin
          importar el tema del visitante. */}
      <div style={{ display: "contents" }} data-theme="dark" data-solid={solid} data-solid-style={solidStyle}>
        <Particle
          position="absolute"
          top="0"
          left="0"
          fill
          pointerEvents="none"
          density={60}
          size="2"
          speed={0.2}
          opacity={40}
          interactive
          mode="repel"
          intensity={24}
        />
      </div>
      {/* Scrim local FIJO (mismo criterio que el overlay de arriba): refuerza
          el contraste justo detrás del bloque de texto, que vive en la mitad
          inferior de la foto (el escritorio, la zona más oscura y uniforme
          de la imagen). Sin esto, el Fade de abajo (que en tema claro
          termina en blanco) podría dejar el texto sin suficiente contraste
          en el tramo donde ya empieza a aclarar. */}
      <Column
        position="absolute"
        bottom="0"
        left="0"
        fillWidth
        height="60%"
        pointerEvents="none"
        style={{ background: "linear-gradient(to top, rgba(4,8,14,0.8), rgba(4,8,14,0) 100%)" }}
      />
      {/* Fade edge-strip (uso previsto de Fade: franja de borde, no wrapper
          de contenido): disuelve la foto exactamente en el color de fondo de
          la página (`base="page"`) para que el hero fluya hacia HomeAbout
          sin un corte duro de "tarjeta". to="top" es la dirección correcta
          aquí: produce el color sólido en el borde inferior de la franja
          (pegado al final del hero) y transparente en su borde superior
          (verificado visualmente) — lo inverso de `to="bottom"`, pensado
          para franjas ancladas arriba (ver Sidebar4.tsx en los ejemplos).
          Altura acotada a 18% (antes 32%): con 32% la franja opaca alcanzaba
          la fila de chips incluso con el padding inferior del bloque de
          texto, dejándola sobre blanco puro en tema claro (bug real
          reportado en revisión). Con 18% el tramo realmente opaco queda
          confinado a los últimos ~25-30px del hero, muy por debajo de todo
          el bloque de texto (ver paddingBottom más abajo). */}
      <Fade to="top" base="page" position="absolute" bottom="0" left="0" fillWidth height="18%" />
      {/* `display: contents` saca el wrapper del box model (no mete una caja
          de layout extra) pero deja cascadear data-theme/data-solid/
          data-solid-style a los descendientes vía herencia de CSS normal. */}
      <div style={{ display: "contents" }} data-theme="dark" data-solid={solid} data-solid-style={solidStyle}>
        {/* Wrapper edge-to-edge que centra el bloque de texto con el mismo
            ancho máximo que el resto de la página (maxWidth="l", ver
            page.tsx). Sin este wrapper el bloque de abajo (antes fillWidth
            horizontal="start" sin tope) quedaba pegado al borde izquierdo
            del VIEWPORT completo en pantallas 4K, con el resto del texto
            perdido en una esquina. A ≤1440px maxWidth="l" no restringe nada
            (la página ya cabe en ese ancho), así que el resultado es idéntico
            al de antes; solo cambia en monitores más anchos. */}
        <Column zIndex={1} fillWidth horizontal="center">
          <Column
            fillWidth
            maxWidth="l"
            horizontal="start"
            gap="24"
            paddingX="24"
            // 104 (antes 40): deja la fila de chips ~100px por encima del borde
            // inferior real del hero. Con eso libra dos problemas reportados
            // en revisión: (a) el tramo del Fade que se vuelve opaco (ahora
            // acotado al 18% de altura) y (b) el badge/indicador flotante fijo
            // en la esquina inferior-izquierda del viewport (en dev, el de
            // Next.js; en producción con sesión iniciada, el FloatingChatBubble
            // si el usuario lo arrastró a ese costado) — con este padding la
            // fila de chips termina ~46px por encima de ese badge en vez de
            // superponerse.
            paddingBottom="104"
          >
            <RevealFx translateY="12" fillWidth horizontal="start">
              <Column maxWidth={34} gap="16">
                <Row gap="8" vertical="center">
                  <Image src="/trademark/icon-dark.svg" alt="" width={22} height={22} />
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Guía rápida
                  </Text>
                </Row>
                <Heading variant="display-strong-l" wrap="balance" style={{ maxWidth: "40rem" }}>
                  El espacio creativo{" "}
                  {/* ShineFx pinta el texto con -webkit-text-fill-color:
                      transparent + background-clip:text: fuera del barrido de
                      brillo, el 80% del texto queda a `baseOpacity` (default
                      0.3 = 30%), por eso se leía "apagado"/deshabilitado en vez
                      de como énfasis. Con 0.85 el texto en reposo casi iguala
                      al resto del headline y el barrido sigue siendo visible
                      como un acento sutil en vez de ser el único momento en que
                      la palabra se lee a color completo. */}
                  <ShineFx variant="display-strong-l" onBackground="brand-strong" baseOpacity={0.85}>
                    no tiene límites
                  </ShineFx>
                </Heading>
                <Text
                  variant="body-default-l"
                  onBackground="neutral-weak"
                  wrap="balance"
                  style={{ maxWidth: "34rem" }}
                >
                  Un lugar donde diseñadores, animadores e ilustradores muestran su trabajo,
                  encuentran proyectos reales y colaboran sin fricción.
                </Text>
                <Row gap="12" wrap>
                  <Button href="/explorar/freelancers" variant="primary" size="m" arrowIcon>
                    Explorar Freelancers
                  </Button>
                  <Button href="/convocatorias" variant="secondary" size="m">
                    Ver convocatorias
                  </Button>
                </Row>
              </Column>
            </RevealFx>
            <Scroller fillWidth gap="12" direction="row">
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
          </Column>
        </Column>
      </div>
    </Column>
  );
}

"use client";

import {
  Background,
  Button,
  Column,
  Fade,
  Heading,
  Particle,
  ProgressBar,
  RevealFx,
  Row,
  Scroller,
  ShineFx,
  Text,
  useReducedMotion,
  useStyle,
} from "@once-ui-system/core";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CosmicOrb } from "@/components/originkit/CosmicOrb";
import type { IconName } from "@/resources/icons";
import {
  HERO_DEPTH_VAR_X,
  HERO_DEPTH_VAR_Y,
  HeroParallax,
  type HeroPiece,
  useHeroSceneLoaded,
} from "./HeroParallax";
import { PORTRAIT_ASPECT, portraitSceneBottom } from "./heroPanelGeometry";

/**
 * En vertical la escena deja de llenar el alto: se ajusta al ancho y queda
 * como una banda arriba (ver `computeSceneFraming`). El hero, en cambio,
 * seguía midiendo 100dvh con el texto anclado abajo, así que cuanto MÁS ALTA
 * la pantalla, más se separaban la escena y el texto — medido: el texto
 * arrancaba al 52% del viewport a 844px de alto, pero al 59% a 1180px, con un
 * hueco muerto de ~400px en medio. Es el "se baja demasiado" reportado.
 *
 * Este hook devuelve, solo en vertical, dónde TERMINA la banda de la escena,
 * para que el texto se coloque justo debajo y el hero se ajuste a su
 * contenido en vez de estirarse al viewport.
 *
 * No hay dependencia circular pese a que el alto del hero pase a depender del
 * contenido: en vertical puro el encuadre depende ÚNICAMENTE del ancho
 * (`scale = fit-width` y `offsetY` fijo al despeje del header), así que
 * `sceneBottom` no cambia aunque cambie el alto. Para garantizar que el modo
 * no se salga de "vertical puro" al encogerse el hero, se impone un
 * `minHeight` que mantiene el aspect ratio por debajo del umbral.
 */
function useHeroPortrait(ref: React.RefObject<HTMLDivElement | null>) {
  const [portrait, setPortrait] = useState(false);
  const [width, setWidth] = useState(0);

  // El modo se decide con matchMedia y no leyendo window.innerWidth una sola
  // vez: en móvil el viewport de DISEÑO no está asentado en el primer render
  // (medido: 731px antes de aplicarse `width=device-width`, 360 después) y
  // ninguna lectura puntual lo corrige después.
  useEffect(() => {
    const mq = window.matchMedia(`(max-aspect-ratio: ${Math.round(PORTRAIT_ASPECT * 100)}/100)`);
    const update = () => setPortrait(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // El ancho se mide del PROPIO hero (no de window), que es exactamente la
  // caja con la que HeroParallax calcula el encuadre de las capas: así el
  // texto no puede quedar desalineado respecto a la escena.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return {
    portrait,
    sceneBottom: width > 0 ? Math.round(portraitSceneBottom(width)) : 0,
    // Mantiene el aspect por debajo del umbral aunque el hero se acorte al
    // pasar a medir según su contenido, para que el encuadre no entre en la
    // banda de interpolación.
    minHeight: width > 0 ? Math.ceil(width / PORTRAIT_ASPECT) : 0,
  };
}

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

/** Fundido normal; recortado bajo `prefers-reduced-motion` (sigue siendo un
 *  cambio de opacidad, no una animación de movimiento, así que acortarlo en
 *  vez de eliminarlo respeta la preferencia sin contradecir "debe fundirse,
 *  no desaparecer de golpe"). */
const LOAD_FADE_MS = { full: 600, reduced: 200 } as const;

/** Alto de la franja de disolución bajo la banda de la escena en vertical.
 *  En horizontal la franja usa un 18% del hero; aquí conviene un valor fijo
 *  porque el alto del hero ya no es el del viewport. */
const PORTRAIT_FADE_PX = 120;

/** Píxeles que se desplaza el orbe al recorrer el cursor el hero de un borde
 *  al otro. Misma escala que los `depth` de LAYERS en HeroParallax (fondo 10,
 *  escritorio/monitor 26, cristal 44). */
const ORB_DEPTH_PX = 34;

/**
 * Pantalla de carga del hero: cubre la escena hasta que las 4 capas
 * (`useHeroSceneLoaded`, en HeroParallax.tsx) terminan de cargar/decodificar
 * de verdad. Elegido `ProgressBar` sobre `Spinner`/`Skeleton` porque el
 * número de capas es conocido y fijo (4): una barra real (cargadas/total) es
 * honesta con el usuario en vez de un giro genérico sin relación con el
 * progreso real. Se empareja con la marca (mismo `icon-dark.svg` que ya usa
 * el eyebrow "Guía rápida" y la pantalla del monitor) para que la carga se
 * lea como parte de la identidad del sitio, no como un loader genérico.
 *
 * zIndex 2: por encima del bloque de texto (zIndex 1, más abajo) pero muy
 * por debajo del header (zIndex 9 en Header.tsx) — nunca lo tapa.
 */
function HeroLoadingOverlay({
  loaded,
  total,
  ready,
}: {
  loaded: number;
  total: number;
  ready: boolean;
}) {
  // Arranca en `true` en servidor y cliente por igual (useHeroSceneLoaded
  // también arranca en `ready=false` en ambos lados): sin esto habría un
  // mismatch de hidratación.
  const [visible, setVisible] = useState(true);
  const { prefersReducedMotion } = useReducedMotion();
  const fadeMs = prefersReducedMotion ? LOAD_FADE_MS.reduced : LOAD_FADE_MS.full;

  // Desmonta después del fundido (no de golpe): el propio duration del
  // fundido decide cuándo, no un tiempo de espera adivinado.
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setVisible(false), fadeMs + 50);
    return () => window.clearTimeout(id);
  }, [ready, fadeMs]);

  if (!visible) return null;

  return (
    <Column
      position="absolute"
      top="0"
      left="0"
      fill
      zIndex={2}
      center
      pointerEvents="none"
      style={{
        backgroundColor: "#04080e",
        opacity: ready ? 0 : 1,
        transition: `opacity ${fadeMs}ms ease`,
      }}
    >
      <Column gap="16" center style={{ width: 140 }}>
        <Image
          src="/trademark/icon-dark.svg"
          alt=""
          width={30}
          height={30}
          style={{ opacity: 0.85 }}
        />
        <ProgressBar
          value={loaded}
          min={0}
          max={total}
          label={false}
          barBackground="brand-strong"
          style={{ width: "100%" }}
        />
      </Column>
    </Column>
  );
}

export function HomeHero({ pieces = [] }: { pieces?: HeroPiece[] }) {
  // El hero SIEMPRE se ve oscuro sobre la foto (contraste fijo, no depende
  // del tema del visitante): se fuerza data-theme="dark" en vez de leer
  // resolvedTheme. Solo se repiten solid/solidStyle (no cambian con el
  // tema) porque los tokens semánticos que SÍ pintan Heading/Text/Icon se
  // resuelven con selectores compuestos [data-theme=x][data-solid=y] — el
  // mismo mecanismo que DesignerCard en DesignerDirectory.tsx.
  const { solid, solidStyle } = useStyle();
  const { loaded, total, ready: sceneReady } = useHeroSceneLoaded();
  const heroRef = useRef<HTMLDivElement>(null);
  // Recibe las custom properties del parallax (ver HERO_DEPTH_VAR_X/Y): el
  // orbe se mueve con el MISMO puntero suavizado que las capas de la foto.
  const orbRef = useRef<HTMLDivElement>(null);
  const { portrait, sceneBottom, minHeight: portraitMinHeight } = useHeroPortrait(heroRef);

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
      ref={heroRef}
      fillWidth
      // En vertical el alto lo define el contenido (escena + texto): con
      // 100dvh y el texto anclado abajo, en pantallas altas quedaba un hueco
      // muerto creciente entre la banda de la escena y el texto. En
      // horizontal no cambia nada.
      height={portrait ? undefined : "100dvh"}
      overflow="hidden"
      vertical={portrait ? undefined : "end"}
      style={{
        marginTop: "-48px",
        ...(portrait ? { minHeight: portraitMinHeight } : null),
      }}
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
      <HeroParallax pieces={pieces} depthVarsRef={orbRef} />
      <HeroLoadingOverlay loaded={loaded} total={total} ready={sceneReady} />
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
      {/* Orbe WebGL (Originkit, ver src/components/originkit/CosmicOrb.tsx).
          Centrado en el hero y POR DEBAJO del bloque de texto (que lleva
          zIndex 1 y además va después en el DOM).
          El shader escribe siempre alpha 1: el orbe es, de origen, un disco
          OPACO que tapaba la foto. Para integrarlo se combinan tres cosas, no
          basta con bajarle la opacidad:
            · `background="#000000"` — el color del vacío entre estrellas. Con
              `screen` el negro es el neutro de la mezcla (screen(0,x) = x), así
              que el vacío desaparece del todo y solo quedan estrellas, nebulosa
              y el halo del borde. Con el #05050F original quedaba un velo gris
              flotando sobre el escritorio.
            · `mixBlendMode: screen` — nunca oscurece lo que hay detrás, solo
              suma luz. Es lo que convierte el disco en algo etéreo en vez de en
              una pelota pegada encima de la foto.
            · opacity — dosifica cuánta de esa luz se suma, para que el titular
              (que le queda encima) siga siendo el elemento dominante.
          Solo en horizontal: en vertical la escena ya es una banda arriba y el
          texto arranca justo debajo (no queda hueco donde centrarlo), y además
          evita el costo del shader en móvil, que es donde más pesa.
          Va DESPUÉS de la foto/gradiente y ANTES de Particle, del scrim inferior
          y del Fade: así las partículas le pasan por delante y la disolución del
          pie del hero se lo lleva junto con el resto de la escena, en vez de
          dejarlo recortado sobre el fondo de la página.
          pointerEvents none: es decoración, no debe robar el hover del parallax
          (HeroParallax escucha el puntero sobre todo el hero).
          Se ve TAMBIÉN en vertical/móvil. Antes se ocultaba ahí por dos
          motivos, los dos resueltos en las props del componente: el encuadre
          (un tamaño atado solo a `vw` dejaba en móvil un disco pequeño y
          suelto en vez de la atmósfera que envuelve la escena en desktop) y el
          costo de GPU, que es donde más duele. Ver `size` y `lens` abajo.
          SIEMPRE montado (antes `{!portrait && (…)}`): condicionar el JSX
          desmontaba y remontaba CosmicOrb en cada flip de `portrait` al
          arrastrar el borde de la ventana, y cada montaje pide un contexto
          WebGL nuevo — el navegador limita cuántos hay vivos a la vez y, a ese
          ritmo, llegó a entregar contextos ya perdidos (5 de 10 en una prueba
          de 12 resizes), con el shader intentando compilar sobre un contexto
          muerto. Ahora se oculta por CSS (`display: none` más abajo) en vez de
          quitarse del árbol: el contexto se crea una sola vez por visita y el
          IntersectionObserver interno de CosmicOrb (ver su cabecera, punto 2)
          detecta que un elemento `display: none` no interseca y para el
          `requestAnimationFrame` solo — oculto en vertical sigue sin gastar
          GPU, que era el motivo original de no montarlo. */}
      <Column
        ref={orbRef}
        position="absolute"
        pointerEvents="none"
        style={{
          top: "50%",
          left: "50%",
          // El centrado va PRIMERO y el parallax después: el orden importa
          // porque las transformaciones se aplican de derecha a izquierda,
          // así que el desplazamiento se suma sobre el orbe ya centrado.
          // ORB_DEPTH_PX queda entre el escritorio (26) y el cristal (44) de
          // HeroParallax: el orbe se lee flotando en la habitación, entre los
          // paneles de vidrio, y no pegado al fondo ni al frente del todo.
          // El fallback `0` cubre los casos en que el parallax no corre
          // (táctil, prefers-reduced-motion): entonces nadie escribe las
          // variables y el orbe se queda quieto y centrado.
          transform: `translate(-50%, -50%) translate3d(calc(var(${HERO_DEPTH_VAR_X}, 0) * ${-ORB_DEPTH_PX}px), calc(var(${HERO_DEPTH_VAR_Y}, 0) * ${-ORB_DEPTH_PX}px), 0)`,
          // Más bajo que antes (0.5): al triplicar el tamaño el orbe pasa a
          // cubrir el viewport entero, y con `screen` cada punto suma luz —
          // a 0.5 lavaba la foto y le comía el contraste al titular.
          opacity: 0.34,
          mixBlendMode: "screen",
          // Difuminado MUY corto del borde (el disco es nítido hasta el 92%
          // del radio): quita el corte duro del círculo sin deshacer la
          // lectura de esfera, que es lo que aporta el halo del limbo.
          // closest-side hace coincidir el radio del degradado con el del
          // orbe, porque el wrapper es cuadrado y del mismo lado.
          maskImage: "radial-gradient(closest-side, #000 92%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(closest-side, #000 92%, transparent 100%)",
        }}
      >
        <CosmicOrb
          // Paleta alineada a la marca (cyan) en vez de la default magenta
          // de Originkit: anchor azul + cyan/violeta y blanco como tercer
          // color, que es lo que le da las estrellas neutras.
          palette={{
            anchor: "#0C66C9",
            colorA: "#3CE0FF",
            colorB: "#A24BFF",
            colorC: "#FFFFFF",
          }}
          background="#000000"
          // 13 sobre 50 (default): a velocidad normal el orbe gira lo
          // suficiente para robarle la atención al titular. `speed` escala
          // el TIEMPO GLOBAL del shader (nebulosa, deriva, parpadeo de
          // estrellas); la rotación angular es un uniform aparte (`spin`,
          // ver abajo), así que bajar uno no afecta al otro.
          speed={13}
          // 20 sobre 50 (default): el shader multiplica `targetVel` (la
          // velocidad angular en `advance()`) por `spin/50`, así que 20 deja
          // la rotación al 40% — gira notoriamente más despacio sin tocar
          // `speed`, que sigue marcando el ritmo de la nebulosa y las
          // estrellas. Elegido dentro de 15–25 para que siga habiendo
          // movimiento perceptible (spin=0 dejaría el disco estático, que
          // se leería como un fallo del shader más que como una elección).
          spin={20}
          // Basado en vw (ancho de VIEWPORT, no del hero ni del alto): la
          // fórmula anterior (min(1860px, 186vh)) topaba en px y crecía con
          // el ALTO, así que en ultrawide (2560x900) se quedaba corta —el
          // radio no llegaba a cubrir la semidiagonal del viewport y
          // asomaba el borde del círculo dentro del hero— y en pantallas
          // altas crecía de más. 120vw no tiene techo ni piso en px:
          // · A 1440x900 (referencia de diseño) da 1728px, un 3% más que
          //   antes (1674px): visualmente idéntico, el efecto buscado (el
          //   disco desborda el hero y solo se ve su centro) no cambia.
          // · A 2560x900 (ultrawide) da 3072px → radio 1536px, que supera
          //   en ~13% la semidiagonal del viewport (1357px): el borde del
          //   círculo queda siempre fuera de la vista.
          // Contrapartida asumida: con un tamaño atado SOLO al ancho, que el
          // borde del círculo quede fuera de la vista depende del aspect
          // ratio. El radio (0.6·W) supera la semidiagonal del viewport solo
          // si W/H > 1.51, así que en 16:9 y en ultrawide no se ve, pero en
          // pantallas landscape más cuadradas sí asoma: medido, a 1280x1024
          // el radio es 768px contra 820px de semidiagonal. Ahí el orbe se
          // lee como esfera con su borde difuminado en vez de como
          // atmósfera, que es un cambio de carácter, no un fallo. Si se
          // quisiera el mismo encuadre en todos los aspectos horizontales
          // (el mínimo que monta el orbe es 0.95, ver PORTRAIT_ASPECT en
          // heroPanelGeometry.ts), bastaría con `max(120vw, 150vh)`.
          //
          // A este tamaño el canvas queda por debajo de 1 texel por píxel
          // (CosmicOrb topa la resolución en MAX_PX = 1280 para no disparar
          // el costo del shader): las estrellas salen algo suaves, lo cual es
          // deseable en un elemento de fondo — subir ese tope lo encarecería
          // por 4.
          //
          // El `max(…, 120vh)` es lo que hace que el orbe funcione en
          // VERTICAL. Con solo `120vw`, en un móvil de 390px de ancho el orbe
          // medía 468px dentro de un hero de ~1340px de alto: se leía como una
          // pelota pequeña y suelta en medio de la escena, nada que ver con la
          // atmósfera que envuelve el encuadre en desktop. Atándolo también al
          // alto sube a ~1010px en ese mismo móvil y recupera el carácter. En
          // horizontal no cambia nada, porque ahí `120vw` siempre gana
          // (`vw > vh` para cualquier aspect > 1).
          size="max(120vw, 120vh)"
          // `lens` desactivado SIEMPRE, no solo en móvil. Es el efecto más
          // caro del shader con diferencia: cuando está activo, `main()`
          // evalúa `shade()` TRES veces por píxel (una por canal) para la
          // aberración cromática del limbo. Y a este tamaño no se ve: ese
          // efecto vive en el borde del disco (r > 0.85), que con el orbe
          // desbordando el hero queda fuera de la pantalla en 16:9 y en
          // ultrawide. Se pagaba el triple de trabajo de fragmento por algo
          // invisible.
          lens={false}
          // Segundo recorte, multiplicativo con el anterior: el costo del
          // shader es proporcional al ÁREA del canvas, y 900² es la mitad de
          // 1280² (el default de upstream). No se nota porque el orbe ya
          // estaba muy por debajo de un texel por píxel —mide 1728px en
          // pantalla y el canvas nunca pasó de 1280— y va a 0.34 de opacidad
          // sobre una foto: es un elemento de fondo difuso, no una imagen
          // que se lea nítida. Entre `lens` y esto, el trabajo de fragmento
          // por frame baja a ~1/6 del que tenía.
          maxResolution={900}
        />
      </Column>
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
      <div
        style={{ display: "contents" }}
        data-theme="dark"
        data-solid={solid}
        data-solid-style={solidStyle}
      >
        <Particle
          position="absolute"
          top="0"
          left="0"
          fill
          pointerEvents="none"
          // Motas de polvo, no nieve ni estrellas: más partículas (density
          // 140 vs 100 por defecto) pero cada una más chica (size "1", el
          // mínimo útil) y más tenue (opacity 20, el valor discreto más
          // bajo que seguía siendo visible en las capturas) para que se
          // lean como suspensión fina en vez de puntos aislados. speed 0.55
          // (vs 0.2) les da la deriva lenta y constante del polvo en el
          // aire; con 0.2 se sentían casi estáticas. Opacity solo acepta
          // múltiplos de 10 (tipo `Opacity` de Once UI). Ajustado a ojo con
          // capturas.
          density={140}
          size="1"
          speed={0.55}
          opacity={20}
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
      {/* En HORIZONTAL la franja va al fondo del hero, que es donde termina la
          foto (llena el alto). En VERTICAL la escena es una banda arriba y el
          resto del hero ya es fondo plano, así que anclarla abajo la dejaba
          lejos del borde de la foto y esta terminaba en un corte horizontal
          duro: ahí se coloca pegada al borde inferior de la banda. */}
      <Fade
        to="top"
        base="page"
        position="absolute"
        bottom={portrait ? undefined : "0"}
        left="0"
        fillWidth
        height={portrait ? undefined : "18%"}
        style={
          portrait && sceneBottom > 0
            ? { top: Math.max(0, sceneBottom - PORTRAIT_FADE_PX), height: PORTRAIT_FADE_PX }
            : undefined
        }
      />
      {/* `display: contents` saca el wrapper del box model (no mete una caja
          de layout extra) pero deja cascadear data-theme/data-solid/
          data-solid-style a los descendientes vía herencia de CSS normal. */}
      <div
        style={{ display: "contents" }}
        data-theme="dark"
        data-solid={solid}
        data-solid-style={solidStyle}
      >
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
            paddingBottom={portrait ? "48" : "104"}
            // En vertical el texto arranca justo debajo de la banda de la
            // escena en vez de quedar pegado al fondo del viewport, que es lo
            // que abría el hueco en pantallas altas.
            style={portrait ? { paddingTop: sceneBottom + 32 } : undefined}
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
                  <ShineFx
                    variant="display-strong-l"
                    onBackground="brand-strong"
                    baseOpacity={0.85}
                  >
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

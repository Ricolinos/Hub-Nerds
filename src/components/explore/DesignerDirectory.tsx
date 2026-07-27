"use client";

import type { DragEvent, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Background,
  BlobFx,
  Column,
  Fade,
  Flex,
  FlipFx,
  Grid,
  Heading,
  HoloFx,
  IconButton,
  InfiniteScroll,
  Mask,
  MatrixFx,
  Media,
  RevealFx,
  Row,
  Text,
  TiltFx,
  useStyle,
  useTheme,
} from "@once-ui-system/core";
import { RoleTag } from "@/components/RoleTag";
import { ALL_SPECIALTIES, useExploreSearch } from "./SearchContext";
import styles from "./DesignerDirectory.module.scss";

// Usuarios reales de la plataforma (rol "freelancer") consultados vía Prisma en el Server Component.
export type PlatformDesigner = {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  cardQuote: string | null;
  headline: string | null;
  bio: string | null;
  primaryRole: string | null;
  secondaryRoles: string[];
  profileBrand: string | null;
  profileAccent: string | null;
  profileNeutral: string | null;
  profileBorder: string | null;
};

// Exportado para que la bienvenida guiada (/bienvenida) muestre la cara real
// de la tarjeta como preview en vivo, en vez de una réplica que se
// desincronizaría en cuanto esta cambie.
export type Designer = {
  id: string;
  name: string;
  username: string | null;
  specialty: string;
  role: string;
  avatar: string;
  projectHref: string;
  projectTitle: string;
  featuredImageUrl: string | null;
  cardQuote: string | null;
  headline: string;
  bio: string | null;
  primaryRole: string | null;
  secondaryRoles: string[];
  profileBrand: string | null;
  profileAccent: string | null;
  profileNeutral: string | null;
  profileBorder: string | null;
};

// La proporción vertical fija de la tarjeta (3/4) vive en
// DesignerDirectory.module.scss (.flipCard): FlipFx fija su altura por JS y
// esa clase la anula con !important, dejando que el aspect-ratio en CSS
// controle el alto de ambas caras (ver detalle en el .scss).
export function DesignerFront({ designer, seed }: { designer: Designer; seed: number }) {
  // Solo la imagen destacada. NO cae al avatar: Clerk siempre entrega uno
  // generado, así que ese fallback hacía que cualquier tarjeta sin imagen
  // propia mostrara el placeholder del avatar ampliado a toda la tarjeta.
  // Sin imagen destacada se dibuja el diseño standard con el isotipo.
  const imageSrc = designer.featuredImageUrl || null;
  const initial = (designer.name[0] ?? "D").toUpperCase();
  // Username corto en vez del nombre completo; si no hay username (cuenta
  // vieja sin username asignado) cae al nombre para no dejar el renglón vacío.
  const displayName = designer.username || designer.name;
  const cornerAvatarProps = designer.avatar ? { src: designer.avatar } : { value: initial };

  // Fade (tinte) + textos: se reutilizan tal cual dentro o fuera del HoloFx
  // según haya imagen, para no duplicar el JSX.
  const overlay = (
    <>
      {/* Tinte de degradado que hace legible el nombre/rol sobre la imagen:
          ancla abajo, sin patrón de puntos (pattern.display=false). El blur
          real lo aporta el duplicado de imagen (zIndex 1, solo cuando hay
          imagen); este Fade solo suma color/contraste con opacity baja para
          dejar ver más imagen. */}
      <Fade
        to="top"
        base="page"
        pattern={{ display: false }}
        opacity={50}
        position="absolute"
        bottom="0"
        left="0"
        fillWidth
        zIndex={2}
        style={{ height: "50%" }}
      />

      {/* Avatar chico junto al bloque de texto, misma fila: ambos anclados
          esquina inferior izquierda del frente. vertical="center" alinea el
          avatar contra el centro vertical de las dos líneas de texto (en vez
          de contra su tope), que es lo que se ve ordenado con un avatar
          circular al lado de un heading+label. Tamaño 150% del "m" original
          (32px): Avatar acepta `size` numérico en rem (ver sizeInRem en
          dist/components/Avatar.js), así que size={3} = 3rem = 48px sin
          recurrir a `style`. gap subido de 8 a 12 para que el aire entre el
          avatar más grande y el bloque de texto quede proporcionado. */}
      <Row
        position="absolute"
        bottom="0"
        left="0"
        fillWidth
        padding="16"
        gap="12"
        vertical="center"
        zIndex={3}
      >
        <Avatar {...cornerAvatarProps} size={3} />
        {/* minWidth 0 + truncado: el nombre usa un tamaño fijo mientras la
            tarjeta escala, así que un username largo se salía del borde (se
            ve sobre todo en tarjetas chicas, como la vitrina de talento de la
            bienvenida del client). */}
        <Column gap="4" style={{ minWidth: 0 }}>
          <Heading
            variant="display-strong-xs"
            onBackground="neutral-strong"
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </Heading>
          <Text
            variant="label-default-l"
            onBackground="neutral-medium"
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {designer.headline}
          </Text>
        </Column>
      </Row>
    </>
  );

  return (
    <Column fillWidth fillHeight radius="l" overflow="hidden" background="neutral-alpha-weak">
      {imageSrc ? (
        // HoloFx envuelve TODO el frente (imagen base + duplicado blurreado +
        // Fade + textos), no solo la imagen: en dist/components/HoloFx.js
        // pinta "base" (los children tal cual) y luego 3 capas overlay
        // (burn/shine/texture) que REPITEN los mismos children con blend
        // modes/máscara distintos, apiladas encima. Si HoloFx solo envolvía
        // la imagen, el shine/burn quedaba tapado por el duplicado/Fade/texto
        // que estaban fuera y por encima; como wrapper raíz, el brillo cubre
        // toda la tarjeta. OJO — en dist/components/HoloFx.module.scss las 3
        // capas overlay arrancan en `opacity: 0` y solo se revelan en
        // `.holoFx:hover` (más `m: { hide: true }` hardcodeado, sin prop para
        // desactivarlo): es un efecto de HOVER por diseño del componente, no
        // se ve en una captura estática ni en viewport "m" (tablet). Defaults
        // reales del componente (dist/components/HoloFx.js): shine
        // opacity 30 blending "color-dodge", burn opacity 30
        // filter "brightness(0.2) contrast(2)" blending "color-dodge",
        // texture opacity 10 blending "color-dodge" image
        // "repeating-linear-gradient(...)" (patrón de rayas diagonales, no
        // vacío). Config final pedida por el usuario (copiada tal cual de la
        // documentación oficial): shine/burn opacity 10, texture opacity 5,
        // los tres con blending "soft-light": color-dodge aclara dividiendo
        // por el inverso del blend, así que "quema" a blanco casi sin
        // importar la opacity sobre zonas claras de la imagen; soft-light da
        // un brillo mucho más contenido (equivalente a una luz suave
        // encima), que es lo que se buscaba con un HoloFx discreto. Nombre
        // real de prop confirmado en HoloFx.json: `blending`, no
        // `mixBlendMode` (el componente lo mapea internamente en el style).
        // texture.image="" es un string válido (no rompe tipos ni runtime):
        // React omite un style con valor "" al aplicarlo al DOM, así que en
        // la práctica equivale a no tener textura visible en vez del patrón
        // de rayas por default.
        <HoloFx
          fill
          radius="l"
          shine={{
            opacity: 30,
            blending: "screen",
          }}
          burn={{
            opacity: 30,
            blending: "screen",
          }}
          texture={{
            opacity: 10,
            image: "",
            blending: "screen",
          }}
        >
          <Media
            src={imageSrc}
            alt={designer.name}
            fill
            fillHeight
            objectFit="cover"
            sizes="(max-width: 1024px) 100vw, 33vw"
            draggable={false}
            onDragStart={(event: DragEvent) => event.preventDefault()}
            onContextMenu={(event: MouseEvent) => event.preventDefault()}
          />

          {/* Duplicado blurreado de la MISMA imagen (mismo src) para simular
              el blur progresivo de la base. NO se puede usar backdrop-filter
              aquí: dentro de las caras de FlipFx (contexto 3D con
              perspective + preserve-3d + backface-visibility hidden, capas
              promovidas al compositor) Chromium vuelve inerte cualquier
              backdrop-filter de un descendiente. `filter` + `mask-image`
              sobre contenido propio sí funcionan en ese contexto, así que
              este layer trae su propio blur(16px) recortado por un
              mask-image que va opaco en la base y desaparece a la mitad de
              la tarjeta (mismos stops que el Fade de abajo). scale(1.1)
              evita el halo transparente que el blur deja en los bordes de
              la imagen. */}
          <Flex
            position="absolute"
            top="0"
            left="0"
            fill
            pointerEvents="none"
            overflow="hidden"
            zIndex={1}
            style={{
              WebkitMaskImage: "linear-gradient(to top, black 0%, black 18%, transparent 50%)",
              maskImage: "linear-gradient(to top, black 0%, black 18%, transparent 50%)",
            }}
          >
            <Media
              aria-hidden
              src={imageSrc}
              alt=""
              fill
              fillHeight
              objectFit="cover"
              sizes="(max-width: 1024px) 100vw, 33vw"
              style={{ filter: "blur(16px)", transform: "scale(1.1)" }}
            />
          </Flex>

          {overlay}
        </HoloFx>
      ) : (
        <>
          {/* Estado vacío único para tarjetas sin featuredImageUrl ni avatar
              real: mismo tinte radial + BlobFx del reverso (consistencia
              front/back) más la inicial del nombre en grande, centrada en el
              espacio libre por encima del bloque nombre/rol (que vive en
              `overlay`, anclado abajo). Sin z-index explícito: cae detrás del
              Fade/texto de `overlay` (zIndex 2/3) por orden de stacking. */}
          <Background
            position="absolute"
            top="0"
            left="0"
            fill
            pointerEvents="none"
            gradient={{
              display: true,
              opacity: 60,
              x: 50,
              y: 38,
              width: 120,
              height: 100,
              colorStart: "brand-background-strong",
              colorEnd: "static-transparent",
            }}
          />
          <BlobFx seed={seed} position="absolute" top="0" left="0" fill fillHeight opacity={40} />
          {/* Diseño "standard" de la tarjeta: el isotipo de Hub-Nerds, no la
              inicial ni la foto de perfil. Antes `imageSrc` caía al avatar
              cuando faltaba la imagen destacada, y como Clerk SIEMPRE entrega
              un avatar generado, la tarjeta acababa mostrando ese placeholder
              ampliado a pantalla completa en vez de un estado vacío digno.

              El centrado se hace con un contenedor flex y NO con
              position/top/left/translate sobre el Media: ese componente no
              reenvía las props de posición (queda `position: static`,
              `transform: none`), así que el logo terminaba desplazado ~60px
              a la derecha y abajo del centro. El paddingBottom compensa el
              bloque de nombre/rol anclado abajo, para que el isotipo quede
              ópticamente centrado en el espacio libre. */}
          <Column
            position="absolute"
            top="0"
            left="0"
            fill
            center
            pointerEvents="none"
            style={{ paddingBottom: "18%" }}
          >
            <Media
              src="/trademark/icon-light.svg"
              alt=""
              unoptimized
              style={{ width: "34%", height: "auto", aspectRatio: "1", opacity: 0.55 }}
            />
          </Column>
          {overlay}
        </>
      )}
    </Column>
  );
}

// Exportado junto con DesignerFront para el preview en vivo de /bienvenida
// (ver LiveCardPreview): el asistente muestra la tarjeta REAL, no una réplica.
export function DesignerBack({
  designer,
  seed,
  matrixActive,
  onFlipBack,
}: {
  designer: Designer;
  seed: number;
  matrixActive: boolean;
  onFlipBack: () => void;
}) {
  const router = useRouter();

  // El click en CUALQUIER parte del cuerpo del reverso navega al perfil;
  // stopPropagation evita que el mismo click burbujee hasta el onClick de
  // FlipFx y vuelva a voltear la tarjeta justo cuando estamos navegando. La
  // ÚNICA excepción es la flecha (handleUnflip abajo), que también hace
  // stopPropagation antes de llegar aquí. El MatrixFx ya no espera a ningún
  // ciclo: corre de fondo mientras la tarjeta está volteada (ver
  // `matrixActive`), así que no hay animación que cronometrar en el click.
  const goToProfile = (event: MouseEvent) => {
    event.stopPropagation();
    router.push(designer.projectHref);
  };

  // La flecha SOLO regresa al frente: nunca debe navegar ni dejar que el
  // click llegue al onClick de FlipFx.
  const handleUnflip = (event: MouseEvent) => {
    event.stopPropagation();
    onFlipBack();
  };

  const avatarProps = designer.avatar
    ? { src: designer.avatar }
    : { value: (designer.name[0] ?? "D").toUpperCase() };
  // Mismo fallback username→name que el frente, nunca deja el renglón vacío.
  const displayName = designer.username || designer.name;

  return (
    <Column
      fillWidth
      fillHeight
      radius="l"
      border="neutral-alpha-weak"
      background="neutral-alpha-weak"
      overflow="hidden"
      cursor="interactive"
      onClick={goToProfile}
    >
      {/* Capa base sólida anti-bleedthrough (WebKit/iOS Safari): backface-
          visibility:hidden de FlipFx no siempre es 100% opaco en Safari
          dentro de un contexto 3D (perspective + preserve-3d), dejando
          "espejear" el frente (texto invertido) detrás del reverso al
          voltear. `background="page"` resuelve a la clase `.page-background`
          → `background-color: var(--page-background)`, que en tokens.css
          encadena a `--neutral-background-weak` y de ahí a un hex sólido de
          la escala de grises del tema (sin alpha en ningún eslabón) — a
          diferencia de `neutral-alpha-weak` (usado en el resto de esta
          tarjeta), que SÍ lleva alpha y dejaría pasar el bleed-through. Se
          refuerza con `backgroundColor` inline al mismo var para que ninguna
          regla de especificidad mayor (ni el motor de compositing de Safari)
          la deje traslúcida. zIndex -1: por debajo de TODO lo demás del
          reverso (Background glow en 0, Mask+BlobFx en 1, contenido en 2). */}
      <Column
        position="absolute"
        top="0"
        left="0"
        fill
        pointerEvents="none"
        zIndex={-1}
        background="page"
        style={{ backgroundColor: "var(--page-background)" }}
      />

      {/* Capa base: solo el glow radial suave detrás del centro (sin patrón
          de puntos). Tokens globales, mismo esquema de color que HomeHero,
          respeta light/dark. */}
      <Background
        position="absolute"
        top="0"
        left="0"
        fill
        pointerEvents="none"
        zIndex={0}
        gradient={{
          display: true,
          opacity: 60,
          x: 50,
          y: 42,
          width: 120,
          height: 100,
          colorStart: "brand-background-strong",
          colorEnd: "static-transparent",
        }}
      />

      {/* Blob con movimiento propio, recortado por Mask con cursor=true: solo
          se revela en un círculo alrededor del puntero. En touch (sin mouse)
          Mask nunca activa el seguimiento y el blob queda oculto por la
          máscara, degradando sin romper nada. */}
      <Mask cursor radius={26} position="absolute" top="0" left="0" fill pointerEvents="none" zIndex={1}>
        <BlobFx seed={seed} fill opacity={60} />
      </Mask>

      {/* Contenido, todo posicionado absoluto y centrado respecto a la
          tarjeta completa (el padding de este Column no afecta ese cálculo:
          el containing block de un hijo absoluto es la padding box del
          ancestro posicionado, que sin border/margin coincide con el tamaño
          total de la tarjeta). */}
      <Column fillWidth fillHeight zIndex={2}>
        {/* MatrixFx anidado DENTRO de este mismo Column (en vez de sibling
            suelto): así comparte el MISMO containing block que el Avatar de
            abajo (top/left 50%). Ya no depende de quedar centrado contra el
            avatar: el bulge "wave" (a diferencia de "ripple", que es un
            círculo concéntrico desde revealFrom) viaja en diagonal en forma
            de S de esquina a esquina del canvas (ver dist/components/
            MatrixFx.js, bulgeType==="wave" usa distancia a lo largo de la
            diagonal del canvas, no distancia radial a un punto), así que el
            desfase de centrado ripple-en-desktop-vs-mobile deja de aplicar.
            Va primero en el DOM (sin zIndex propio) para pintarse debajo del
            avatar y del bloque de nombre/rol. Corre de fondo mientras la
            tarjeta está volteada (trigger="manual", active=matrixActive
            viene del `flipped` de DesignerCard, no del click). pointerEvents
            ="none" para no interceptar clicks (el click de navegación sigue
            resolviéndose en el Column contenedor, sin relación con el tipo
            de bulge). repeat:true cicla continuamente mientras
            `matrixActive` esté encendido. fps más bajo (30) porque puede
            haber 8+ tarjetas con el canvas corriendo en simultáneo.
            colors: "success-solid-strong" era un verde fijo ajeno al tema;
            "brand-solid-strong" es EL token de marca configurable por el
            usuario (mismo esquema "brand" que el glow radial de arriba en
            este archivo y que Header.tsx/HomeHero.tsx usan para acentos),
            así que el ripple ahora respeta el tema activo en vez de
            imponer un color fijo. Default del componente es
            "brand-solid-medium" (ver dist/components/MatrixFx.js); usamos
            el escalón "strong" para que el trazo del ripple siga
            destacando sobre el fondo de la tarjeta. */}
        <MatrixFx
          trigger="manual"
          active={matrixActive}
          revealFrom="center"
          colors={["brand-solid-strong"]}
          bulge={{ type: "wave", duration: 3, intensity: 20, repeat: true }}
          fps={30}
          position="absolute"
          top="0"
          left="0"
          fill
          pointerEvents="none"
        />

        {/* Avatar centrado en AMBOS ejes al centro geométrico de la tarjeta:
            top/left 50% + translateX/translateY -50% son props nativas de
            Flex (parsePosition en dist/components/ServerFlex.js las pasa tal
            cual como CSS y arma `transform: translate(...)`), sin CSS manual.
            Diámetro ≈ 33% del ancho de la tarjeta: el `style` de Avatar se
            mergea último y gana sobre sus anchos fijos en rem (ver
            sizeInRem en dist/components/Avatar.js), así que forzamos
            width:"33%" + aspectRatio:"1" (height:"auto" para que aspectRatio
            controle el alto); la Media interna ya usa fill+aspectRatio "1" y
            llena ese círculo. `size={8}` solo queda como pista para el
            `sizes` de next/image, no define el layout. El MatrixFx de arriba
            usa este MISMO Column como referencia, así que su centro
            (revealFrom="center") coincide exactamente con este punto. Sin
            onClick propio: un click aquí burbujea al onClick del Column
            contenedor (goToProfile), que ya cubre toda la tarjeta. */}
        <Avatar
          {...avatarProps}
          size={8}
          position="absolute"
          top="50%"
          left="50%"
          translateX="-50%"
          translateY="-50%"
          style={{ width: "33%", height: "auto", minWidth: "0", minHeight: "0", aspectRatio: "1" }}
        />

        {/* Nombre + rol principal debajo del avatar. Solo el rol principal
            (sin secundarios): con 2 líneas de nombre, una fila de tags
            secundarios quedaba pegada al borde inferior de la tarjeta. La
            tarjeta es 3/4 (ancho:alto = 3:4, ver .flipCard en el .scss): un
            avatar de 33% de ANCHO mide, en % de ALTO, 33% * 3/4 ≈ 24.75%
            (radio ≈ 12.4%). Arrancamos el bloque a 50% + 12.5% (borde del
            avatar) + 16px de aire. */}
        <Column
          position="absolute"
          left="0"
          fillWidth
          paddingX="24"
          gap="8"
          horizontal="center"
          align="center"
          style={{ top: "calc(50% + 12.5% + 16px)" }}
        >
          <Heading variant="display-strong-xs" onBackground="neutral-strong" align="center" wrap="balance">
            {displayName}
          </Heading>
          {designer.primaryRole && (
            <Row horizontal="center">
              <RoleTag role={designer.primaryRole} variant="primary" />
            </Row>
          )}
          {/* La cita del reverso. El campo se llama `cardQuote` justamente
              porque su lugar es este, pero no se estaba pintando en ninguna
              parte de la app: se capturaba en el editor de perfil y quedaba
              muerto. `overflowWrap` + `minWidth: 0` para que una frase larga
              sin espacios no ensanche la tarjeta (ver overflow móvil). */}
          {designer.cardQuote && (
            <Text
              variant="body-default-s"
              onBackground="neutral-weak"
              align="center"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              “{designer.cardQuote}”
            </Text>
          )}
        </Column>
      </Column>

      {/* Flecha para des-voltear sin navegar; siempre visible, esquina superior
          derecha, por encima de todo lo demás (incluida la onda MatrixFx) para
          seguir siendo clickeable durante la animación. Va dentro de un Flex
          absoluto propio: con `tooltip`, IconButton se envuelve en un wrapper
          relative y un absolute en su `style` se anclaría a ese wrapper (que
          fluye al fondo de la columna), no a la tarjeta. */}
      <Flex position="absolute" top="12" right="12" zIndex={4}>
        <IconButton
          icon="refresh"
          variant="secondary"
          size="m"
          tooltip="Voltear tarjeta"
          aria-label="Voltear tarjeta"
          onClick={handleUnflip}
        />
      </Flex>
    </Column>
  );
}

// TiltFx se autodesactiva en dispositivos táctiles (detecta "ontouchstart" y
// no aplica el efecto), así que convive sin estorbar con el tap-to-flip.
// `flipped`/`onFlip` vienen de DesignerDirectory (estado levantado un nivel
// más arriba, compartido entre todas las tarjetas del grid) para que solo
// una tarjeta pueda mostrar el reverso a la vez: FlipFx queda controlado
// tanto para que la flecha del reverso pueda des-voltear la tarjeta como
// para que voltear OTRA tarjeta cierre automáticamente la que estaba abierta.
function DesignerCard({
  designer,
  seed,
  flipped,
  onFlip,
}: {
  designer: Designer;
  seed: number;
  flipped: boolean;
  onFlip: (flipped: boolean) => void;
}) {
  // Paleta propia del dueño de la tarjeta (solo campos con override; el resto
  // hereda la marca Hub-Nerds). `display: contents` saca el wrapper del box
  // model por completo (no ocupa celda de grid propia, no interfiere con el
  // tamaño que TiltFx/FlipFx calculan) pero SÍ deja las custom properties de
  // los data-attrs cascadeando a los hijos vía herencia normal de CSS. Un div
  // nativo (no Column/Row) porque solo necesitamos el atributo, cero layout
  // propio.
  //
  // data-theme/data-solid/data-solid-style repetidos aquí por el mismo
  // motivo documentado en ProfileView.tsx: los tokens SEMÁNTICOS (--brand-
  // alpha-weak, --brand-solid-strong, etc., los que de verdad pintan Tag/
  // Button/Card) se calculan una sola vez en <html> vía selectores
  // `[data-theme=x]` (algunos compuestos con `[data-solid=y]`) y ese valor ya
  // resuelto es lo que hereda cualquier descendiente — un data-brand/accent/
  // neutral distinto más abajo en el árbol NO alcanza a esos tokens a menos
  // que el bloque `[data-theme=x]` vuelva a hacer match en ese descendiente.
  // Verificado con getComputedStyle en Edge real (ver informe de la tarea).
  const { resolvedTheme } = useTheme();
  const { solid, solidStyle } = useStyle();
  // profileBorder se ignora a propósito: los bordes de las tarjetas
  // de Freelancer NO se personalizan (consistencia visual del grid), aunque el
  // usuario tenga un valor legado guardado en BD.
  const hasDesignerOverride = Boolean(
    designer.profileBrand || designer.profileAccent || designer.profileNeutral,
  );
  const cardDataAttrs: Record<string, string> = {
    ...(designer.profileBrand ? { "data-brand": designer.profileBrand } : {}),
    ...(designer.profileAccent ? { "data-accent": designer.profileAccent } : {}),
    ...(designer.profileNeutral ? { "data-neutral": designer.profileNeutral } : {}),
    ...(hasDesignerOverride
      ? {
          "data-theme": resolvedTheme,
          "data-solid": solid,
          "data-solid-style": solidStyle,
        }
      : {}),
  };

  return (
    <div style={{ display: "contents" }} {...cardDataAttrs}>
      <TiltFx fillWidth radius="l" intensity={3}>
        <FlipFx
          fillWidth
          radius="l"
          className={styles.flipCard}
          flipped={flipped}
          onFlip={onFlip}
          front={<DesignerFront designer={designer} seed={seed} />}
          back={
            <DesignerBack
              designer={designer}
              seed={seed}
              matrixActive={flipped}
              onFlipBack={() => onFlip(false)}
            />
          }
        />
      </TiltFx>
    </div>
  );
}

// Mismo lote que ExploreFeed: sin paginación de servidor, InfiniteScroll solo
// revela progresivamente el array "filtered" ya cargado en el cliente.
const BATCH_SIZE = 8;

export function DesignerDirectory({ platformDesigners = [] }: { platformDesigners?: PlatformDesigner[] }) {
  const { query, specialty } = useExploreSearch();

  const designers = useMemo<Designer[]>(() => {
    return platformDesigners.map((user) => ({
      id: user.id,
      name: user.name ?? user.username ?? "Creativo",
      username: user.username,
      specialty: "Diseñador de Marca",
      role: user.headline ?? "Talento de la plataforma Freelancers",
      avatar: user.imageUrl ?? "",
      projectHref: user.username ? `/${user.username}` : "/explorar",
      projectTitle: "Perfil de freelancer",
      featuredImageUrl: user.featuredImageUrl,
      cardQuote: user.cardQuote,
      headline: user.headline ?? "Diseñador de Marca",
      bio: user.bio,
      primaryRole: user.primaryRole,
      secondaryRoles: user.secondaryRoles ?? [],
      profileBrand: user.profileBrand,
      profileAccent: user.profileAccent,
      profileNeutral: user.profileNeutral,
      profileBorder: user.profileBorder,
    }));
  }, [platformDesigners]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return designers.filter((designer) => {
      if (specialty !== ALL_SPECIALTIES && designer.specialty !== specialty) return false;
      if (q && !designer.name.toLowerCase().includes(q) && !designer.role.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [designers, query, specialty]);

  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  // Un solo id volteado a la vez en todo el grid: voltear una tarjeta nueva
  // reemplaza el id anterior, así que la tarjeta previamente abierta recibe
  // `flipped=false` y FlipFx la regresa sola al frente.
  const [flippedId, setFlippedId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [filtered]);

  const visible = filtered.slice(0, visibleCount);

  const loadMore = async () => {
    const next = visibleCount + BATCH_SIZE;
    setVisibleCount(next);
    return next < filtered.length;
  };

  return (
    <RevealFx fillWidth direction="column" gap="24" translateY="8" speed="fast">
      <Column fillWidth gap="8">
        <Heading variant="display-strong-l">Freelancers</Heading>
        <Text onBackground="neutral-weak" variant="body-default-l">
          Conoce a los diseñadores colaboradores de la plataforma.
        </Text>
      </Column>

      {filtered.length === 0 ? (
        <Text onBackground="neutral-weak" variant="body-default-m">
          No encontramos diseñadores que coincidan con tu búsqueda.
        </Text>
      ) : (
        <Grid columns={3} m={{ columns: 2 }} s={{ columns: 1 }} gap="24" fillWidth>
          <InfiniteScroll
            items={visible}
            renderItem={(designer) => (
              <DesignerCard
                key={designer.id}
                designer={designer}
                seed={designers.indexOf(designer)}
                flipped={flippedId === designer.id}
                onFlip={(next) => setFlippedId(next ? designer.id : null)}
              />
            )}
            loadMore={loadMore}
            style={{ gridColumn: "1 / -1" }}
          />
        </Grid>
      )}
    </RevealFx>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { isFocusRoute } from "@/lib/onboarding";
import { AnimatePresence, motion } from "framer-motion";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Avatar,
  Badge,
  Button,
  Column,
  Icon,
  Line,
  NavIcon,
  Option,
  Row,
  SmartLink,
  Text,
  ThemeSwitcher,
  UserMenu,
  useStyle,
} from "@once-ui-system/core";

import { display } from "@/resources";
import { isFreelancerRole } from "@/lib/roles";
import { ThemeToggle } from "./ThemeToggle";
import { MegaMenu, type MenuGroup } from "./MegaMenu";
import { MobileMegaMenu } from "./MobileMegaMenu";
import { AuthModal, type AuthMode } from "./auth/AuthModal";
import styles from "./Header.module.scss";

// ─── Navegación ───────────────────────────────────────────────────────────────
const menuGroups: MenuGroup[] = [
  {
    id: "explorar",
    label: "Explorar",
    href: "/explorar",
    suffixIcon: "chevronDown",
    sections: [
      {
        links: [
          { label: "Animación",   href: "/explorar/animacion",   icon: "film" },
          { label: "Branding",    href: "/explorar/branding",    icon: "sparkles" },
          { label: "Ilustración", href: "/explorar/ilustracion", icon: "paintBrush" },
          { divider: true },
          { label: "Freelancers", href: "/explorar/freelancers", icon: "userGroup" },
        ],
      },
    ],
  },
  {
    id: "servicios",
    label: "Servicios",
    href: "/servicios",
    suffixIcon: "chevronDown",
    sections: [
      {
        links: [
          { label: "Cotiza tu proyecto de Diseño", href: "/servicios/cotizador",   icon: "rocket" },
          { label: "Información",                  href: "/servicios/informacion",  icon: "infoCircle" },
          { label: "Facturación",                  href: "/servicios/facturacion",  icon: "creditCard" },
        ],
      },
    ],
  },
];

// Grupo "Convocatorias": común a todo visitante, salvo "Gestionar mis
// convocatorias" (cupo/prórrogas/publicación), que solo tiene sentido para un
// client logueado — se inyecta condicionalmente en vez de vivir en el arreglo
// estático `menuGroups` de arriba. Se inserta ANTES de "Servicios" para
// conservar el orden original del header.
function getConvocatoriasMenuGroup(showManageLink: boolean): MenuGroup {
  return {
    id: "convocatorias",
    label: "Convocatorias",
    href: "/convocatorias",
    suffixIcon: "chevronDown",
    sections: [
      {
        links: [
          { label: "Convocatorias recientes", href: "/convocatorias",              icon: "sparkles" },
          { label: "Mis convocatorias",        href: "/convocatorias?vista=mias",    icon: "person"   },
          { label: "Convocatorias cerradas",   href: "/convocatorias?vista=cerradas", icon: "check"    },
          ...(showManageLink
            ? [{ label: "Gestionar mis convocatorias", href: "/convocatorias/gestion", icon: "briefcase" }]
            : []),
        ],
      },
    ],
  };
}

// Grupo "Panel de proyectos": contenido depende del rol (client|freelancer)
// leído de user.publicMetadata.role (mismo patrón que src/app/dashboard/**).
function getSignedInMenuGroups(role: string | undefined, username: string | null | undefined): MenuGroup[] {
  const base = isFreelancerRole(role) ? "/dashboard/freelancer" : "/dashboard/client";
  const items: NonNullable<MenuGroup["sections"]>[number]["links"] = [
    { label: "Crear nuevo proyecto",  href: base,                         icon: "plus"   },
    { label: "Proyectos en curso",    href: `${base}/projects`,          icon: "folder" },
    { label: "Proyectos finalizados", href: `${base}/projects/finished`, icon: "check"  },
  ];

  if (isFreelancerRole(role)) {
    items.push(
      { divider: true },
      { label: "Publicar un proyecto", href: username ? `/${username}` : base, icon: "plus" },
    );
  }

  return [
    {
      id: "panel-proyectos",
      label: "Panel de proyectos",
      href: base,
      suffixIcon: "chevronDown",
      sections: [{ links: items }],
    },
  ];
}

// ─── Fondo del header ─────────────────────────────────────────────────────────
// En el tope de la página: masthead oscuro FIJO → transparente. Con scroll: fondo
// de página sólido (blanco en light / negro en dark). Dos capas con crossfade de
// opacidad porque background-image no interpola en transiciones CSS.
//
// El masthead ya NO usa var(--brand-background-strong): ese token resuelve a un
// cian muy saturado en tema claro que chocaba con el contenido de abajo y con la
// foto siempre oscura del hero (ver HomeHero.tsx). rgba(8,12,18,*) es el MISMO
// azul-carbón fijo que ya usan el overlay de la foto (rgba(8,12,18,0.55)) y el
// scrim inferior (rgba(4,8,14,*)) de HomeHero.tsx — reutilizar ese tono evita un
// escalón de color entre el header y la foto que queda justo detrás, y como es
// más azulado que negro puro conserva un matiz sutil de la marca (cian/brand).
// Es una excepción documentada a "colores por token semántico": este masthead
// debe verse IGUAL sin importar el tema del visitante, así que justamente no
// puede depender de un token que sí cambia con el tema.
const HeaderBackdrop = ({ scrolled }: { scrolled: boolean }) => (
  <>
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        background: "linear-gradient(to bottom, rgba(8,12,18,0.96), rgba(8,12,18,0) 100%)",
        opacity: scrolled ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
    />
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        background: "var(--page-background)",
        opacity: scrolled ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}
    />
  </>
);

// ─── AuthZone ─────────────────────────────────────────────────────────────────
const AuthZone = ({
  mobile = false,
  compact = false,
  onOpenAuth,
}: {
  mobile?: boolean;
  // Escritorio angosto (905–1199px): el chip completo con nombre/correo no
  // cabe junto al buscador y los menús y desborda el viewport; solo avatar.
  compact?: boolean;
  onOpenAuth: (mode: AuthMode) => void;
}) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    if (mobile) return null;
    return (
      <Row gap="8" vertical="center" style={{ opacity: 0, pointerEvents: "none" }} aria-hidden="true">
        <Button variant="secondary" size="s" tabIndex={-1}>Iniciar sesión</Button>
        <Button variant="primary"   size="s" tabIndex={-1}>Registrarse</Button>
        {display.themeSwitcher && (
          <>
            <Line background="neutral-alpha-medium" vert maxHeight="24" />
            <ThemeToggle />
          </>
        )}
      </Row>
    );
  }

  if (isSignedIn && user) {
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress ||
      "Usuario";
    const initials = (user.firstName?.[0] ?? user.emailAddresses[0]?.emailAddress?.[0] ?? "U").toUpperCase();
    const avatarProps = { ...(user.imageUrl ? { src: user.imageUrl } : { value: initials }) };

    if (mobile) {
      return (
        <Column gap="4" fillWidth>
          <Row gap="12" paddingX="8" paddingY="8" vertical="center">
            <Avatar {...avatarProps} size="m" />
            <Column gap="2">
              <Text variant="label-strong-s" onBackground="neutral-strong">{displayName}</Text>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {user.emailAddresses[0]?.emailAddress}
              </Text>
            </Column>
          </Row>
          <Line background="neutral-alpha-medium" />
          <Option href={user.username ? `/${user.username}` : "/dashboard/client/settings"} label="Perfil" value="perfil"
            hasPrefix={<Icon name="person" size="s" onBackground="neutral-weak" />} />
          <Option
            href={user.username ? `/${user.username}?editar=1` : "/dashboard/client/settings"}
            label="Editar Perfil"
            value="editar-perfil"
            hasPrefix={<Icon name="edit" size="s" onBackground="neutral-weak" />}
          />
          {display.themeSwitcher && (
            <>
              <Line background="neutral-alpha-weak" />
              <Row fillWidth horizontal="center" paddingY="8">
                <ThemeSwitcher />
              </Row>
            </>
          )}
          <Line background="neutral-alpha-weak" />
          <Option href="/pro" label="Hazte Pro" value="hazte-pro"
            hasPrefix={<Icon name="sparkles" size="s" onBackground="brand-medium" />} />
          <Line background="neutral-alpha-weak" />
          <Option label="Salir" value="signout"
            onClick={() => signOut({ redirectUrl: "/" })}
            hasPrefix={<Icon name="logOut" size="s" onBackground="neutral-weak" />} />
        </Column>
      );
    }

    return (
      // El data-tour va en un envoltorio y no en <UserMenu>: el componente de
      // Once UI no reenvía props desconocidas al DOM, así que el selector del
      // spotlight no encontraba nada y el tour caía a oscurecer todo.
      <Row data-tour="user-menu" vertical="center">
      <UserMenu
        name={compact ? undefined : displayName}
        subline={
          compact ? undefined : (
            // Truncado: un correo largo sin ellipsis desborda el viewport en ~1024px
            <span
              style={{
                display: "block",
                maxWidth: 180,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user.emailAddresses[0]?.emailAddress}
            </span>
          )
        }
        avatarProps={{ ...avatarProps, size: "s" }}
        placement="bottom-end"
        dropdown={
          <Column minWidth={12} padding="4" gap="2">
            <Option href={user.username ? `/${user.username}` : "/dashboard/client/settings"} label="Perfil" value="perfil"
              hasPrefix={<Icon name="person" size="s" onBackground="neutral-weak" />} />
            <Option
              href={user.username ? `/${user.username}?editar=1` : "/dashboard/client/settings"}
              label="Editar Perfil"
              value="editar-perfil"
              hasPrefix={<Icon name="edit" size="s" onBackground="neutral-weak" />}
            />
            {display.themeSwitcher && (
              <>
                <Line background="neutral-alpha-weak" />
                <Row fillWidth horizontal="center" paddingY="8">
                  <ThemeSwitcher />
                </Row>
              </>
            )}
            <Line background="neutral-alpha-weak" />
            <Option href="/pro" label="Hazte Pro" value="hazte-pro"
              hasPrefix={<Icon name="sparkles" size="s" onBackground="brand-medium" />} />
            <Line background="neutral-alpha-weak" />
            <Option label="Salir" value="signout"
              onClick={() => signOut({ redirectUrl: "/" })}
              hasPrefix={<Icon name="logOut" size="s" onBackground="neutral-weak" />} />
          </Column>
        }
      />
      </Row>
    );
  }

  if (mobile) {
    return (
      <Column gap="8">
        <Button variant="tertiary" size="m" href="/pro" prefixIcon="sparkles" fillWidth>Pro</Button>
        <Button variant="secondary" size="m" onClick={() => onOpenAuth("sign-in")} fillWidth>Iniciar sesión</Button>
        <Button variant="primary"   size="m" onClick={() => onOpenAuth("sign-up")} fillWidth>Registrarse</Button>
        {display.themeSwitcher && (
          <Row horizontal="center" paddingTop="4"><ThemeToggle /></Row>
        )}
      </Column>
    );
  }

  return (
    <>
      {/* CTA discreto: variant="tertiary" (sin fondo sólido) para no competir
          con "Registrarse" (primary) por atención. */}
      <Button variant="tertiary" size="s" href="/pro" prefixIcon="sparkles">Pro</Button>
      <Button variant="secondary" size="s" onClick={() => onOpenAuth("sign-in")}>Iniciar sesión</Button>
      <Button variant="primary"   size="s" onClick={() => onOpenAuth("sign-up")}>Registrarse</Button>
      {display.themeSwitcher && (
        <>
          <Line background="neutral-alpha-medium" vert maxHeight="24" />
          <ThemeToggle />
        </>
      )}
    </>
  );
};

// ─── Logo compartido entre el header de escritorio y el de móvil ─────────────
// (sin layoutId: cada header hace crossfade de opacidad vía su propio
// motion.div, ver comentario junto a AnimatePresence más abajo)
//
// forceDark: el masthead oscuro (!scrolled) necesita SIEMPRE la variante dark
// del logo, incluso en tema claro. El swap normal de abajo es puro CSS vía
// `:global([data-theme="light"]) { .logoDark{display:none} .logoLight{display:block} }`
// en Header.module.scss, y ese selector matchea si CUALQUIER ancestro tiene
// data-theme="light" -- el <html data-theme="light"> del sitio sigue
// matcheando aunque anidemos un data-theme="dark" más cerca del logo (a
// diferencia de las custom properties de los tokens semánticos, que sí
// resuelven por el ancestro data-theme MÁS CERCANO, un selector de atributo
// no tiene noción de "más cercano": solo mira si existe *algún* ancestro con
// ese valor). Por eso hace falta la clase `.forceDarkLogo` explícita (ver
// Header.module.scss) en vez de confiar en el scope data-theme="dark".
const SiteLogo = ({ onClick, forceDark = false }: { onClick?: () => void; forceDark?: boolean }) => (
  <Row position="relative" fitWidth fitHeight className={forceDark ? styles.forceDarkLogo : undefined}>
    <SmartLink href="/" onClick={onClick}>
      <Image src="/trademark/type-dark.svg"  alt="Logo" height={24} width={120} className={styles.logoDark}  priority />
      <Image src="/trademark/type-light.svg" alt="Logo" height={24} width={120} className={styles.logoLight} priority />
    </SmartLink>
    <Badge
      position="absolute"
      top="calc(-10px)"
      right="0"
      paddingX="8"
      paddingY="2"
      radius="full"
      background="brand-alpha-weak"
      onBackground="brand-medium"
      textVariant="label-default-xs"
      pointerEvents="none"
    >
      Beta
    </Badge>
  </Row>
);

// ─── Header ───────────────────────────────────────────────────────────────────
export const Header = () => {
  const [mobileOpen, setMobileOpen]       = useState(false);
  const [isMobile, setIsMobile]           = useState(false);
  const [isCompact, setIsCompact]         = useState(false);
  const [scrolled, setScrolled]           = useState(false);
  const [authMode, setAuthMode]           = useState<AuthMode | null>(null);
  const pathname   = usePathname() ?? "/";
  const { isLoaded, isSignedIn, user } = useUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const username = user?.username;

  // Masthead oscuro fijo (ver HeaderBackdrop): mientras el header está "hasta
  // arriba" (sin scroll, y en móvil sin el panel abierto — mismo criterio que
  // ya usa HeaderBackdrop scrolled={scrolled || mobileOpen}) su contenido
  // (MegaMenu, "Iniciar sesión", logo) necesita resolver como si el tema
  // fuera oscuro, sin importar el tema real del visitante. `solid`/`solidStyle`
  // no cambian con el tema pero los tokens semánticos SÍ se resuelven con
  // selectores compuestos [data-theme=x][data-solid=y], por eso hay que
  // repetirlos en el scope — mismo mecanismo que HomeHero.tsx.
  const { solid, solidStyle } = useStyle();
  const topDesktop = !scrolled;
  const topMobile  = !(scrolled || mobileOpen);

  const allMenuGroups = useMemo(() => {
    const isSignedInClient = isLoaded && isSignedIn && role === "client";
    const baseGroups = [
      menuGroups[0],
      getConvocatoriasMenuGroup(isSignedInClient),
      ...menuGroups.slice(1),
    ];
    return isLoaded && isSignedIn ? [...baseGroups, ...getSignedInMenuGroups(role, username)] : baseGroups;
  }, [isLoaded, isSignedIn, role, username]);

  // Detectar breakpoint móvil via matchMedia (905px = breakpoint "s" de Once UI)
  // Reemplaza s={{ hide }} CSS para que AnimatePresence + layoutId puedan animar
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 904px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Escritorio angosto (905–1199px): chip de usuario compacto, ver AuthZone
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1199px)");
    setIsCompact(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Fondo del header según posición de scroll (degradado arriba, sólido al bajar)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cerrar panel al navegar o al pasar a escritorio
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => { if (!isMobile) setMobileOpen(false); }, [isMobile]);

  // Scroll lock cuando el panel está abierto
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Después de TODOS los hooks: la bienvenida guiada se renderiza sin nav
  // para no ofrecer escapes que compitan con el recorrido (ver isFocusRoute).
  if (isFocusRoute(pathname)) return null;

  return (
    <>
      {/* Header: fade entre escritorio ↔ móvil (crossfade de opacidad, ver
          transition={{ duration: 0.15 }} en cada motion.div de abajo).
          Antes el logo compartía layoutId="site-logo" entre ambas ramas
          para que framer-motion hiciera un FLIP (interpolar posición/tamaño)
          entre la posición del logo en escritorio y en móvil. Esa animación
          resultaba demasiado llamativa ("el logo vuela" por la pantalla) —
          se quitó el layoutId compartido a propósito y se deja solo el
          fundido de opacidad ya existente en cada motion.div contenedor.
          El logo no cambia de posición DENTRO de un mismo header (ni con
          scroll ni con isCompact), así que no hace falta layout animation
          local; con esto basta un fundido discreto en vez de un vuelo. */}
      <AnimatePresence initial={false}>
        {!isMobile ? (
          <motion.div
            key="desktop-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            // sticky aquí (no en el Row): dentro del motion.div el sticky no tenía
            // recorrido porque el contenedor mide lo mismo que el header.
            // zIndex 9: igual que el overlay del Dialog de Once UI (hardcoded a 9),
            // que al ser portal al final del body pinta encima; con 10 el MegaMenu
            // tapaba el panel de Ajustes.
            style={{ width: "100%", display: "block", position: "sticky", top: 0, zIndex: 9 }}
          >
            <Row
              as="header"
              position="relative"
              fillWidth
              padding="8"
              horizontal="center"
              vertical="center"
            >
              <HeaderBackdrop scrolled={scrolled} />
              {/* Contenido acotado a maxWidth="l" (mismo tope que el resto de
                  la página, ver page.tsx) y centrado por el `horizontal="center"`
                  del Row de arriba: en 4K el logo y la zona de auth quedaban en
                  extremos opuestos del viewport completo, separados por miles de
                  px. El fondo del masthead (HeaderBackdrop, position absolute
                  inset:0) sigue viviendo en el Row exterior fillWidth, así que
                  sigue pintando de borde a borde sin importar este tope. */}
              <Row fillWidth maxWidth="l" horizontal="between" vertical="center">
                {/* `display: contents` saca el wrapper del box model (Row A y Row B
                    siguen siendo hijos directos del Row `horizontal="between"` de
                    arriba a efectos de layout) pero deja cascadear data-theme/
                    data-solid/data-solid-style a todo el contenido del header
                    mientras está en su estado "masthead" (!scrolled). Sin
                    data-theme cuando ya hizo scroll, para no pelear con el tema
                    real del visitante. */}
                <div
                  style={{ display: "contents" }}
                  {...(topDesktop ? { "data-theme": "dark" } : {})}
                  data-solid={solid}
                  data-solid-style={solidStyle}
                >
                  <Row vertical="center" gap="4" style={{ flexShrink: 0 }}>
                    <Row vertical="center" paddingLeft="4" paddingRight="8">
                      <SiteLogo forceDark={topDesktop} />
                    </Row>
                    <Row vertical="center" gap="4">
                      <div style={{ flexShrink: 0, position: "relative" }}>
                        <MegaMenu menuGroups={allMenuGroups} position="relative" />
                      </div>
                    </Row>
                  </Row>
                  <Row vertical="center" gap="8" paddingRight="4">
                    <AuthZone compact={isCompact} onOpenAuth={setAuthMode} />
                  </Row>
                </div>
              </Row>
            </Row>
          </motion.div>
        ) : (
          <motion.div
            key="mobile-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ width: "100%", display: "block" }}
          >
            <Row
              as="header"
              position="fixed"
              top="0"
              left="0"
              fillWidth
              zIndex={9}
              paddingX="24"
              paddingY="12"
              horizontal="between"
              vertical="center"
              className={styles.mobileBar}
            >
              <HeaderBackdrop scrolled={scrolled || mobileOpen} />
              <div
                style={{ display: "contents" }}
                {...(topMobile ? { "data-theme": "dark" } : {})}
                data-solid={solid}
                data-solid-style={solidStyle}
              >
                <SiteLogo onClick={() => setMobileOpen(false)} forceDark={topMobile} />
                <NavIcon
                  isActive={mobileOpen}
                  onClick={() => setMobileOpen((v) => !v)}
                  aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
                />
              </div>
            </Row>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel móvil */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <Column
              position="fixed"
              zIndex={8}
              top="0"
              left="0"
              right="0"
              bottom="0"
              background="surface"
              paddingX="20"
              paddingBottom="40"
              gap="24"
              overflowY="auto"
              style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)" }}
            >
              <MobileMegaMenu
                menuGroups={allMenuGroups}
                onClose={() => setMobileOpen(false)}
              />
              <Line background="neutral-alpha-weak" />
              <AuthZone mobile={true} onOpenAuth={setAuthMode} />
            </Column>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onModeChange={setAuthMode} />
    </>
  );
};

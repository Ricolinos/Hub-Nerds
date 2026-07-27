"use client";

import { useUser } from "@clerk/nextjs";
import { Column, Flex, Heading, IconButton, Row } from "@once-ui-system/core";
import { usePathname } from "next/navigation";
import { isFocusRoute } from "@/lib/onboarding";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LightMessenger } from "@/components/messages/LightMessenger";
import { MessengerView } from "@/components/messages/MessengerView";

// Ancho/alto real de IconButton size="l" (--static-space-40 = 2.5rem = 40px),
// usado para clampear la burbuja dentro del viewport.
const BUBBLE_SIZE = 40;
const EDGE_MARGIN = 16;
// Header desktop es sticky (altura variable con scroll); header móvil es fixed
// de ~48px. 64px + margen cubre ambos casos como piso de seguridad si el
// querySelector("header") todavía no midió nada (SSR/primer paint).
const HEADER_BOTTOM_FALLBACK = 64;
const DRAG_THRESHOLD = 6;
const STORAGE_KEY = "hub-chat-bubble-pos";

// Tamaño del panel "Mensajes Light" (estado intermedio) en desktop; en móvil
// (<MOBILE_BREAKPOINT) el ancho se recalcula casi a pantalla completa con
// márgenes en vez de un rect fijo de 360x480.
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 480;
const MOBILE_BREAKPOINT = 480;
// El panel full ocupa casi toda la pantalla: margen uniforme por lado
// (izquierda/derecha/abajo). En móvil el margen se reduce para no desperdiciar
// ancho en pantallas angostas.
const PANEL_MARGIN = 30;
const PANEL_MARGIN_MOBILE = 16;
// Separación entre el borde inferior del header (sticky en desktop, fixed en
// móvil) y el borde superior del panel full, para que la barra de menú siga
// visible y clickeable con el panel abierto.
const HEADER_GAP = 16;
// Radio de la burbuja cerrada (círculo completo) vs. el panel abierto (light
// o full, ambos comparten radio — equivalente al token Once UI radius="l"
// ~ 1rem, en px porque se anima junto con width/height vía inline style).
const BUBBLE_RADIUS = 9999;
const PANEL_RADIUS = 16;
// Fade-in del contenido tras el morph de apertura o el swap light<->full
// (evita texto aplastado durante la transición de tamaño); en cierre/swap el
// contenido se desvanece primero y luego colapsa la forma o se reemplaza.
const CONTENT_FADE_IN_MS = 260;
const CONTENT_FADE_OUT_MS = 140;
// Duración del fundido del backdrop (blur + tinte), sincronizada con el morph
// de tamaño (SIZE_EASE dura 0.4s). Al salir del estado full, el backdrop
// primero llega a opacidad 0 y solo después se desmonta (evita el
// "parpadeo" de un blur que desaparece de golpe). El backdrop SOLO existe en
// el estado full (light es una ventana chica que no bloquea la página).
const BACKDROP_FADE_MS = 400;

type Side = "left" | "right";
// "closed": burbuja. "light": panel chico anclado al costado (LightMessenger).
// "full": panel casi a pantalla completa con la herramienta completa
// (MessengerView) y backdrop con blur detrás.
type Mode = "closed" | "light" | "full";

interface PanelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface StoredPos {
  side: Side;
  y: number;
}

function isStoredPos(value: unknown): value is StoredPos {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.side === "left" || candidate.side === "right") && typeof candidate.y === "number"
  );
}

// Bottom real del header del sitio (sticky en desktop, fixed en móvil) medido
// en runtime; nunca se permite que la burbuja quede por encima de ese borde.
function getHeaderBottom(): number {
  if (typeof document === "undefined") return HEADER_BOTTOM_FALLBACK;
  const header = document.querySelector("header");
  const bottom = header?.getBoundingClientRect().bottom ?? 0;
  return bottom > 0 ? bottom : HEADER_BOTTOM_FALLBACK;
}

function clampY(y: number): number {
  const minY = getHeaderBottom() + EDGE_MARGIN;
  const maxY = window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN;
  return Math.min(Math.max(y, minY), Math.max(minY, maxY));
}

function clampX(x: number): number {
  return Math.min(Math.max(x, EDGE_MARGIN), window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN);
}

function defaultPos(): StoredPos {
  // Costado derecho, ~24px arriba del borde inferior del viewport.
  return { side: "right", y: clampY(window.innerHeight - BUBBLE_SIZE - EDGE_MARGIN - 24) };
}

// Coordenada `left` de reposo para cada costado. Se posiciona SIEMPRE con
// `left` (nunca alternando left/right): CSS no puede animar la transición
// entre `left: auto` y `right: Npx`, así que imantar hacia la derecha
// cambiando de propiedad se veía sin animación.
function restingLeft(side: Side): number {
  return side === "left" ? EDGE_MARGIN : window.innerWidth - BUBBLE_SIZE - EDGE_MARGIN;
}

// Rectángulo del panel full (morph light<->full o burbuja->full directo si
// se implementara): casi pantalla completa, con margen uniforme por lado
// (PANEL_MARGIN, reducido en móvil) y el borde superior debajo del header
// (getHeaderBottom() + HEADER_GAP), para que la barra de menú siga visible y
// clickeable con el panel abierto.
function computeFullRect(): PanelRect {
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const margin = isMobile ? PANEL_MARGIN_MOBILE : PANEL_MARGIN;
  const headerBottom = getHeaderBottom();
  const top = headerBottom + HEADER_GAP;
  const left = margin;
  const width = window.innerWidth - margin * 2;
  const height = window.innerHeight - top - margin;
  return { left, top, width, height };
}

// Rectángulo del panel light, anclado al costado de reposo de la burbuja
// (crece hacia el lado contrario para no salirse del viewport) y hacia
// arriba desde la burbuja (bottom del panel ~= bottom de la burbuja). Ambos
// ejes se clampean contra el viewport real: si no hay espacio arriba, el
// panel queda ajustado al borde superior (debajo del header) en vez de
// desbordarse; en móvil el ancho es casi el del viewport completo.
function computeLightRect(pos: StoredPos): PanelRect {
  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const width = isMobile ? window.innerWidth - EDGE_MARGIN * 2 : PANEL_WIDTH;
  const headerBottom = getHeaderBottom();
  const maxHeight = window.innerHeight - headerBottom - EDGE_MARGIN * 2;
  const height = Math.min(PANEL_HEIGHT, Math.max(maxHeight, BUBBLE_SIZE));

  const bubbleLeft = restingLeft(pos.side);
  const rawLeft = pos.side === "left" ? bubbleLeft : bubbleLeft + BUBBLE_SIZE - width;
  const left = Math.min(Math.max(rawLeft, EDGE_MARGIN), window.innerWidth - width - EDGE_MARGIN);

  const minTop = headerBottom + EDGE_MARGIN;
  const maxTop = window.innerHeight - height - EDGE_MARGIN;
  const rawTop = pos.y + BUBBLE_SIZE - height;
  const top = Math.min(Math.max(rawTop, minTop), Math.max(minTop, maxTop));

  return { left, top, width, height };
}

// Chrome del estado full: MessengerView no trae barra propia de ventana, así
// que se envuelve en una barra superior delgada (mismo estilo del header del
// panel light: Row con padding 12 + borderBottom neutral-alpha-weak) con dos
// acciones — "Vista compacta" (vuelve a light, icono minimize = flechas hacia
// adentro) y "Cerrar" (colapsa a la burbuja, icono close = la X clásica de
// cerrar, para no repetir el icono minus/guion que ya usa el botón de
// minimizar del panel light). El Row que envuelve MessengerView usa flex:1 +
// minHeight:0 (no fillHeight) para que los 3 paneles internos
// (riel/lista/conversación) no desborden dentro del Row raíz de altura fija
// en px del morph.
function FullMessengerChrome({
  viewerId,
  onCompact,
  onMinimize,
}: {
  viewerId: string;
  onCompact: () => void;
  onMinimize: () => void;
}) {
  return (
    <Column fillWidth fillHeight style={{ minHeight: 0 }}>
      <Row
        fillWidth
        gap="8"
        vertical="center"
        horizontal="between"
        padding="12"
        borderBottom="neutral-alpha-weak"
      >
        <Heading variant="heading-strong-s">Mensajes</Heading>
        <Row gap="4">
          <IconButton
            icon="minimize"
            size="s"
            variant="tertiary"
            tooltip="Vista compacta"
            tooltipPosition="bottom"
            aria-label="Vista compacta"
            onClick={onCompact}
          />
          <IconButton
            icon="close"
            size="s"
            variant="tertiary"
            tooltip="Cerrar"
            tooltipPosition="bottom"
            aria-label="Cerrar"
            onClick={onMinimize}
          />
        </Row>
      </Row>
      <Row fillWidth style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <MessengerView viewerId={viewerId} />
      </Row>
    </Column>
  );
}

/**
 * Burbuja flotante de mensajes, global al sitio pero solo para sesiones
 * autenticadas (Clerk) — visitantes anónimos nunca la montan. Se puede
 * arrastrar con Pointer Events; al soltar, se imanta con una transición
 * elástica al costado izquierdo o derecho más cercano y recuerda su
 * posición. Tres estados con morph entre ellos (mismo mecanismo de
 * transición CSS de left/top/width/height/border-radius del Row raíz):
 * - closed: círculo de 40px.
 * - light: click/tap en la burbuja abre un panel chico (360x480) anclado al
 *   costado de reposo, con "Mensajes Light" (LightMessenger); sin backdrop.
 * - full: el botón "maximizar" del panel light hace morph a un panel casi a
 *   pantalla completa con la herramienta completa (MessengerView, 3
 *   paneles) y un backdrop con blur detrás (debajo del header, que sigue
 *   clickeable); desde ahí se puede "compactar" de vuelta a light o
 *   "minimizar" a la burbuja.
 */
export const FloatingChatBubble = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const pathname = usePathname();
  const [pos, setPos] = useState<StoredPos | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const [mode, setMode] = useState<Mode>("closed");
  // Qué contenido está montado ahora mismo (independiente de `mode` durante
  // el swap light<->full, que primero desvanece el contenido viejo y solo
  // después de CONTENT_FADE_OUT_MS lo reemplaza).
  const [contentMode, setContentMode] = useState<"light" | "full">("light");
  const [panelRect, setPanelRect] = useState<PanelRect | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  // Tras un arrastre real, el navegador dispara igualmente el click sintético
  // sobre el botón: se suprime para que soltar la burbuja no navegue.
  const suppressClick = useRef(false);
  // Nodo del Row raíz (burbuja/panel).
  const shapeRef = useRef<HTMLDivElement>(null);
  // Backdrop (blur + tinte) detrás del panel, SOLO en el estado full:
  // `backdropMounted` controla si se renderiza, `backdropFadeIn` su opacidad.
  // Se desacoplan para que salir de full no desmonte el nodo de golpe:
  // primero baja a opacidad 0 (en sync con el resto del morph) y solo
  // después de BACKDROP_FADE_MS se desmonta.
  const [backdropMounted, setBackdropMounted] = useState(false);
  const [backdropFadeIn, setBackdropFadeIn] = useState(false);
  const backdropTimeout = useRef<number | null>(null);
  // Timeouts del swap de contenido (fade-out -> swap -> fade-in) usados al
  // alternar entre light y full sin cerrar el panel.
  const swapTimeout = useRef<number | null>(null);
  const fadeInTimeout = useRef<number | null>(null);

  // Restaura la posición guardada (re-clampeada contra el viewport actual) o
  // cae a la posición por defecto si no hay nada guardado / localStorage falla.
  useEffect(() => {
    let restored: StoredPos | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (isStoredPos(parsed)) restored = parsed;
    } catch {
      // localStorage no disponible o valor corrupto: se usa la posición por defecto.
    }
    setPos(restored ? { side: restored.side, y: clampY(restored.y) } : defaultPos());
  }, []);

  // Re-clampea en resize de ventana (nunca detrás del header, nunca fuera del viewport).
  useEffect(() => {
    const onResize = () => {
      setPos((prev) => (prev ? { side: prev.side, y: clampY(prev.y) } : prev));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const persist = useCallback((next: StoredPos) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sin persistencia disponible: la posición sigue funcionando solo en esta sesión.
    }
  }, []);

  // Mientras el panel está abierto (light o full) la burbuja no se arrastra:
  // el pointerdown se ignora por completo (se restaura al cerrar, `pos` sigue
  // intacto).
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!pos || mode !== "closed") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      dragState.current = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        moved: false,
      };
      setDragPos({ x: rect.left, y: rect.top });
    },
    [pos, mode],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    const nextX = event.clientX - drag.offsetX;
    const nextY = event.clientY - drag.offsetY;
    setDragPos((prev) => {
      if (!prev) return prev;
      if (!drag.moved) {
        const dx = nextX - prev.x;
        const dy = nextY - prev.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
      }
      // Clamp vertical SIEMPRE durante el arrastre (nunca tapa el header, nunca
      // sale del viewport); horizontal libre dentro del viewport mientras arrastra.
      return { x: clampX(nextX), y: clampY(nextY) };
    });
  }, []);

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      const drop = dragPos;
      dragState.current = null;
      setDragPos(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (!drag || !drop) return;
      if (!drag.moved) return; // Click simple: navega (onClick), no re-snapea ni persiste.
      suppressClick.current = true;
      const side: Side = drop.x + BUBBLE_SIZE / 2 < window.innerWidth / 2 ? "left" : "right";
      const next: StoredPos = { side, y: clampY(drop.y) };
      setPos(next);
      persist(next);
    },
    [dragPos, persist],
  );

  // Abre el morph in-place (círculo -> panel light), anclado al costado de
  // reposo actual de la burbuja. Sin backdrop: el panel light es chico y no
  // bloquea el resto de la página.
  const handleActivateLight = useCallback(() => {
    if (!pos) return;
    if (fadeInTimeout.current !== null) {
      window.clearTimeout(fadeInTimeout.current);
      fadeInTimeout.current = null;
    }
    setContentMode("light");
    setPanelRect(computeLightRect(pos));
    setMode("light");
    setContentVisible(false);
    fadeInTimeout.current = window.setTimeout(() => {
      setContentVisible(true);
      fadeInTimeout.current = null;
    }, CONTENT_FADE_IN_MS);
  }, [pos]);

  // Orquesta el swap de contenido al alternar entre light y full sin cerrar
  // el panel: el contenido viejo se desvanece (CONTENT_FADE_OUT_MS), recién
  // entonces se reemplaza el componente montado (`contentMode`) y, una vez
  // que el morph de tamaño ya avanzó, se desvanece de vuelta a visible
  // (CONTENT_FADE_IN_MS). `nextRect` se aplica de inmediato para que el morph
  // de left/top/width/height empiece en paralelo al fade-out del contenido.
  const morphTo = useCallback((nextMode: "light" | "full", nextRect: PanelRect) => {
    if (swapTimeout.current !== null) window.clearTimeout(swapTimeout.current);
    if (fadeInTimeout.current !== null) window.clearTimeout(fadeInTimeout.current);
    setContentVisible(false);
    setMode(nextMode);
    setPanelRect(nextRect);
    swapTimeout.current = window.setTimeout(() => {
      setContentMode(nextMode);
      swapTimeout.current = null;
      fadeInTimeout.current = window.setTimeout(() => {
        setContentVisible(true);
        fadeInTimeout.current = null;
      }, CONTENT_FADE_IN_MS);
    }, CONTENT_FADE_OUT_MS);
  }, []);

  // Maximizar (botón del panel light): morph light -> full, con el backdrop
  // apareciendo en sincronía con el resto del morph.
  const handleExpandToFull = useCallback(() => {
    if (backdropTimeout.current !== null) {
      window.clearTimeout(backdropTimeout.current);
      backdropTimeout.current = null;
    }
    setBackdropMounted(true);
    // El nodo se monta a opacidad 0 (ver render); en el siguiente frame se
    // sube a 1 para que la transición CSS de opacity sí tenga de dónde partir.
    requestAnimationFrame(() => setBackdropFadeIn(true));
    morphTo("full", computeFullRect());
  }, [morphTo]);

  // Compactar (botón del chrome full): morph full -> light, con el backdrop
  // desvaneciéndose y desmontándose igual que al minimizar.
  const handleCompactToLight = useCallback(() => {
    if (!pos) return;
    setBackdropFadeIn(false);
    if (backdropTimeout.current !== null) window.clearTimeout(backdropTimeout.current);
    backdropTimeout.current = window.setTimeout(() => {
      setBackdropMounted(false);
      backdropTimeout.current = null;
    }, BACKDROP_FADE_MS);
    morphTo("light", computeLightRect(pos));
  }, [pos, morphTo]);

  // Minimizar (desde light o full, botón del panel o click en el backdrop):
  // el contenido y el backdrop (si estaba montado) se desvanecen primero
  // (CONTENT_FADE_OUT_MS / BACKDROP_FADE_MS) y solo después la forma colapsa
  // de vuelta a burbuja, para no ver el panel encogerse con texto todavía
  // dentro ni el blur desaparecer de golpe. Desmontar el backdrop es inocuo
  // si no estaba montado (viniendo de light).
  const handleMinimize = useCallback(() => {
    if (swapTimeout.current !== null) {
      window.clearTimeout(swapTimeout.current);
      swapTimeout.current = null;
    }
    if (fadeInTimeout.current !== null) {
      window.clearTimeout(fadeInTimeout.current);
      fadeInTimeout.current = null;
    }
    setContentVisible(false);
    setBackdropFadeIn(false);
    window.setTimeout(() => setMode("closed"), CONTENT_FADE_OUT_MS);
    if (backdropTimeout.current !== null) window.clearTimeout(backdropTimeout.current);
    backdropTimeout.current = window.setTimeout(() => {
      setBackdropMounted(false);
      backdropTimeout.current = null;
    }, BACKDROP_FADE_MS);
  }, []);

  // Recalcula el rect del panel (light o full, según el modo) si el
  // viewport cambia mientras está abierto.
  useEffect(() => {
    if (mode === "closed") return;
    const onResize = () => {
      if (mode === "light" && pos) setPanelRect(computeLightRect(pos));
      else if (mode === "full") setPanelRect(computeFullRect());
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, pos]);

  // Limpia los timeouts pendientes si el componente se desmonta con el panel
  // todavía animando (cierre, swap o desmontaje del backdrop).
  useEffect(() => {
    return () => {
      if (backdropTimeout.current !== null) window.clearTimeout(backdropTimeout.current);
      if (swapTimeout.current !== null) window.clearTimeout(swapTimeout.current);
      if (fadeInTimeout.current !== null) window.clearTimeout(fadeInTimeout.current);
    };
  }, []);

  // Bloquea el scroll del fondo SOLO en modo full: ahí el panel es
  // prácticamente pantalla completa con backdrop, así que scrollear la página
  // detrás no tiene sentido (y se ve mal debajo del blur). En light el panel
  // es chico y no bloquea nada, así que el fondo sigue scrolleable. El
  // cleanup restaura los valores previos en cualquier salida (full -> light,
  // full -> closed o desmontaje), así que no hace falta duplicar esta lógica
  // en los handlers de compactar/minimizar.
  useEffect(() => {
    if (mode !== "full") return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    // Medir el ancho de la scrollbar ANTES de ocultarla: al poner overflow
    // hidden el documento deja de tener scrollbar y clientWidth cambia, así
    // que hay que capturar la diferencia mientras el scroll todavía existe.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [mode]);

  // Solo sesiones Clerk válidas montan la burbuja; visitantes anónimos nunca la ven.
  // Dentro de /mensajes (o cualquier subruta) la burbuja es redundante: ya se está
  // en el centro de mensajes al que ella misma navega.
  const onMensajes = pathname === "/mensajes" || pathname?.startsWith("/mensajes/");
  if (!isLoaded || !isSignedIn || !pos || onMensajes || isFocusRoute(pathname)) return null;

  const dragging = dragPos !== null;
  const rect = mode !== "closed" && panelRect ? panelRect : null;
  const restingStyle: CSSProperties = dragging
    ? { left: dragPos.x, top: dragPos.y }
    : { left: restingLeft(pos.side), top: pos.y };
  const shapeStyle: CSSProperties = rect
    ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    : { ...restingStyle, width: BUBBLE_SIZE, height: BUBBLE_SIZE };

  // Imantación elástica al soltar: cubic-bezier con leve overshoot (back-out)
  // en vez de ease lineal, para que el "snap" a los bordes se sienta con
  // resorte en lugar de un desplazamiento plano.
  const ELASTIC_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  // Easing del morph de tamaño: expo-out sin overshoot (menos "rebotón" que
  // ELASTIC_EASE) — el resorte se siente bien en un punto que se imanta,
  // pero se ve raro en un panel que cambia de forma.
  const SIZE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <>
      {backdropMounted && (
        // Backdrop con blur + tinte suave detrás del panel: zIndex 7, entre el
        // Row del panel (8) y el header desktop sticky (9, Header.tsx) — el
        // header queda por encima del blur y sigue siendo clickeable. Click
        // aquí = minimizar (mismo efecto que el botón cerrar del panel).
        <Flex
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          zIndex={7}
          aria-hidden
          onClick={handleMinimize}
          style={{
            opacity: backdropFadeIn ? 1 : 0,
            transition: `opacity ${BACKDROP_FADE_MS}ms ease`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            background: "var(--neutral-alpha-weak)",
          }}
        />
      )}
      <Row
        ref={shapeRef}
        position="fixed"
        zIndex={8}
        shadow={mode !== "closed" ? "xl" : "l"}
        background={mode !== "closed" ? "surface" : undefined}
        border={mode !== "closed" ? "neutral-alpha-weak" : undefined}
        style={{
          ...shapeStyle,
          borderRadius: rect ? PANEL_RADIUS : BUBBLE_RADIUS,
          overflow: mode !== "closed" ? "hidden" : undefined,
          touchAction: mode !== "closed" ? "auto" : "none",
          cursor: mode !== "closed" ? "default" : dragging ? "grabbing" : "grab",
          transition: dragging
            ? "none"
            : [
                `left 0.42s ${ELASTIC_EASE}`,
                `top 0.32s ${ELASTIC_EASE}`,
                `width 0.4s ${SIZE_EASE}`,
                `height 0.4s ${SIZE_EASE}`,
                `border-radius 0.4s ${SIZE_EASE}`,
              ].join(", "),
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          // Con el pointer capturado sobre este Row, el click sintético (tanto de
          // mouse/touch como el generado por activación de teclado del IconButton,
          // que burbujea hasta aquí) siempre se dispara sobre el Row — nunca sobre
          // el IconButton interno. Abrir el morph aquí, no en el IconButton.
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (mode === "closed") handleActivateLight();
        }}
      >
        {mode !== "closed" ? (
          <Row
            fill
            style={{
              opacity: contentVisible ? 1 : 0,
              transition: `opacity ${contentVisible ? CONTENT_FADE_IN_MS : CONTENT_FADE_OUT_MS}ms ease`,
              minHeight: 0,
            }}
          >
            {contentMode === "light" ? (
              <LightMessenger
                viewerId={user?.id ?? ""}
                onExpand={handleExpandToFull}
                onClose={handleMinimize}
              />
            ) : (
              <FullMessengerChrome
                viewerId={user?.id ?? ""}
                onCompact={handleCompactToLight}
                onMinimize={handleMinimize}
              />
            )}
          </Row>
        ) : (
          <IconButton
            icon="chat"
            size="l"
            variant="primary"
            rounded
            aria-label="Mensajes"
            tooltip="Mensajes"
          />
        )}
      </Row>
    </>
  );
};

"use client";

import { Avatar, Column, Row, Text } from "@once-ui-system/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════════════════
 * Carrusel de testimonios con píldoras de avatar — adaptado de un componente
 * de testimonios de 21st.dev (Tailwind + `cn` de shadcn en el original).
 * Pedido "a mano" el 2026-07-28: este repo NO tiene acceso al registro de
 * 21st.dev desde este agente (el checklist de docs/originkit.md limita la
 * documentación externa a docs.once-ui.com), así que no hay una URL/slug que
 * citar aquí ni un payload de MCP que diffear a futuro — el punto de partida
 * fue la descripción funcional del componente (mecánica + capturas
 * conceptuales), no su código fuente. Si algún día se consigue el original
 * real, vale la pena diffear contra esta versión.
 *
 * Del original se conserva la mecánica, que es lo que da el carácter:
 *   · El cambio de texto en DOS TIEMPOS: clic → fade-out (opacity 0 + blur +
 *     scale .98) → a los ~200ms se sustituye el contenido (nombre/rol) →
 *     fade-in. Un `setTimeout` anidado con un flag `isAnimating` que además
 *     IGNORA clics mientras dura la transición (ver `selectPerson`).
 *   · La píldora activa (o en hover) se expande con el truco de
 *     `grid-template-columns: 0fr → 1fr` sobre un hijo con `overflow:
 *     hidden` — es lo único que permite animar un ancho "auto" en CSS puro.
 *   · `hoveredIndex` como estado SEPARADO del activo: pasar el ratón sobre
 *     una píldora inactiva también revela su nombre, sin cambiar el texto
 *     grande.
 *
 * Lo visual se descartó por completo y se reconstruyó con tokens:
 *   · `text-foreground`/`bg-muted`/`text-muted-foreground`/`bg-background` →
 *     `onBackground`/`background` semánticos de Once UI.
 *   · La píldora activa invierte fondo/texto (como el original) con
 *     `solid="neutral-strong"` + `onSolid="neutral-strong"` en vez de negro/
 *     blanco fijos — ya funciona en los dos temas.
 *   · `shadow-lg` → no se usa (las píldoras viven sobre `background="page"`
 *     del artículo, sin necesidad de elevación).
 *   · `text-2xl md:text-3xl` → `variant="display-strong-xs"`; `text-xs`/
 *     `text-sm` → `variant="label-default-s"`; `w-8 h-8` → `Avatar size="s"`.
 *   · Las comillas decorativas (`text-7xl font-serif` a opacidad .06) se
 *     retiraron: dependían de una fuente serif y un tamaño en Tailwind que no
 *     tienen equivalente en el sistema de tokens, y no forman parte de la
 *     mecánica que vale la pena conservar.
 *   · Las transiciones usan las duraciones REALES del tema (`transition`
 *     prop de Once UI: "micro-medium" = 200ms, "macro-medium" = 300ms, ver
 *     tokens.css `--transition-duration-*`) en vez de un `duration-200`
 *     arbitrario de Tailwind — con eso, `filter`/`transform`/
 *     `grid-template-columns` (que Once UI no expone como props) animan
 *     "gratis" porque la clase que generan esos props es `transition: all
 *     var(--duration) var(--eased)`.
 *
 * Añadido sobre el original, siguiendo el checklist de docs/originkit.md:
 *   · respeta `prefers-reduced-motion` (punto 3): salta directo al contenido
 *     nuevo, sin fade/blur/scale, y fuerza `transitionDuration: "0s"` en la
 *     píldora para que el ancho tampoco se anime.
 *   · limpieza de los `setTimeout` pendientes al desmontar.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CollaboratorPillPerson {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  /** Ya resuelto por quien llama (headline, o primaryRole como fallback, o
   *  `undefined` si la persona no tiene ninguno de los dos). */
  headline?: string;
}

interface CollaboratorPillsProps {
  people: CollaboratorPillPerson[];
}

/** Duración del fade-out/blur del texto grande — coincide con
 *  `--transition-duration-micro-medium` (0.2s) del tema. */
const FADE_MS = 200;

function initialsOf(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

export function CollaboratorPills({ people }: CollaboratorPillsProps) {
  const [index, setIndex] = useState(0);
  // Controla el fade-out/fade-in del texto grande; `index` solo cambia
  // DESPUÉS del fade-out, para que el contenido se sustituya mientras está
  // invisible (ver `selectPerson`).
  const [textVisible, setTextVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(
    () => () => {
      for (const id of timeoutsRef.current) window.clearTimeout(id);
    },
    [],
  );

  // Mecánica intacta del original: fade-out → (a los ~200ms) sustituir
  // contenido → fade-in, con un flag que ignora clics mientras corre.
  const selectPerson = useCallback(
    (next: number) => {
      if (next === index) return;
      if (reducedMotion) {
        setIndex(next);
        return;
      }
      if (isAnimating) return;
      setIsAnimating(true);
      setTextVisible(false);
      const hideTimeout = window.setTimeout(() => {
        setIndex(next);
        setTextVisible(true);
        const settleTimeout = window.setTimeout(() => {
          setIsAnimating(false);
        }, FADE_MS);
        timeoutsRef.current.push(settleTimeout);
      }, FADE_MS);
      timeoutsRef.current.push(hideTimeout);
    },
    [index, isAnimating, reducedMotion],
  );

  const active = people[index];

  const fadeStyle = useMemo(
    () => ({
      filter: textVisible ? "blur(0px)" : "blur(6px)",
      transform: textVisible ? "scale(1)" : "scale(0.98)",
      transitionDuration: reducedMotion ? "0s" : undefined,
    }),
    [textVisible, reducedMotion],
  );

  if (people.length === 0 || !active) return null;

  return (
    <Column fillWidth gap="24">
      <Column gap="8" opacity={textVisible ? 100 : 0} transition="micro-medium" style={fadeStyle}>
        <Text
          as="p"
          variant="display-strong-xs"
          onBackground="neutral-strong"
          wrap="balance"
          data-testid="collaborator-active-name"
        >
          {active.name}
        </Text>
        {active.headline && (
          <Text
            as="p"
            variant="label-default-s"
            onBackground="neutral-weak"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
            data-testid="collaborator-active-headline"
          >
            {active.headline}
          </Text>
        )}
      </Column>

      {people.length > 1 && (
        <Row gap="8" wrap>
          {people.map((person, i) => {
            const isActive = i === index;
            const expanded = isActive || hoveredIndex === i;
            return (
              <Row
                key={person.id}
                gap="0"
                vertical="center"
                radius="full"
                padding="4"
                cursor="interactive"
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={`Mostrar a ${person.name}`}
                data-testid={`collaborator-pill-${person.id}`}
                background={isActive ? undefined : "neutral-alpha-weak"}
                onBackground={isActive ? undefined : "neutral-strong"}
                solid={isActive ? "neutral-strong" : undefined}
                onSolid={isActive ? "neutral-strong" : undefined}
                transition="macro-medium"
                style={reducedMotion ? { transitionDuration: "0s" } : undefined}
                onClick={() => selectPerson(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectPerson(i);
                  }
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                onFocus={() => setHoveredIndex(i)}
                onBlur={() => setHoveredIndex((h) => (h === i ? null : h))}
              >
                {person.avatarUrl ? (
                  <Avatar src={person.avatarUrl} size="s" />
                ) : (
                  <Avatar value={initialsOf(person.name)} size="s" />
                )}
                <Row
                  style={{
                    display: "grid",
                    gridTemplateColumns: expanded ? "1fr" : "0fr",
                    transitionDuration: reducedMotion ? "0s" : undefined,
                  }}
                  transition="macro-medium"
                >
                  <Row overflow="hidden">
                    <Text
                      as="span"
                      variant="label-default-s"
                      wrap="nowrap"
                      paddingLeft="8"
                      paddingRight="8"
                    >
                      {person.name}
                    </Text>
                  </Row>
                </Row>
              </Row>
            );
          })}
        </Row>
      )}
    </Column>
  );
}

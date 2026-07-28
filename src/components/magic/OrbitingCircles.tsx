"use client";

import React from "react";
import classNames from "classnames";

import styles from "./OrbitingCircles.module.scss";

/*
 * Port de `orbiting-circles` de Magic UI al sistema de Once UI.
 *
 * Qué cambió respecto al original:
 *  - Cero clases de Tailwind. La presentación vive en OrbitingCircles.module.scss.
 *  - `cn()` (clsx + tailwind-merge) -> `classNames` de `classnames`, que el
 *    proyecto ya tiene como dependencia.
 *  - El color del anillo deja de ser `stroke-black/10 dark:stroke-white/10` y
 *    pasa a ser un token semántico de Once UI, configurable vía `pathColor`.
 *  - Se añade respeto por `prefers-reduced-motion`.
 *
 * Composición: el componente se pinta como capa absoluta, igual que el
 * original, para poder apilar varios anillos con distinto `radius` dentro de un
 * mismo contenedor `position: relative`.
 */

/** Tokens de color de Once UI válidos para el trazo del anillo. */
type OrbitPathColor =
  | "neutral-alpha-weak"
  | "neutral-alpha-medium"
  | "neutral-alpha-strong"
  | "brand-alpha-weak"
  | "brand-alpha-medium"
  | "brand-alpha-strong"
  | "accent-alpha-weak"
  | "accent-alpha-medium"
  | "accent-alpha-strong";

export interface OrbitingCirclesProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  children?: React.ReactNode;
  /** Invierte el sentido de giro. */
  reverse?: boolean;
  /** Vuelta completa, en segundos. */
  duration?: number;
  /** Retraso inicial de la animación, en segundos. */
  delay?: number;
  /**
   * Radio de la órbita. Un número se interpreta en píxeles; una cadena se pasa
   * tal cual como longitud CSS, lo que permite radios responsivos sin JS —
   * p. ej. `radius="min(170px, 38vw)"`.
   */
  radius?: number | string;
  /** Dibuja el anillo guía. */
  path?: boolean;
  /** Token de Once UI para el trazo del anillo. */
  pathColor?: OrbitPathColor;
  /** Lado de cada elemento en órbita, en píxeles. */
  iconSize?: number;
  /** Multiplicador de velocidad: 2 = el doble de rápido. */
  speed?: number;
}

export function OrbitingCircles({
  className,
  children,
  reverse = false,
  duration = 20,
  delay = 0,
  radius = 160,
  path = true,
  pathColor = "neutral-alpha-medium",
  iconSize = 30,
  speed = 1,
  ...props
}: OrbitingCirclesProps) {
  // `speed` es un multiplicador, así que divide. Se acota para que un 0 o un
  // negativo no produzcan una duración infinita o una animación invertida.
  const calculatedDuration = duration / Math.max(speed, 0.01);
  const count = React.Children.count(children);

  // Longitud CSS que consumen tanto las keyframes como el radio del anillo.
  const radiusLength = typeof radius === "number" ? `${radius}px` : radius;
  // Fallback para el atributo `r` del <circle> si el navegador no soporta
  // geometría SVG por CSS. Con un radio responsivo no hay número que emitir.
  const radiusAttr = typeof radius === "number" ? radius : undefined;

  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
          style={{
            position: "absolute",
            inset: 0,
            inlineSize: "100%",
            blockSize: "100%",
            pointerEvents: "none",
          }}
        >
          <circle
            className={styles.path}
            style={
              {
                stroke: `var(--${pathColor})`,
                "--orbit-radius": radiusLength,
              } as React.CSSProperties
            }
            cx="50%"
            cy="50%"
            r={radiusAttr}
          />
        </svg>
      )}

      {React.Children.map(children, (child, index) => {
        // Reparte los hijos uniformemente sobre la circunferencia.
        const angle = (360 / count) * index;

        return (
          <div
            className={classNames(
              styles.orbit,
              reverse && styles.reverse,
              className,
            )}
            style={
              {
                "--orbit-duration": calculatedDuration,
                "--orbit-delay": delay,
                "--orbit-radius": radiusLength,
                "--orbit-angle": angle,
                "--orbit-icon-size": `${iconSize}px`,
              } as React.CSSProperties
            }
            {...props}
          >
            {child}
          </div>
        );
      })}
    </>
  );
}

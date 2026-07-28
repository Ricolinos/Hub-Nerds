"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import styles from "./MediaGuard.module.scss";

/* Envoltorio del contenido publicado que dificulta llevarse las imágenes:
 *
 *   · arrastrar una imagen (al escritorio, a otra pestaña, a otra app) — se
 *     cancela el `dragstart`, con lo que además desaparece el "fantasma"
 *     translúcido que el navegador pinta bajo el cursor.
 *   · clic derecho → "Guardar imagen como…" — se cancela el `contextmenu`,
 *     pero SOLO sobre la propia imagen: sobre el texto del caso de estudio el
 *     menú sigue funcionando, porque ahí es donde el lector copia una cita o
 *     usa el corrector, y quitárselo es una molestia sin contrapartida.
 *
 * HONESTIDAD SOBRE EL ALCANCE: esto es disuasión, no protección. La imagen
 * viaja igual al navegador y se puede sacar desde devtools, desde la pestaña
 * de red, con una captura de pantalla o pidiendo la URL de `/_next/image`
 * directamente. Cierra el camino accidental y el casual; a quien se lo
 * proponga no lo detiene, y ninguna técnica del lado del cliente lo haría.
 * Si hiciera falta protección de verdad, tendría que ser del lado servidor
 * (URLs firmadas de vida corta, marca de agua, o servir resoluciones
 * reducidas), que es otra tarea.
 *
 * Va por listener delegado en un contenedor, no por props en cada `Media`: el
 * árbol del artículo lo compila MDX y sus imágenes salen de sitios muy
 * distintos (`Media`, `img` de markdown, los slides de los carousels, las
 * miniaturas de Once UI), así que un solo punto cubre todos y no se olvida
 * ninguno al añadir un bloque nuevo. */

export function MediaGuard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isMedia = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest("img, video, picture") !== null;

    const onDragStart = (e: DragEvent) => {
      if (isMedia(e.target)) e.preventDefault();
    };
    const onContextMenu = (e: MouseEvent) => {
      if (isMedia(e.target)) e.preventDefault();
    };

    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("contextmenu", onContextMenu);

    // Firefox ignora `-webkit-user-drag`, así que ahí el atributo es lo único
    // que evita el arrastre. Se aplica a las imágenes que ya existen y a las
    // que aparezcan después (slides que entran al montarse un carousel,
    // miniaturas que Once UI pinta al abrir el visor grande).
    const markImages = () => {
      for (const img of el.querySelectorAll("img")) {
        img.setAttribute("draggable", "false");
      }
    };
    markImages();
    const observer =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(markImages);
    observer?.observe(el, { childList: true, subtree: true });

    return () => {
      el.removeEventListener("dragstart", onDragStart);
      el.removeEventListener("contextmenu", onContextMenu);
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className={styles.guard} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

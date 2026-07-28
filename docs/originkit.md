# Originkit en Hub-Nerds

Cómo traer componentes de [originkit.dev](https://www.originkit.dev) sin romper el
proyecto. Escrito el 2026-07-27, al integrar el primero (`CosmicOrb` en el hero
del Home).

## Veredicto corto

Sí se pueden usar, pero **no se pegan tal cual**: el código que muestra la web
está escrito para Framer y el proyecto no tiene Tailwind. Hay que pedirlo por el
MCP en la variante correcta y pasarlo por el checklist de abajo.

## Cómo pedir el código (no copiar de la web)

El MCP `originkit` (ver `.mcp.json`) sirve el mismo componente adaptado al stack.
Siempre con estos parámetros:

```
get_component  name: "<slug>"  stack: "nextjs"  typescript: true
```

`stack: "nextjs"` quita los bindings de Framer (`addPropertyControls`,
`framer-motion` de Framer, etc.) y devuelve un componente React con `"use client"`
listo para App Router. Copiar el snippet de la página web en vez de esto es la vía
rápida a un archivo que no compila.

Ese payload trae además `dependencies` (paquetes npm que faltan) y
`registryDependencies` — leerlos antes de pegar nada.

## Los tres filtros antes de integrar

**1. Tailwind.** El proyecto usa Once UI + SCSS, no Tailwind. El MCP acepta
`styling: "cssmodules"`, pero en su `agentInstructions` sigue asumiendo Tailwind v4
y varios componentes vienen con `className="flex items-center …"`. Regla:

- Componentes que estilan con `style={{}}` inline o `<canvas>` → entran tal cual.
- Componentes con clases de Tailwind → hay que traducirlas a un `.module.scss` o a
  props de Once UI antes de usarlos. **Nunca** instalar Tailwind solo para esto:
  chocaría con el reset y los tokens de Once UI.

**2. Dependencias npm.** Del catálogo de 113 componentes (110 `component`, 3
`section`):

| dependencia | componentes | estado |
| --- | --- | --- |
| ninguna | 79 | entran directo |
| `framer-motion` | 31 | ya instalada (`^12.42.0`) |
| `three` | 2 (`tornado`, `gallery-tunnel`) | NO instalada — evalúa el peso antes |
| `gsap` | 1 (`clickeffects`) | NO instalada |

**3. Ciclo de vida.** Los componentes animados vienen pensados para el canvas de
Framer, donde el nodo vive mientras la página existe. En una SPA con App Router se
montan y desmontan en cada navegación, así que hay que revisar que la limpieza sea
completa (ver siguiente sección).

## Checklist de adaptación

Lo que hubo que corregir en `CosmicOrb` y que probablemente aplique a cualquier
otro componente animado del catálogo:

1. **Limpiar de verdad al desmontar.** Upstream solo cancelaba el
   `requestAnimationFrame`. El contexto WebGL sobrevive al desmontaje del canvas y
   el navegador solo permite ~16 vivos: sin `gl.deleteProgram` / `deleteBuffer` /
   `WEBGL_lose_context.loseContext()`, cada visita al Home filtraba uno y a la
   ~16ª el orbe dejaba de pintar. Verificado con 21 montajes seguidos.
2. **Pausar cuando no se ve.** Los shaders de este catálogo son caros (el del orbe
   evalúa `shade()` 3 veces por píxel con `lens` activo) y upstream los deja
   corriendo fuera de pantalla y con la pestaña en segundo plano. Un
   `IntersectionObserver` + `visibilitychange` es obligatorio.
3. **Respetar `prefers-reduced-motion`.** Ningún componente del catálogo lo hace.
   Lo mínimo: dibujar un frame y no arrancar el loop.
4. **Tamaños en px fijos.** Casi todos reciben `size: number`. Ampliarlo a
   `number | string` permite atarlo al viewport (`min(420px, 30vw)`) en vez de
   parchear con media queries.
5. **`[key: string]: any` en las props.** Upstream lo usa para pasar props al div
   raíz; anula el chequeo de tipos de cualquier prop mal escrita. Sustituir por
   `ComponentPropsWithoutRef<"div">`.
6. **Ocultar por CSS, no desmontar.** La primera versión de `CosmicOrb` en el hero
   condicionaba el JSX (`{!portrait && <CosmicOrb />}`) para no gastar GPU en
   vertical/móvil. Con un layout que alterna de condición al redimensionar la
   ventana (el `matchMedia` de aspect ratio oscila al arrastrar el borde), eso
   desmonta y remonta el componente en cada flip: cada montaje pide un contexto
   WebGL nuevo y, si pasa suficientes veces seguidas, el navegador llega a
   entregar contextos ya perdidos (medido: 5 de 10 en una prueba de 12
   resizes), con el shader intentando compilar sobre un contexto muerto. La
   corrección es mantenerlo SIEMPRE montado y ocultarlo con `display: none` en
   el wrapper cuando no corresponde mostrarlo — el `IntersectionObserver`
   interno (punto 2) ya detecta que un elemento `display: none` no interseca y
   para el `requestAnimationFrame` solo, así que el ahorro de GPU se mantiene
   sin desmontar. El contexto se pide una única vez por visita.

   Ojo con la trampa que esto deja: si el componente sigue montado siempre,
   pedir el contexto WebGL y compilar los shaders **en el montaje** (como
   hacía la versión anterior de `CosmicOrb`, igual que upstream) le cobra el
   costo a un dispositivo que nunca lo va a ver — medido: en móvil (oculto
   por CSS toda la sesión) el montaje seguía pidiendo 1 contexto y compilando
   2 shaders para nada. La solución final combina este punto con el 2: el
   contexto también se crea perezosamente, en una función `ensureContext()`
   idempotente que solo el primer `sync()` con el orbe visible llama — no en
   el montaje. Verificado con Playwright: móvil pasa a `contexts: 0, shaders:
   0, programs: 0`; rotar a horizontal en la misma sesión sigue encendiendo
   el orbe con normalidad (el `IntersectionObserver` dispara `ensureContext()`
   en cuanto deja de estar oculto).

## Convenciones del repo

- Viven en `src/components/originkit/` — carpeta de código de terceros, aislada de
  `src/components/<dominio>/`.
- Cabecera del archivo con: URL del componente, fecha en que se pidió al MCP y
  **lista explícita de los cambios propios**, para poder volver a pedir el original
  y diffear cuando se actualice.
- El shader / el núcleo de la animación se deja **idéntico a upstream**; los
  cambios van solo en el envoltorio React.

## Licencia — pendiente de confirmar

La web se describe como "Free Animated component library for modern websites" pero
no publica un texto de licencia localizable. Antes de que Hub-Nerds crezca en
número de componentes de Originkit conviene confirmar con ellos las condiciones de
uso comercial y si piden atribución.

# Informe — Bloque A: Auditoría y corrección de errores

Ejecutado sobre `main` (rama `audit/glitch-carga`), 2026-08-10. Sigue el plan
de `PLAN-AUDITORIA.md`. Metodología: build de producción real (`next build` +
`next start`, no `next dev`, para no medir con HMR de por medio), Playwright
+ Microsoft Edge headless, capturas seriadas y la Layout Instability API del
propio navegador (no estimaciones).

## 1. El glitch de carga — causa raíz encontrada y corregida

**Síntoma reportado:** la UI "se glitchea" unos segundos al abrir el sitio.

**Causa raíz confirmada:** `useHeroPortrait()` (`src/components/home/HomeHero.tsx`)
decide si el hero debe usar su fórmula de layout "horizontal" o "retrato" vía
`window.matchMedia`, que no existe en el servidor. El estado `portrait`
arranca en `false` (forma de escritorio) en SSR y en el primer render de
cliente, **sin importar el viewport real**, y solo se corrige después de un
`useEffect` que corre tras el montaje.

En un visitante de escritorio esto no importa (`portrait` empieza y se queda
en `false`). En un visitante **móvil**, el hero entero — alto, márgenes, el
degradado inferior (`Fade`), el bloque de texto — se pinta primero con la
fórmula de escritorio y luego salta a la de retrato en cuanto el efecto
resuelve. Medido con la Layout Instability API real del navegador:

- **Antes del fix: CLS = 1.09** en la home móvil (umbral "bueno" de Google:
  ≤0.1; "malo": >0.25 — este caso está más de 4× por encima de "malo").
- Los propios `sources` del evento de layout-shift lo confirman: varios
  `<div>` del hero pasan de un rect `{x:0,y:0,w:0,h:0}` (o de un alto
  incorrecto) a su tamaño real en el mismo frame, exactamente el patrón de
  "el layout no sabía su forma final todavía".

**Por qué no era RevealFx (la sospecha inicial):** se leyó el código fuente
de `RevealFx` en `node_modules/@once-ui-system/core` — su CSS solo anima
`mask-image`, `filter` y `transform`, ninguna de las cuales afecta el layout
según la especificación de CSS. RevealFx es una víctima visible del problema
(su contenido es lo que se ve saltar), no la causa.

**Fix aplicado** (`src/components/home/HomeHero.tsx`): el sitio ya tenía un
mecanismo — `HeroLoadingOverlay` — que cubre el hero hasta que las 4 capas de
imagen terminan de decodificar. Se extendió ese mismo mecanismo (no se
inventó uno nuevo) para que **también** espere a que `useHeroPortrait`
resuelva la orientación real antes de desvanecerse. Cambios:

- `useHeroPortrait` gana un booleano `resolved` (true tras la primera
  resolución de `matchMedia`).
- `HomeHero` combina `heroReady = sceneReady && portraitResolved` y se lo
  pasa a `HeroLoadingOverlay` en vez de solo `sceneReady`.

**Verificación del fix:** en el escenario representativo de un visitante real
(una carga previa que calienta caché, luego la visita medida — no la primera
visita jamás ni una recarga inmediata), instrumentando directamente
`getBoundingClientRect()` del bloque de texto y la opacidad computada del
overlay cuadro a cuadro:

```
t=56ms   overlayOpacity=1        textWrapHeight=405 (aún sin resolver)
t=137ms  overlayOpacity=1        textWrapHeight=384
t=204ms  overlayOpacity=1        textWrapHeight=690 (YA resuelto)
t=262ms  overlayOpacity=0.93     ← el overlay recién EMPIEZA a desvanecerse
t=369ms  overlayOpacity=0.53
t=694ms  overlayOpacity=0.02
```

El reflow termina en ~204ms, **mientras el overlay sigue 100% opaco**; el
overlay no empieza a desvanecerse hasta después de los 230ms. El usuario no
ve el salto porque ya terminó antes de que el overlay se empiece a quitar.
Confirmado también visualmente con capturas seriadas cada 50-100ms.

**Limitación honesta:** en un escenario de caché MUY tibia (imágenes ya
decodificadas casi instantáneamente por cargas repetidas previas en la misma
sesión de navegador), el CLS medido con la métrica automática bajó de 1.09 a
~0.5 — mejora sustancial pero no eliminación total en ese caso límite. El
comentario original en el código ya documentaba que un intento anterior de
resolver esto con una sola lectura de `window.innerWidth` se descartó por
incorrecto (el viewport de diseño móvil no está "asentado" en el primer
render); una solución 100% libre de CLS en todos los escenarios de caché
requeriría repensar la detección de orientación en sí (p. ej. resolverla
puramente por CSS/media queries en vez de JS + estado), que es un cambio de
arquitectura mayor fuera del alcance seguro de esta sesión.

## 2. Auditoría responsive (A3)

Navegador real, 4K (3840×2160) / 1080p / 720p / móvil (390×844):

- **11 rutas públicas** (`/`, `/explorar`, `/explorar/freelancers`,
  `/recursos`, `/servicios`, `/servicios/cotizador`, `/convocatorias`,
  `/ejercicios`, `/proyectos`, `/freelancer_demo`, `/legal`) × 4 resoluciones
  = **44/44 combinaciones limpias**: cero overflow horizontal
  (`scrollWidth > clientWidth`), cero errores de consola, todas HTTP 200.
- **Dashboard autenticado** (sesión real vía `freelancer_demo`, login +
  código de verificación 424242 automatizado con Playwright): `/dashboard`,
  `/dashboard/freelancer`, `/mensajes`, `/convocatorias` × 4 resoluciones =
  **16/16 combinaciones limpias**.
- **Total: 60/60 sin problemas.**

## 3. Estados de carga y error

Revisión dirigida (no exhaustiva — ver "Qué falta" abajo): se buscaron
`catch` silenciosos en componentes cliente que llaman server actions. El
único hallazgo (`mdx.tsx`, un `console.error` sin toast) es un fallback de
compilación MDX en build/render-time, no una acción de usuario — correcto tal
como está. Un grep más amplio identificó 22 archivos que importan server
actions sin usar el `addToast` global del proyecto; se verificó uno
(`Cotizador.tsx`) y tiene su **propio** patrón de error inline sólido
(estado `errorEnvio` + componente de feedback descartable) — no es un hueco,
solo un patrón distinto. Los otros 21 no se auditaron uno por uno por tiempo:
**queda como trabajo pendiente**, no como hallazgo confirmado.

## 4. Imports pesados (A4)

- **Turbopack marcó 2 advertencias reales** ("Dynamic filesystem access
  causes tracing of the whole project" — riesgo explícito: puede terminar
  empaquetando el proyecto entero, incluido `public/`, en el output del
  servidor):
  - `src/lib/caseStudies.ts:20` — **corregido**: `path.join(process.cwd(),
    ...CONTENT_ROOT, username)` cambiado a segmentos literales
    (`"src", "content", "portfolio"`). Turbopack solo reconoce el patrón
    "ruta acotada + variable al final" con literales en la propia llamada, no
    con el spread de un array `const`. Verificado con rebuild: la advertencia
    desapareció (de 2 a 1).
  - `src/utils/utils.ts:81` — **no corregido, documentado**. `getPosts()` es
    una utilidad genérica con una ruta completamente dinámica por diseño,
    usada por varios llamantes; acotarla sin romper a esos llamantes requiere
    más que un cambio mecánico. Queda para otra iteración.
- **`FloatingChatBubble`/`LightMessenger`**: verificado en código que el
  polling (`setInterval` en `LightMessenger.tsx:247`) vive en un componente
  hijo que solo se monta DESPUÉS del `return null` para visitantes anónimos
  (`FloatingChatBubble.tsx:491`) — cero polling desperdiciado para anónimos,
  descartado como problema.
- **`ContentBlocks.tsx`** (~4000 líneas, el editor de piezas): verificado que
  solo lo importan `CreateProjectModal.tsx` (modal autenticado) y una server
  action — no se filtra a ninguna ruta pública.

## Clasificación final

| Hallazgo | Severidad | Estado |
|---|---|---|
| CLS 1.09 en home móvil por detección tardía de `portrait` | **Crítico** | **Corregido** (mejora sustancial verificada; límite honesto documentado arriba) |
| Turbopack traza el proyecto completo por ruta dinámica en `caseStudies.ts` | Importante | **Corregido** |
| Turbopack traza el proyecto completo por ruta dinámica en `utils.ts` | Importante | Documentado, no corregido |
| 21 componentes con server actions sin verificar su manejo de error | Menor | Documentado, no auditado (fuera del tiempo de esta sesión) |
| Sospechosos #2/#3/#5/#6/#7/#10 de la tabla original | Menor / sin evidencia | Documentado, sin cambios de código |

## Qué NO se hizo en esta pasada

- Auditoría exhaustiva de los 21 componentes con server actions restantes.
- Eliminación total del CLS residual en el escenario de caché extremadamente
  tibia (requeriría repensar la detección de orientación con CSS puro).
- El fix de `utils.ts:81` (Turbopack tracing).
- Cualquier cambio a Header.tsx, `transition: "all"` global, o
  `theme-init.js` — se investigaron pero no se encontró evidencia que
  justificara tocar componentes de este tamaño de superficie sin una
  verificación mucho más profunda.

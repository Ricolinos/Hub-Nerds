# PLAN — Auditoría + Views/Likes en case studies

> Solo planeación: nada de lo descrito aquí está implementado. Preparado tras
> leer el código actual (layout.tsx, theme-init.js, Providers, RouteGuard,
> Header, LayoutShell, HeroParallax/HomeHero, prisma/schema.prisma,
> lib/portfolio.ts) y la memoria del proyecto (flujo dev→main, BD compartida
> entre prod y dev, gotchas de Once UI, migraciones en ramas = drift).

---

## BLOQUE A — Auditoría y corrección de errores → `main`

### A0. Evidencia ya recogida (lectura de código, no especulación)

Sospechosos del "glitch" de apertura, ordenados por probabilidad. La fase A1
los confirma/descarta midiendo; las fases siguientes corrigen los confirmados.

| # | Sospechoso | Archivo:línea | Qué hace hoy | Por qué produce "glitch" |
|---|------------|---------------|--------------|--------------------------|
| 1 | `RevealFx` envolviendo el `Background` global | `src/app/layout.tsx:124` | El fondo de TODAS las páginas (dots/gradient) entra con animación de opacidad en cada carga | El fondo "aparece" tarde sobre el color base → primer segundo con página plana que luego se enciende. La memoria de gotchas de Once UI ya advierte sobre `RevealFx` |
| 2 | Header con 5 `useState(false)` + `useEffect` | `src/components/Header.tsx:353-412` | `isMobile`/`isCompact`/`scrolled` arrancan en `false` en SSR y se corrigen tras montar | En móvil el primer paint muestra el header de ESCRITORIO y salta al móvil al hidratar. En desktop, `scrolled` corrige el backdrop tras montar |
| 3 | Clerk `isLoaded` en Header | `src/components/Header.tsx:169,359` | Botones Iniciar sesión/Registrarse y chip de usuario dependen de `useUser()` | La zona de auth del header aparece/cambia ~1-2 s después del primer paint |
| 4 | `HeroLoadingOverlay` + RevealFx del hero | `src/components/home/HomeHero.tsx` | Overlay `#04080e` con ProgressBar hasta decodificar 4 capas webp; luego animaciones de entrada | En la home el usuario ve: overlay de carga → fade → animaciones. Es intencional, pero SUMADO a 1-3 se percibe como "la UI se glitchea unos segundos" |
| 5 | Flicker one-time por overrides viejos en localStorage | `src/components/Providers.tsx` (comentario lo documenta) | `theme-init.js` pinta marca vieja un instante si hay overrides guardados; se autolimpia | Visitantes recurrentes de antes del cambio de marca lo ven UNA vez. Verificar si aún hay visitantes afectados o si ya es ruido |
| 6 | `transition: "all"` global | `src/resources/once-ui.config.ts` (style.transition) | Once UI habilita transiciones CSS en todo | Los ajustes de atributos data-* durante la hidratación pueden ANIMARSE en vez de aplicarse en seco → sensación de "acomodo" |
| 7 | Fuentes con `display: swap` | `once-ui.config.ts:62-86` | Space Grotesk/Geist/Inter/Geist Mono vía next/font | FOUT: texto con fuente de sistema → swap. next/font ya hace preload; impacto menor, medir CLS |
| 8 | Espaciador móvil sospechoso | `src/app/layout.tsx:169` | `<Flex s={{ hide: false }} minHeight="48" />` SIN `hide` base | Si el default de `hide` no es `true`, este bloque de 48px se renderiza TAMBIÉN en desktop (doble espacio bajo el header). Verificar contra la API real de Flex 1.8.2 |
| 9 | `suppressHydrationWarning` en `<html>` y `<body>` | `src/app/layout.tsx:78,122` | Silencia mismatches de hidratación | No causa glitch, pero OCULTA los que existan. La auditoría debe quitarlos temporalmente para aflorar mismatches reales |
| 10 | `theme-init.js` parchea `console.error` | `public/theme-init.js` | Filtra un warning conocido de React 19/Next | Riesgo de tragarse errores legítimos si el filtro matchea de más; revisar que el match sea exacto |

Descartados con evidencia: flash de tema (theme-init.js fuerza `data-theme="dark"`
pre-hidratación, correcto); `ssr: false`/`next/dynamic` (cero usos en `src/`).

### A0-bis. Veredictos tras ejecutar A1-A4 (2026-08-10)

**Ver informe completo en `INFORME-AUDITORIA.md`.** Resumen:

| # | Sospechoso | Veredicto |
|---|---|---|
| **Detección de `portrait` en HomeHero (bug real, no estaba en la tabla original)** | **CONFIRMADO — crítico, corregido.** `useHeroPortrait` arrancaba en `portrait:false` sin importar el viewport real; en móvil eso pintaba TODO el hero con la fórmula de escritorio y saltaba a la de retrato tras un efecto post-montaje. Medido con Playwright: **CLS = 1.09** en la home móvil (umbral "malo" de Google: 0.25). Fix: `HeroLoadingOverlay` ahora también espera a que la orientación se resuelva antes de desvanecerse, igual que ya esperaba a que las imágenes cargaran. Verificado: en el escenario representativo (una visita, caché tibia) el reflow termina en ~200ms mientras el overlay sigue 100% opaco. CLS residual bajo ciertas condiciones de caché muy tibia: ~0.5 (mejora sustancial, no eliminación total — ver informe). |
| 1. RevealFx del Background global | Descartado — su CSS (`mask`/`filter`/`opacity`/`transform`) no afecta layout (leído en `RevealFx.module.scss` del paquete) |
| 8. Espaciador móvil duplicado en desktop | Descartado — medido: 0px en desktop, 45px en móvil, comportamiento correcto |
| 9. `suppressHydrationWarning` ocultando mismatches | Descartado — se quitó temporalmente, se reconstruyó, cero mismatches en `/`, `/explorar`, `/freelancer_demo` |
| 2, 3, 5, 6, 7, 10 | Sin evidencia de impacto medible; no se tocó código (varios implican cambios de alcance global de alto riesgo) |
| **Imports pesados (A4)** | 2 advertencias reales de Turbopack ("Dynamic filesystem access causes tracing of the whole project") en `caseStudies.ts`/`utils.ts`. Corregida la de `caseStudies.ts` (segmentos de ruta literales en vez de spread de un array `const`); la de `utils.ts` queda documentada (afecta una utilidad genérica usada por varios llamantes). `FloatingChatBubble`/`LightMessenger`: verificado que el polling NO se monta para visitantes anónimos. `ContentBlocks.tsx`: verificado que solo se importa desde el modal de edición autenticado, no se filtra a rutas públicas. |
| **Responsive (A3)** | 60/60 combinaciones limpias (11 rutas públicas × 4 resoluciones + 4 rutas de dashboard autenticado × 4 resoluciones): cero overflow horizontal, cero errores de consola. |

### A1. Fase 1 — Medición y diagnóstico (sin tocar código de producto)
- **Rama**: `audit/glitch-carga` (desde `main`).
- **Archivos**: solo scripts temporales en `$CLAUDE_JOB_DIR/tmp` (Playwright +
  Edge headless, receta de memoria) + notas en este archivo.
- **Cambio**: grabar la carga de `/`, `/explorar` y una página de perfil en
  frío (cache deshabilitada) y en caliente, en desktop y móvil: screenshots
  seriados (0.25 s), consola completa, métricas CLS/LCP vía Performance API,
  y una corrida con `suppressHydrationWarning` quitado localmente para aflorar
  mismatches. Marcar cada sospechoso de A0 como CONFIRMADO/DESCARTADO.
- **Criterio de aceptación**: tabla A0 actualizada con veredicto y evidencia
  (screenshot o log) por fila; lista cerrada de hallazgos clasificados
  crítico/importante/menor con archivo:línea y causa raíz.

### A2. Fase 2 — Fixes del glitch de carga (solo confirmados en A1)
- **Rama**: la misma `audit/glitch-carga`.
- **Archivos previstos** (según qué confirme A1):
  - `src/app/layout.tsx` — quitar/condicionar el `RevealFx` del Background
    global (el fondo debe estar YA pintado en el primer frame); revisar el
    espaciador móvil (#8).
  - `src/components/Header.tsx` — SSR-first: derivar `isMobile`/`isCompact`
    de CSS (breakpoints de Once UI, `s={{...}}`) en vez de `useState` +
    `useEffect` donde sea posible; reservar espacio fijo para la zona de
    Clerk (skeleton con las mismas dimensiones) para eliminar el salto.
  - `once-ui.config.ts` — evaluar `transition: "micro"` o gatear la
    transición global hasta después de la hidratación.
- **Criterio de aceptación**: en la grabación seriada post-fix no hay ningún
  reflow visible después del primer paint salvo los intencionales (overlay de
  carga del hero); CLS < 0.1 en las 3 rutas; cero hydration mismatches con
  `suppressHydrationWarning` quitado; cero errores/warnings de consola.

### A3. Fase 3 — Responsive, estados de carga y error
- **Rama**: la misma.
- **Cambio**: barrido con navegador real en 4K/1080p/720p/390px (regla de
  memoria) sobre las rutas públicas + dashboard con `partner_demo` (solo
  local): overflow horizontal (`scrollWidth > clientWidth`), estados de carga
  faltantes (fetches sin skeleton/spinner), y estados de error sin manejar
  (rechazos de server actions sin toast/mensaje). Se corrigen los de nivel
  crítico/importante; los menores quedan listados para otra iteración.
- **Criterio de aceptación**: cero overflow en las 4 resoluciones; cada
  fetch visible al usuario tiene estado de carga; cada server action invocada
  desde UI tiene camino de error visible (toast o mensaje inline).

### A4. Fase 4 — Imports pesados
- **Cambio**: `next build` + análisis del tamaño por ruta (salida del build);
  candidatos a revisar: `ContentBlocks.tsx` (~4 000 líneas, ¿se cuela en
  bundles fuera del editor?), `FloatingChatBubble` (montado en el layout
  raíz para TODAS las páginas — verificar que corto-circuite sin sesión y no
  arranque su polling de 4 s para visitantes anónimos).
- **Criterio de aceptación**: first-load JS de `/` no crece y se documenta
  cada candidato con su veredicto (diferido, eliminado o justificado).

### A5. Entrega del Bloque A
- PR `audit/glitch-carga` → **`main`** (main está protegido: siempre vía PR).
- **Nota de flujo**: la memoria dice "commits primero a dev", pero aquí el
  destino pedido es `main`; hoy `dev` y `main` tienen el mismo contenido
  (PR #129 mergeado), así que tras mergear a `main` hay que **sincronizar dev
  de vuelta** (merge main→dev o PR espejo) para no divergir.
- **Orden con el PR #131 pendiente** (once-ui 1.8.2, draft a main): decidir
  antes de empezar — si #131 se mergea primero, la rama de auditoría se crea
  encima; si no, la auditoría debe correr con Once UI 1.7.13 y re-verificarse
  tras #131. Recomendado: mergear #131 primero (ya está verificado) y auditar
  sobre ese estado.

---

## BLOQUE B — Views y Likes en case studies → `dev`

### B0. Estado actual (leído del código)
- `PortfolioPiece` YA tiene `views Int @default(0)` y `likes Int @default(0)`
  (`prisma/schema.prisma:126-127`) y los contadores YA se pintan en las
  tarjetas (`HomeShowcase`, `ExploreFeed`, `ProfileView`) — pero **nada los
  incrementa**: son ceros decorativos (memoria: "likes sin persistir").
- La página del case study (`src/app/[username]/proyecto/[slug]/page.tsx`)
  hoy NO muestra ninguna métrica.
- Convención del schema para relaciones usuario↔entidad: tabla puente con
  `@@unique([a, b])` (8 precedentes, p.ej. `@@unique([clientId, freelancerId])`).

### B1. Diseño de datos (decisión y justificación)
- **Vistas: campo contador** (`views`, ya existe) con incremento atómico
  (`update { views: { increment: 1 } }`). Se DESCARTA la tabla de eventos:
  no hay necesidad analítica declarada, la BD es compartida prod/dev (una
  tabla de eventos crece sin límite y castiga el plan de Supabase) y el
  requisito anti-inflado se resuelve sin persistir eventos (cookie, abajo).
- **Likes: tabla puente nueva `PieceLike`** — `id`, `userId`, `pieceId`,
  `createdAt`, `@@unique([userId, pieceId])`, relaciones con
  `onDelete: Cascade` en ambos lados (consistente con el resto del schema).
  El contador `likes` se mantiene denormalizado y se actualiza en la MISMA
  transacción que crea/borra la fila (lecturas baratas en tarjetas sin
  `_count` por pieza; la tabla puente es la fuente de verdad, el contador es
  cache — si divergen, se recalcula con un script one-off).
- **Anti-inflado de vistas**: cookie httpOnly `pv_<pieceId>` con
  `Max-Age = 3600` (1 h — **decidido**) que el route handler consulta antes
  de incrementar: si existe, no cuenta. Anónimo, sin login, sin persistencia
  server-side. Protege contra recargas; NO contra bots ni incógnito (ver
  "No incluido").
- **El dueño no cuenta** (**decidido**): ni sus vistas ni su like. El route
  handler de vistas resuelve la sesión con `auth()` de Clerk y, si el
  visitante es el dueño de la pieza, no incrementa; la server action de like
  rechaza `pieceId` propio y la UI ni siquiera ofrece el botón activo en
  piezas propias.

### B2. Fase 1 — Migración de Prisma
- **Rama**: `feat/views-likes` (desde `dev` — crear con
  `git worktree add ... dev` según la receta de memoria: el modo fresh de
  EnterWorktree parte de main).
- **Archivos**: `prisma/schema.prisma` (modelo `PieceLike` + relación en
  `User` y `PortfolioPiece`), `prisma/migrations/<ts>_add_piece_likes/`.
- **⚠️ Gotcha de memoria**: `prisma migrate dev` desde la rama aplica a la BD
  COMPARTIDA real (prod y dev usan la misma Supabase; ya pasó dos veces).
  La migración es puramente ADITIVA (tabla nueva, cero cambios a columnas
  existentes), así que aplicarla desde la rama es seguro para el código en
  producción — pero debe hacerse UNA vez, avisando antes, y jamás aceptar
  `migrate reset`. El archivo de migración viaja en el PR para que dev/main
  queden sincronizados con la BD.
- **Criterio de aceptación**: `npx prisma migrate status` limpio; el código
  en producción actual sigue funcionando contra la BD migrada (verificar la
  home y un case study en prod tras aplicar).

### B3. Fase 2 — Registro de vistas
- **Archivos**: route handler nuevo `src/app/api/pieces/[id]/view/route.ts`
  (POST; route handler y no server action porque necesita leer/escribir la
  cookie de dedupe y responder rápido sin re-render). Dentro: cookie de
  dedupe (1 h) + exclusión del dueño (`auth()`: si el userId de la sesión es
  el `userId` de la pieza, no cuenta). Componente cliente mínimo
  `RegisterView` (un `useEffect` que hace `fetch` al handler una sola vez,
  con guard contra el doble-invoke de StrictMode en dev) montado en la página
  del case study; verificación de que el middleware de Clerk deja pasar la
  ruta sin sesión.
- **Criterio de aceptación**: abrir un case study incrementa `views` en 1;
  recargar inmediatamente NO incrementa (cookie); tras 1 h vuelve a contar;
  funciona sin sesión iniciada; el dueño abre su propia pieza y `views` NO
  cambia; el contador de la tarjeta en `/explorar` refleja el valor (con el
  desfase de ISR aceptado, ver Riesgos).

### B4. Fase 3 — Like con toggle
- **Archivos**: server action nueva `src/app/actions/likes.ts`
  (`toggleLike(pieceId)`: transacción crear/borrar `PieceLike` + `increment`/
  `decrement` del contador; `auth()` de Clerk obligatorio; **rechaza el like
  a piezas propias** — regla en servidor, no solo en UI); componente
  `LikeButton` cliente (corazón de `iconLibrary` — verificar que exista o
  añadirlo en `src/resources/icons.ts`, patrón `IconButton`/`Row` de Once UI,
  NUNCA Tailwind) con UI optimista: estado local que cambia al instante y se
  revierte si la action rechaza, con toast de error (`ToastProvider` ya
  montado en Providers). En piezas del propio dueño el botón no se ofrece
  activo: solo se muestra el contador.
- **No logueado**: el botón se muestra igual pero al tocarlo lleva a
  `/sign-in` con `redirect_url` de vuelta al case study (mismo patrón de auth
  que ya usa el Header).
- **Criterio de aceptación**: usuario logueado da like → corazón lleno y
  contador +1 al instante, persiste tras recargar; segundo click lo quita;
  un usuario = máximo 1 like por pieza (garantizado por el `@@unique`, no
  solo por UI); no logueado ve la invitación a iniciar sesión y su click no
  escribe nada; el dueño no puede darse like ni desde la UI ni llamando la
  action directamente; si la action falla (red), el corazón se revierte y
  sale toast.

### B5. Fase 4 — Superficies de lectura
- **Archivos**: página del case study (fila de métricas: ícono ojo + views,
  LikeButton + likes, con componentes Once UI consistentes con la página);
  `ExploreFeed`/`HomeShowcase`/`ProfileView` ya pintan los números — solo
  verificar que el dato llegue fresco. El estado "liked por mí" vive SOLO en
  el case study (**decidido**): las tarjetas del feed muestran únicamente el
  número, sin query extra de `PieceLike` por usuario.
- **Criterio de aceptación**: los contadores del case study y de `/explorar`
  muestran los valores reales de BD; cero overflow nuevo en móvil (verificado
  en las 4 resoluciones de rigor).

### B6. Entrega del Bloque B
- PR `feat/views-likes` → **`dev`**; verificación en `dev.hub-nerds.com`
  (deploy READY antes de dar por cerrado, receta de memoria); la promoción
  dev→main queda para cuando el usuario lo decida.

---

## Orden global recomendado

1. **Yo integro el PR #131** al arranque (**decidido**): lo marco ready,
   lo mergeo a `main` (once-ui 1.8.2, ya verificado) y sobre ese estado
   arranca el Bloque A.
2. Sincronizar `dev` con `main` (quedan idénticos otra vez).
3. **Bloque A** completo en `audit/glitch-carga` → PR a `main` → merge →
   sincronizar `dev` de vuelta.
4. **Bloque B** en `feat/views-likes` (desde el `dev` ya sincronizado, para
   que la auditoría de carga no choque con el nuevo case study) → PR a `dev`.
5. Promoción dev→main del Bloque B cuando se apruebe visualmente.

La migración (B2) puede aplicarse en cualquier punto por ser aditiva, pero
conviene hacerla justo antes de B3 para minimizar la ventana en que la BD
tiene una tabla que ningún código usa.

## Riesgos

- **BD compartida prod/dev**: la migración de B2 toca producción en el
  momento de aplicarse. Aditiva = segura, pero es el paso más delicado del
  plan; se hace con aviso y verificación inmediata de prod.
- **ISR de la home (`revalidate = 300`)**: los contadores en la home pueden
  atrasarse hasta 5 min respecto a la BD. Aceptado (mismo criterio que la
  aparición de piezas nuevas); `/explorar` a verificar según su estrategia de
  render.
- **Doble conteo en desarrollo**: StrictMode monta los efectos dos veces; el
  guard del `RegisterView` debe cubrirlo o los números de dev se inflan.
- **Bots**: el dedupe por cookie no filtra crawlers. Los números pueden
  inflarse con tráfico no humano (ver "No incluido").
- **A2 toca el Header**, el componente más compartido del sitio: cualquier
  regresión se ve en todas las páginas. Verificación en las 4 resoluciones +
  sesión iniciada/anónima obligatoria antes del PR.
- **Fase A y B en paralelo** tocarían la página del case study (A3 estados de
  carga, B5 métricas) — por eso el orden serializa A antes que B.

## Decisiones tomadas (dudas resueltas, 2026-08-10)

1. **Ventana anti-inflado**: 1 hora. ✔
2. **El dueño no cuenta**: ni sus vistas ni su like (regla en servidor +
   UI sin botón activo en piezas propias). ✔
3. **Sin notificaciones de like** por ahora — queda en "No incluido". ✔
4. **"Liked por mí" solo en el case study**; tarjetas del feed muestran solo
   el número. ✔
5. **El PR #131 lo integro yo al arranque** del Bloque A. ✔

## Qué NO está incluido

- Protección anti-bots real (rate-limit por IP, verificación de user-agent,
  Turnstile) — solo el dedupe por cookie.
- Tabla de eventos / analítica de vistas (quién, cuándo, de dónde).
- Migrar los "likes" decorativos de `ResourceFeed` (recursos) — esto cubre
  SOLO PortfolioPiece; recursos sigue mock como hasta hoy.
- Notificaciones de like (decisión 3: fuera por ahora; si algún día se
  quiere, es una fase pequeña sobre el modelo `Notification` existente).
- Fixes de hallazgos "menores" de A3: quedan documentados, no corregidos.
- Tema claro / reactivación del theme switcher (el sitio sigue fijo en dark).

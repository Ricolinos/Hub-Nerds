# Traducir Magic UI a Once UI

Este proyecto **no usa Tailwind** y no lo va a usar. Motivo medido: `styles.css` de
Once UI es en sí mismo un framework de utilidades (1291 clases con nombres con
forma de Tailwind). Al cruzar 12 componentes de Magic UI contra él aparecieron
**17 colisiones exactas** — `p-4`, `px-4`, `mt-8`, `flex-row`, `justify-center`,
`opacity-0`, `overflow-hidden`, `top-0`, `left-0`, `cursor-pointer`, `button`… —
con semántica distinta:

| Clase | Once UI | Tailwind |
|---|---|---|
| `.p-4` | `var(--static-space-4)` = **0.25rem** | **1rem** |

Cuatro veces de diferencia, en una clase que Once UI genera en runtime
(`<Flex padding="4">` → `class="p-4"`) y que el repo usa **453 veces**. La
colisión no da error de build: solo re-espacia el sitio según quién gane la
cascada.

Por eso los componentes externos se **portan**, no se instalan.

## Protocolo

1. **Comprobar que Once UI no lo cubra ya.** Ver la tabla de abajo. Once UI trae
   129 componentes; Magic UI, 77. El solape es grande.
2. **Traer el original** — `curl -s https://magicui.design/r/<nombre>.json`, o el
   MCP `magicui` (`getRegistryItem`), que devuelve metadata y dependencias.
3. **Traducir**, con estas equivalencias fijas:

   | Magic UI (Tailwind) | Once UI |
   |---|---|
   | clases utilitarias | props de layout (`<Column gap="16">`) o CSS Module |
   | `cn()` (clsx + tailwind-merge) | `classNames` de `classnames` (ya es dependencia) |
   | `dark:` variants | nada — los tokens ya conmutan con `[data-theme]` |
   | `#ffaa40`, `stroke-black/10` | `var(--brand-alpha-medium)`, `var(--neutral-alpha-medium)` |
   | `motion/react` | `framer-motion` (misma librería, ya instalada) |
   | `next-themes` | el `ThemeProvider` de Once UI |
   | `size-*`, `inset-0` | `inline-size` / `block-size`, props `fill` / `position` |

4. **Reglas que no se negocian:** cero hex y cero rgb — todo color sale de un
   token; la geometría va en un `.module.scss`; se respeta
   `prefers-reduced-motion`; y la API de props se nombra como Once UI
   (`pathColor="neutral-alpha-medium"`, no `pathClassName="stroke-white/10"`).
5. **Probar en `/lab`** antes de usarlo en producción.

## Qué NO hay que portar (Once UI ya lo cubre)

Candidatos a revisar antes de clonar nada — verificar el match caso por caso:

| Magic UI | Equivalente en Once UI |
|---|---|
| `magic-card`, `glare-hover` | `TiltFx` + `HoloFx` + `CursorCard` |
| `border-beam`, `shine-border` | `ShineFx` |
| `number-ticker` | `CountFx` |
| `typing-animation` | `TypeFx` |
| `hyper-text`, `text-animate`, `word-rotate` | `LetterFx`, `FadingLettersFx` |
| `blur-fade`, `text-reveal` | `RevealFx`, `Fade` |
| `marquee`, `scroll-based-velocity` | `AutoScroll`, `Scroller`, `InfiniteScroll` |
| `animated-list` | `InfiniteScroll` + `RevealFx` |
| `confetti` | `CelebrationFx` |
| `particles` | `Particle` |
| `dot-pattern`, `grid-pattern`, `retro-grid` | `Background` (dots / grid / lines) |
| `animated-circular-progress-bar` | `RadialGauge` |
| `scroll-progress` | `ProgressBar` |
| `smooth-cursor`, `pointer` | `Cursor` |
| `ripple` | `Pulse` |
| `progressive-blur` | `Mask` |
| `bento-grid` | `Grid`, `MasonryGrid` |
| `avatar-circles` | `AvatarGroup` |
| `code-comparison` | `CodeBlock` + `CompareImage` |
| `animated-theme-toggler` | `ThemeSwitcher` |
| `glyph-matrix` | `MatrixFx` |
| `hero-video-dialog` | `Modal` + `Media` |
| `tweet-card` | `OgCard` |
| botones (`shimmer`, `rainbow`, `pulsating`, `ripple`, `shiny`) | `Button` + `ShineFx` / `Pulse` |

## Huecos reales (sí vale la pena portar)

`orbiting-circles` ✅ (hecho) · `animated-beam` · `dock` · `globe` · `icon-cloud` ·
`meteors` · `lens` · `terminal` · `file-tree` · `safari` / `iphone` / `android`
(mockups) · `video-text` · `pixel-image` · `highlighter` · `light-rays` ·
`backlight` · `warp-background` · `flickering-grid` · `noise-texture` ·
`hexagon-pattern` / `striped-pattern` / `interactive-grid-pattern` · `dotted-map` ·
`aurora-text` / `line-shadow-text` / `morphing-text` / `spinning-text` /
`comic-text` / `kinetic-text` / `text-3d-flip` · `cool-mode`

## Coste de rendimiento

Portar no añade JS: el peso está en la animación, no en el CSS. Antes de meter
uno de estos en una página con tráfico, medir en móvil — varios (`meteors`,
`particles`, `animated-beam`) animan decenas de elementos en loop infinito.
`OrbitingCircles` es barato: solo `transform` sobre N nodos, con `will-change` y
apagado bajo `prefers-reduced-motion`.

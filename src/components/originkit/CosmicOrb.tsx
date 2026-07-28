"use client";

/**
 * ⚠️ SIN USO. Este componente NO se renderiza en ninguna parte del sitio.
 *
 * Estuvo en el hero del Home y se retiró el 2026-07-27 (daba más problemas de
 * los que compensaba). Se conserva a propósito, por si se decide volver a
 * montarlo; ver "Estado actual" en docs/originkit.md para los pasos que hacen
 * falta además de renderizarlo. Si acabas aquí buscando por qué el hero no
 * muestra un orbe: es intencional, no está roto.
 *
 * Cosmic Orb — vendorizado de Originkit (https://www.originkit.dev/components/cosmic-orb),
 * variante `stack: nextjs` servida por su MCP el 2026-07-27. Cero dependencias
 * npm: WebGL 1 + un fragment shader, sin Tailwind ni clases (todo estilo inline),
 * que es la razón por la que entra tal cual en este proyecto (ver docs/originkit.md).
 *
 * El shader (`shaderBody` / `fragmentShaderSrc`) es IDÉNTICO al de upstream y no
 * debe tocarse: así se puede volver a pedir el componente al MCP y diffear. Los
 * cambios propios están todos en el envoltorio React y son los siguientes:
 *
 * 1. `size` acepta string, no solo número: el hero necesita `min(420px, 34vw)` y
 *    upstream fijaba píxeles duros, que no se adaptan al viewport.
 * 2. Pausa real cuando no se ve, Y creación perezosa del contexto. El shader
 *    es CARO (con `lens` activo evalúa `shade()` 3 veces por píxel, una por
 *    canal); upstream deja el requestAnimationFrame corriendo aunque el orbe
 *    esté fuera de pantalla o la pestaña en segundo plano. Aquí un
 *    IntersectionObserver + `visibilitychange` lo detienen. Desde que el
 *    componente pasó a montarse siempre y ocultarse por CSS en vertical/móvil
 *    (ver HomeHero.tsx, punto 6 de docs/originkit.md), montar ya no puede
 *    significar pedir el contexto: `canvas.getContext("webgl", …)` y `init()`
 *    (compilar los DOS shaders) se movieron a `ensureContext()`, una función
 *    idempotente que solo `sync()` llama, y solo la primera vez que el
 *    IntersectionObserver reporta el orbe visible. Medido con Playwright: un
 *    orbe que nunca se ve (montado pero `display:none` en móvil) pasó de
 *    pedir 1 contexto y compilar 2 shaders en el montaje a pedir y compilar
 *    CERO.
 * 3. `prefers-reduced-motion`: dibuja UN frame y no arranca el loop.
 * 4. Limpieza completa de WebGL al desmontar (programa, buffer y `loseContext`).
 *    Upstream solo cancela el rAF, así que cada montaje filtraba un contexto: el
 *    navegador solo permite ~16 vivos y el doble montaje de StrictMode en dev los
 *    consume de a dos. Sin esto, navegar de ida y vuelta al Home acaba en
 *    "Too many active WebGL contexts" y el orbe deja de pintar.
 * 5. Props tipadas (`ComponentPropsWithoutRef<"div">`) en vez del índice
 *    `[key: string]: any` de upstream, que `strict: true` deja pasar pero anula
 *    el chequeo de cualquier prop mal escrita.
 * 6. Blindaje contra contextos WebGL perdidos. Medido con Playwright: al
 *    redimensionar la ventana muy rápido el navegador llegó a entregar un
 *    contexto ya perdido (`isContextLost() === true` justo al crearlo, 5 de
 *    10 veces en una prueba de 12 resizes). `init()` intentaba compilar los
 *    shaders igual, y `compileShader` logueaba `console.error("[Orb] shader
 *    compile failed:", null)` — el shader está bien, es el contexto el que
 *    está muerto, así que el mensaje confundía más de lo que ayudaba. Ahora
 *    `init()` sale temprano si `gl.isContextLost()`, `compileShader` solo
 *    reporta cuando `getShaderInfoLog` trae texto real (un fallo de GLSL
 *    genuino, no un contexto perdido), y `webglcontextlost` limpia `prog`,
 *    `buf` y el mapa de uniforms `u` de inmediato para no dejar referencias
 *    colgando al contexto anterior mientras se espera `webglcontextrestored`.
 */

import { type ComponentPropsWithoutRef, type CSSProperties, useEffect, useRef } from "react";

const DEFAULTS = {
  size: 320,
  archetype: "auto",
  background: "#05050F",
  palette: {
    anchor: "#6A3CFF",
    colorA: "#3CE0FF",
    colorB: "#A24BFF",
    colorC: "#FF5EA8",
  },
  speed: 50,
  spin: 50,
  lens: true,
  lensAmount: 45,
};

const MAX_DPR = 2;
const MAX_PX = 1280;

const ARCHETYPES = ["spiral", "nebula", "core", "deep"];

interface Palette {
  anchor: string;
  colorA: string;
  colorB: string;
  colorC: string;
}

interface OrbConfig {
  bg: [number, number, number];
  anchor: [number, number, number];
  c0: [number, number, number];
  c1: [number, number, number];
  c2: [number, number, number];
  speed: number;
  spin: number;
  audio: number;
  arch: number;
  lens: number;
  phase: number;
}

type OrbProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  size?: number | string;
  archetype?: "auto" | "spiral" | "nebula" | "core" | "deep";
  background?: string;
  palette?: Palette;
  speed?: number;
  spin?: number;
  lens?: boolean;
  lensAmount?: number;
  /** Lado máximo del canvas en píxeles de dispositivo. El costo del shader es
   *  proporcional al ÁREA, así que este es el mando más directo para abaratarlo:
   *  bajarlo de 1280 a 900 deja el trabajo en la mitad. Solo tiene sentido
   *  reducirlo cuando el orbe es un elemento de fondo desenfocado; para un orbe
   *  nítido y pequeño el default de upstream ya es correcto. */
  maxResolution?: number;
  style?: CSSProperties;
};

function toRGB(color: string): [number, number, number] {
  const value = (color ?? "").trim();
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    const n = parseInt(hex.slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(",").map((s) => parseFloat(s));
    return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255];
  }
  return [1, 1, 1];
}

const PHASE = 17.317;

const vertexShaderSrc = `
attribute vec2 aPos;
attribute vec2 aUV;
varying vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const shaderBody = `
float h1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
vec4 starfield(vec3 n, float t) {
  float lon = atan(n.z, n.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float v1 = fract(uPhase * 7.13);
  float v2 = fract(uPhase * 3.71);
  float v3 = fract(uPhase * 5.37);
  float at = uArch >= 0.0 ? uArch : floor(fract(uPhase * 9.73) * 4.0);
  float isNeb = step(0.5, at) * (1.0 - step(1.5, at));
  float isCore = step(1.5, at) * (1.0 - step(2.5, at));
  float isDeep = step(2.5, at);
  float gb = lat + (0.15 + 0.4 * v1) * sin(lon * (1.0 + floor(v2 * 2.0)) + 1.3)
           + 0.12 * sin(lon * 3.0 + t * 0.1);
  float band = exp(-gb * gb * (5.0 + 10.0 * v3));
  band = mix(band, max(band, 0.8), isNeb);
  band *= 1.0 - 0.85 * isDeep;
  float n1 = sin(lon * 2.0 + sin(lat * 3.0 + t * 0.25) * 1.6 + t * 0.15);
  float n2 = sin(lon * 5.0 - sin(lat * 4.0 - t * 0.2) * 1.2 - t * 0.22 + 2.4);
  float neb = pow(0.5 + 0.5 * n1, 2.0) * (0.45 + 0.55 * pow(0.5 + 0.5 * n2, 2.0));
  float lane = pow(0.5 + 0.5 * sin(lon * 4.0 + lat * 7.0 + sin(lon * 2.0) * 2.0), 3.0);
  float galaxy = band * neb * (1.0 - lane * (0.55 + 0.35 * v2));
  galaxy = clamp(galaxy, 0.0, 1.0);
  vec3 hue = mix(mix(uC0, uC1, v1), mix(uC1, uC2, v3), 0.5 + 0.5 * sin(lon + lat * 2.0 - t * 0.2));
  vec3 hueGrey = vec3(dot(hue, vec3(0.299, 0.587, 0.114)));
  hue = clamp(hueGrey + (hue - hueGrey) * 1.45, 0.0, 1.0);
  vec3 dust = mix(vec3(0.72, 0.78, 0.92), hue, 0.45 + 0.3 * v1 + 0.45 * isNeb);
  vec3 col = dust * galaxy * (0.6 + 0.9 * isNeb);
  float shear = sin(lon * 13.0 + lat * 4.0 - t * 0.35) * sin(lon * 5.0 + t * 0.2);
  col += dust * band * neb * max(shear, 0.0) * 0.14;
  float gb2 = lat - (0.35 + 0.25 * v2) * sin(lon * 2.0 - 1.1) + 0.4;
  float arm = exp(-gb2 * gb2 * 7.0) * neb;
  col += mix(dust, uC1, 0.35) * arm * 0.2;
  vec3 voidGlow = mix(vec3(0.04, 0.03, 0.1), mix(uC0, mix(uC1, uC2, v3), v1) * 0.22, 0.75);
  col += voidGlow * (0.5 + 0.22 * sin(t * 0.4 + lon)) * (0.4 + 0.6 * band);
  col += vec3(1.0, 0.88, 0.68) * pow(band, 4.0) * pow(neb, 2.0) * 0.4;
  float ca = v2 * 6.28318;
  vec3 Cdir = normalize(vec3(cos(ca) * 0.85, 0.6 * (v3 - 0.5), sin(ca) * 0.85));
  float bulge = max(dot(n, Cdir), 0.0);
  col += mix(vec3(1.0, 0.85, 0.6), uC2, 0.25) * (pow(bulge, 14.0) * 1.6 + pow(bulge, 4.0) * 0.5) * isCore;
  float pocket = pow(neb, 5.0) * band * (0.7 + 0.3 * sin(t * 0.6 + lon * 3.0));
  col += mix(uC2, uC0, fract(v1 + 0.5 * sin(lon * 2.0) + 0.5)) * pocket * (0.5 + 0.4 * v2 + 0.8 * isNeb);
  float pocket2 = pow(0.5 + 0.5 * sin(lon * 3.0 + lat * 4.0 - t * 0.18 + 2.0), 6.0) * band;
  col += mix(uC1, uC2, v3) * pocket2 * (0.25 + 0.3 * v1 + 0.5 * isNeb);
  float detail = smoothstep(90.0, 200.0, uRes.y);
  vec2 gg = vec2(lon, lat) * 34.0;
  vec2 gc = floor(gg);
  vec2 gf = fract(gg);
  float gh = h1(gc.x * 3.7 + gc.y * 11.3);
  vec2 gp = vec2(0.2 + 0.6 * h1(gh * 91.0), 0.2 + 0.6 * h1(gh * 47.0));
  float gd = length((gf - gp) * vec2(cos(lat), 1.0));
  float grain = exp(-gd * gd * 700.0 * clamp(uRes.y / 420.0, 0.22, 1.0)) * step(0.3, gh) * (0.15 + 0.85 * band);
  col += vec3(0.88, 0.9, 1.0) * grain * 0.4 * detail;
  float w = clamp(galaxy * 0.7 + pow(band, 4.0) * 0.25, 0.0, 1.0);
  for (int s = 0; s < 3; s++) {
    float K = s == 0 ? 6.0 : (s == 1 ? 11.0 : 19.0);
    vec2 g = vec2(lon, lat) * K;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float hx = h1(cell.x * 13.7 + cell.y * 7.3 + float(s) * 91.0);
    float hy = h1(cell.x * 5.1 + cell.y * 17.9 + float(s) * 37.0);
    vec2 sp = vec2(0.15 + 0.7 * hx, 0.15 + 0.7 * hy);
    float d = length((f - sp) * vec2(cos(lat), 1.0));
    float census = (v2 - 0.5) * 0.2 + 0.35 * isNeb - 0.2 * isCore + 0.3 * isDeep;
    float keep = step((s == 2 ? 0.3 : 0.55) + census, h1(hx * 89.0 + hy * 31.0) + band * 0.25);
    float resFac = clamp(uRes.y / 420.0, 0.22, 1.0);
    float tw = mix(0.92, 0.6 + 0.4 * sin(t * (1.5 + 3.0 * hx) + hx * 40.0), resFac);
    float hz = h1(hx * 53.0 + hy * 71.0 + cell.x);
    float sizeJit = 0.35 + 1.8 * hz * hz;
    float sharp = (s == 0 ? 260.0 : (s == 1 ? 700.0 : 1600.0)) / sizeJit * resFac;
    float star = exp(-d * d * sharp) * keep * tw;
    vec3 tint = mix(vec3(1.0), hx < 0.33 ? vec3(0.85, 0.9, 1.0) : (hx < 0.66 ? vec3(1.0, 0.95, 0.85) : mix(vec3(1.0), uC1, 0.3)), 0.6);
    float bright = (s == 0 ? 1.7 : (s == 1 ? 0.9 : 0.5)) * (0.55 + 0.7 * sizeJit);
    float starFade = mix(s == 2 ? 0.14 : 0.45, 1.0, detail);
    col += tint * star * bright * starFade;
    if (s == 0) {
      float big = smoothstep(1.2, 2.0, sizeJit);
      col += tint * exp(-d * d * 60.0) * 0.18 * big * tw * starFade;
      vec2 dd = (f - sp) * vec2(cos(lat), 1.0);
      float spike = exp(-dd.x * dd.x * 1200.0) * exp(-dd.y * dd.y * 26.0)
                  + exp(-dd.y * dd.y * 1200.0) * exp(-dd.x * dd.x * 26.0);
      col += tint * spike * 0.3 * big * tw * starFade;
      w = max(w, spike * 0.3 * big * starFade);
    }
    w = max(w, star * min(bright, 1.5) * starFade);
  }
  float pa = v1 * 6.28318;
  vec3 P = normalize(vec3(sin(pa) * 0.9, 1.4 * (v2 - 0.5), cos(pa) * 0.9));
  float pd = max(dot(n, P), 0.0);
  float beat = pow(0.5 + 0.5 * sin(t * (1.2 + v3 + 1.5 * uAudio) + v3 * 6.28), 8.0);
  beat = min(1.0, beat + 0.6 * uAudio);
  float pulsarFade = mix(0.45, 1.0, detail);
  col += vec3(0.9, 0.95, 1.0) * (pow(pd, 900.0) * (0.6 + 1.2 * beat) + pow(pd, 110.0) * 0.5 * beat) * pulsarFade;
  w = max(w, pow(pd, 900.0) * (0.5 + 0.5 * beat) * pulsarFade);
  return vec4(min(col, vec3(1.0)), min(w, 1.0));
}
vec4 sphereAt(vec3 n, float spin, float t) {
  float roll = t * 0.13;
  float cr = cos(roll), sr = sin(roll);
  n = vec3(cr * n.x - sr * n.y, sr * n.x + cr * n.y, n.z);
  float tilt = 0.45 + 0.35 * sin(t * 0.24);
  float cx = cos(tilt), sx = sin(tilt);
  n = vec3(n.x, cx * n.y - sx * n.z, sx * n.y + cx * n.z);
  float cs = cos(spin), ss = sin(spin);
  n = vec3(cs * n.x + ss * n.z, n.y, -ss * n.x + cs * n.z);
  return starfield(n, t);
}
vec3 shade(vec2 p) {
  float r = length(p);
#ifndef DUAL_LAYER
  if (r > 1.0) { discard; }
#endif
  float t = uTime * 0.8 + uPhase;
  float rr = min(r, 0.9995);
  float z = sqrt(1.0 - rr * rr);
  vec3 N = vec3(p.x, p.y, z);
  float fres = pow(1.0 - z, 2.4);
  vec3 I = vec3(0.0, 0.0, -1.0);
  vec3 R = refract(I, N, 0.75);
  float dHit = -2.0 * dot(N, R);
  vec3 B = normalize(N + R * dHit);
  float sv = fract(uPhase * 6.31);
  float sw = fract(uPhase * 2.17);
  float tWarp = t
    + (0.9 + 1.3 * sv) * sin(t * (0.09 + 0.07 * sw))
    + (0.5 + 0.8 * sw) * sin(t * (0.21 + 0.09 * sv) + 2.6);
  vec4 front = sphereAt(N, uSpin, tWarp);
#ifdef DUAL_LAYER
  vec4 back = sphereAt(B, uSpin, tWarp * 0.8 + 2.7);
#else
  vec4 back = vec4(0.0);
#endif
  vec3 voidCol = mix(uAnchor * 0.04, uAnchor * 0.35, fres);
  vec3 col = mix(uBg, voidCol, 0.97 - 0.04 * fres);
  float fa = clamp(front.a, 0.0, 1.0);
  float ba = clamp(back.a, 0.0, 1.0);
  col = mix(col, back.rgb, ba * 0.16);
  col = mix(col, front.rgb, fa * 0.85);
  {
    float alon = atan(N.x, N.z);
    float speech = pow(0.5 + 0.5 * sin(alon * 3.0 + sin(alon * 7.0 + t * 1.1) * 0.7 + t * 0.5), 3.0)
                 * (0.55 + 0.45 * sin(alon * 5.0 - t * 0.65 + 1.7));
    float sky = -N.y;
    float hang = smoothstep(-0.15, 0.5, sky);
    float rays = 0.7 + 0.3 * sin(alon * 24.0 + sin(alon * 9.0 - t * 0.8) * 2.0 + t * 1.6);
    float aur = clamp(speech, 0.0, 1.0) * hang * rays * (1.0 + 2.2 * uAudio);
    float av = fract(uPhase * 2.93);
    vec3 aurCol = mix(vec3(0.12, 0.95, 0.55), vec3(0.45, 0.35, 1.0),
                      smoothstep(0.0, 0.95, sky + 0.35 * speech));
    aurCol = mix(aurCol, mix(uC0, uC2, av), 0.15 + 0.4 * av);
    col += aurCol * aur * 0.8;
    float met = 4.5 + 3.5 * fract(uPhase * 4.91);
    float epoch = floor(t / met);
    float ph = fract(t / met);
    vec2 s0 = vec2(-1.1 + 2.2 * h1(epoch * 1.3), 0.85 - 1.4 * h1(epoch * 2.9));
    vec2 sd = normalize(vec2(0.7 + 0.5 * h1(epoch * 4.1), -0.35 - 0.4 * h1(epoch * 5.3)));
    vec2 head = s0 + sd * ph * 2.8;
    vec2 rel = p - head;
    float along = dot(rel, sd);
    float perp = dot(rel, vec2(-sd.y, sd.x));
    float vis = smoothstep(0.0, 0.06, ph) * smoothstep(0.5, 0.32, ph);
    float tail = exp(-perp * perp * 1600.0) * exp(along * 9.0) * step(along, 0.0)
               * smoothstep(-0.5, -0.02, along);
    float headGlow = exp(-dot(rel, rel) * 900.0);
    col += (vec3(1.0) * headGlow * 1.2 + mix(vec3(1.0), uC1, 0.3) * tail * 0.85) * vis;
    vec3 LD = normalize(vec3(0.85 * sin(t * 0.42), 0.45 * sin(t * 0.26 + 1.2), 0.5));
    float diffuse = 0.62 + 0.65 * max(dot(N, LD), 0.0);
    diffuse *= 1.0 + 0.35 * uAudio;
    col *= diffuse;
    vec3 voiceCol = mix(uC1, vec3(1.0, 0.97, 0.9), 0.45);
    col += voiceCol * pow(1.0 - rr, 1.8) * uAudio * 0.5;
    col += (uC1 * 0.7 + vec3(0.12)) * fres * uAudio * 0.65;
    col += col * uAudio * 0.18 * sin(t * 14.0 + rr * 40.0 + uPhase * 7.0);
    float counter = max(dot(N.xy, -LD.xy), 0.0) * fres;
    col += mix(uC0, vec3(0.5, 0.6, 0.9), 0.5) * counter * 0.18;
  }
  vec3 L1 = normalize(vec3(-0.45 + 0.3 * sin(t * 0.34), 0.62 + 0.2 * sin(t * 0.27 + 1.7), 0.64));
  float keyAmp = 0.5 * (0.78 + 0.22 * sin(t * 0.45 + 2.2));
  col += vec3(1.0) * pow(max(dot(N, L1), 0.0), 150.0) * keyAmp;
  vec3 LS = normalize(vec3(sin(t * 0.07) * 0.9, 0.35 + 0.3 * cos(t * 0.05), 0.7));
  col += vec3(1.0) * pow(max(dot(N, LS), 0.0), 7.0) * 0.05;
  vec3 L2 = normalize(vec3(0.52, -0.5 + 0.12 * sin(t * 0.09), 0.69));
  col += vec3(1.0) * pow(max(dot(N, L2), 0.0), 140.0) * 0.25;
  col = mix(col, front.rgb, fa * fres * 0.3);
  float limb = smoothstep(0.94, 1.0, rr);
  col = mix(col, col * 0.85, limb * 0.4);
  return col;
}`;

const fragmentShaderSrc =
  `
precision highp float;
#define DUAL_LAYER
varying vec2 vUV;
uniform vec2 uRes;
uniform vec3 uBg;
uniform vec3 uAnchor, uC0, uC1, uC2;
uniform float uTime, uPhase;
uniform float uAudio;
uniform float uSpin;
uniform float uArch;
uniform float uLens;
` +
  shaderBody +
  `
void main() {
  vec2 p = vUV * 2.0 - 1.0;
  if (uLens > 0.0) {
    float r = length(p);
    float ex = exp(2.0 * 1.7724539 * (r - 0.9) / 0.1414214);
    float fall = 0.5 + 0.5 * (ex - 1.0) / (ex + 1.0);
    if (fall > 0.004) {
      float swell = 1.0 + 0.16 * (0.6 * sin(uTime * 0.9 + uPhase)
                                + 0.4 * sin(uTime * 1.7 + uPhase * 1.3));
      float k = uLens * fall * swell;
      float cR = 1.4 * (1.0 + 0.06 * sin(uTime * 1.3 + uPhase));
      float cG = 1.2 * (1.0 + 0.06 * sin(uTime * 1.3 + uPhase + 2.1));
      float cB = 1.0 * (1.0 + 0.06 * sin(uTime * 1.3 + uPhase + 4.2));
      vec3 col = vec3(shade(p * (1.0 - k * cR)).r,
                      shade(p * (1.0 - k * cG)).g,
                      shade(p * (1.0 - k * cB)).b);
      vec2 a2 = min(abs(p), 1.0);
      float lobe = max(abs(a2.x * 0.766 + a2.y * 0.643), abs(a2.x * 0.766 - a2.y * 0.643));
      float glow = 0.65 * pow(clamp((lobe - 0.0707) / 1.3435, 0.0, 1.0), 2.4) * fall;
      glow += 1.02 * clamp(1.0 + (r - 1.0) / 0.15, 0.0, 1.0) * step(r, 1.0) * pow(lobe, 2.0);
      col += vec3(0.25) * min(glow, 1.0);
      gl_FragColor = vec4(col, 1.0);
      return;
    }
  }
  gl_FragColor = vec4(shade(p), 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
  const info = gl.getShaderInfoLog(sh);
  // Un contexto perdido deja el compilador sin nada que reportar (infoLog
  // vacío o null) y no es un error del programador; un fallo real de GLSL sí
  // trae texto y ese caso se sigue reportando.
  if (info) console.error("[Orb] shader compile failed:", info);
  gl.deleteShader(sh);
  return null;
}

const UNIFORM_NAMES = [
  "uRes",
  "uBg",
  "uAnchor",
  "uC0",
  "uC1",
  "uC2",
  "uTime",
  "uPhase",
  "uAudio",
  "uSpin",
  "uArch",
  "uLens",
];

export function CosmicOrb(props: OrbProps) {
  const {
    size = DEFAULTS.size,
    archetype = DEFAULTS.archetype,
    background = DEFAULTS.background,
    palette = DEFAULTS.palette,
    speed = DEFAULTS.speed,
    spin = DEFAULTS.spin,
    lens = DEFAULTS.lens,
    lensAmount = DEFAULTS.lensAmount,
    maxResolution = MAX_PX,
    ...rest
  } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Vía ref y no capturada por el closure: el efecto tiene deps `[]`, así que
  // leer `maxResolution` directamente lo congelaría en el valor del primer
  // render y cambiarlo en caliente no haría nada.
  const maxResRef = useRef(maxResolution);
  maxResRef.current = maxResolution;

  const cfgRef = useRef<OrbConfig | null>(null);
  cfgRef.current = {
    bg: toRGB(background),
    anchor: toRGB(palette?.anchor ?? DEFAULTS.palette.anchor),
    c0: toRGB(palette?.colorA ?? DEFAULTS.palette.colorA),
    c1: toRGB(palette?.colorB ?? DEFAULTS.palette.colorB),
    c2: toRGB(palette?.colorC ?? DEFAULTS.palette.colorC),
    speed: Math.max(0, speed) / 50,
    spin: Math.max(0, spin) / 50,
    audio: 0,
    arch: archetype === "auto" ? -1 : ARCHETYPES.indexOf(archetype),
    lens: lens ? (Math.max(0, lensAmount) / 100) * 0.2 : 0,
    phase: PHASE,
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    // El contexto WebGL se pide de forma PEREZOSA: arranca en `null` y solo
    // lo crea `ensureContext()` (más abajo), la primera vez que el orbe es
    // realmente visible. El componente vive siempre montado (ver
    // HomeHero.tsx), así que si esto fuera `const gl = canvas.getContext(…)`
    // aquí arriba —como upstream y como la versión anterior de este
    // archivo— un orbe oculto por CSS en móvil pagaría igual el contexto y
    // la compilación de los dos shaders sin dibujar nunca nada.
    let gl: WebGLRenderingContext | null = null;
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let u: Record<string, WebGLUniformLocation | null> = {};
    let ready = false;

    const init = () => {
      // Alias local: TypeScript no puede seguir garantizando `gl` no-nulo a
      // través de las llamadas a `compileShader`/etc. tratándose de un `let`
      // capturado por closures que sí lo reasignan (`ensureContext`) — con
      // `g` fijo, el chequeo de abajo lo estrecha para el resto de la
      // función.
      const g = gl;
      // Puede llegar aquí con un contexto ya perdido (perdido entre el
      // `webglcontextlost` y este `init()` disparado por
      // `webglcontextrestored`, o directamente sin contexto si algo llama a
      // `init()` fuera de orden): compilar sobre él no tiene sentido,
      // `getShaderInfoLog` no devuelve nada útil y solo ensucia la consola.
      // `webglcontextrestored` volverá a llamar a `init()` con el contexto
      // ya recuperado.
      if (!g || g.isContextLost()) return;
      const vs = compileShader(g, g.VERTEX_SHADER, vertexShaderSrc);
      const fs = compileShader(g, g.FRAGMENT_SHADER, fragmentShaderSrc);
      if (!vs || !fs) return;
      const p = g.createProgram();
      if (!p) return;
      g.attachShader(p, vs);
      g.attachShader(p, fs);
      g.bindAttribLocation(p, 0, "aPos");
      g.bindAttribLocation(p, 1, "aUV");
      g.linkProgram(p);
      g.deleteShader(vs);
      g.deleteShader(fs);
      if (!g.getProgramParameter(p, g.LINK_STATUS)) {
        console.error("[Orb] link failed:", g.getProgramInfoLog(p));
        return;
      }
      prog = p;
      u = {};
      for (const name of UNIFORM_NAMES) u[name] = g.getUniformLocation(p, name);

      buf = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, buf);
      g.bufferData(
        g.ARRAY_BUFFER,
        new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
        g.STATIC_DRAW,
      );
      g.enableVertexAttribArray(0);
      g.vertexAttribPointer(0, 2, g.FLOAT, false, 16, 0);
      g.enableVertexAttribArray(1);
      g.vertexAttribPointer(1, 2, g.FLOAT, false, 16, 8);
      g.enable(g.BLEND);
      g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      ready = true;
    };

    const onLost = (e: Event) => {
      e.preventDefault();
      ready = false;
      // Los objetos del contexto perdido quedan inválidos de inmediato (la
      // spec de WebGL los invalida al perder el contexto); soltar las
      // referencias aquí, en vez de esperar a que `init()` las pise en el
      // restore, evita que `draw()` u otro código intente usarlas de por
      // medio (aunque ya está guardado por `ready`).
      prog = null;
      buf = null;
      u = {};
    };
    const onRestored = () => {
      init();
      draw();
    };

    // Crea el contexto WebGL y compila los shaders. Idempotente (si `gl` ya
    // existe, no hace nada): solo `sync()` la llama, y solo cuando el
    // IntersectionObserver reporta el orbe visible por primera vez — un
    // orbe que nunca se ve (oculto por CSS) nunca la llama, así que nunca
    // paga contexto ni shaders.
    const ensureContext = () => {
      if (gl) return;
      const ctx = canvas.getContext("webgl", {
        premultipliedAlpha: true,
        alpha: true,
        antialias: true,
      }) as WebGLRenderingContext | null;
      if (!ctx) return;
      gl = ctx;
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
      init();
      resize();
    };

    const resize = () => {
      // Sin contexto (el orbe aún no fue visible nunca) no hay nada que
      // dimensionar ni dibujar.
      if (!gl) return;
      const side = Math.max(1, Math.min(wrap.clientWidth, wrap.clientHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const px = Math.min(Math.round(side * dpr), maxResRef.current);
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px;
        canvas.height = px;
        // Con el loop detenido (reduced-motion, fuera de pantalla) nadie
        // repintaría el canvas, que además se limpia al cambiar de tamaño.
        if (!running) draw();
      }
    };
    const ro = new ResizeObserver(resize);

    const body = {
      spin: 0,
      spinVel: 0,
      spinDir: 1,
      oscSign: 1,
      flipQueued: false,
      audioSmooth: 0,
      audioFast: 0,
      prevA: 0,
      lastT: null as number | null,
    };

    const advance = (tNow: number, cfg: OrbConfig) => {
      const dt = body.lastT === null ? 0 : Math.min(0.1, Math.max(0, tNow - body.lastT));
      body.lastT = tNow;

      const target = cfg.audio;
      const slowTau = target > body.audioSmooth ? 0.11 : 0.3;
      body.audioSmooth += (target - body.audioSmooth) * (dt > 0 ? 1 - Math.exp(-dt / slowTau) : 0);
      const fastTau = target > body.audioFast ? 0.04 : 0.18;
      body.audioFast += (target - body.audioFast) * (dt > 0 ? 1 - Math.exp(-dt / fastTau) : 0);

      const o = (6.31 * cfg.phase) % 1;
      const s = 0.35 * Math.sin(tNow * (0.11 + 0.08 * ((2.17 * cfg.phase) % 1)) + cfg.phase);
      const a = body.audioFast;
      const d = Math.sin(tNow * (0.45 + 0.2 * o) + cfg.phase);
      if (Math.sign(d) !== body.oscSign) {
        body.oscSign = Math.sign(d);
        body.flipQueued = true;
      }
      if (body.flipQueued && a < 0.18) {
        body.spinDir = -body.spinDir;
        body.flipQueued = false;
      }
      const targetVel = (0.65 * (0.65 + 0.7 * o) * (1 + s) + body.spinDir * a * 2.2) * cfg.spin;
      body.spinVel += (targetVel - body.spinVel) * (dt > 0 ? 1 - Math.exp(-dt / 0.35) : 0);
      const burst = Math.max(0, a - body.prevA);
      body.prevA = a;
      body.spinVel += body.spinDir * Math.min(6 * burst, 1.4) * dt * 14;
      body.spin += body.spinVel * dt;
    };

    const start = performance.now();
    let raf = 0;
    let running = false;

    const draw = () => {
      // Alias local por el mismo motivo que en `init()`: estrecha `gl` una
      // sola vez para el resto de la función.
      const g = gl;
      if (!g || !ready || !prog) return;
      const cfg = cfgRef.current;
      if (!cfg) return;
      const tNow = ((performance.now() - start) / 1000) * cfg.speed;
      advance(tNow, cfg);

      // biome-ignore lint/correctness/useHookAtTopLevel: g.useProgram es la API de WebGL, no un hook de React — Biome lo confunde por el prefijo "use".
      g.useProgram(prog);
      g.viewport(0, 0, canvas.width, canvas.height);
      g.uniform2f(u.uRes, canvas.width, canvas.height);
      g.uniform3f(u.uBg, cfg.bg[0], cfg.bg[1], cfg.bg[2]);
      g.uniform3f(u.uAnchor, cfg.anchor[0], cfg.anchor[1], cfg.anchor[2]);
      g.uniform3f(u.uC0, cfg.c0[0], cfg.c0[1], cfg.c0[2]);
      g.uniform3f(u.uC1, cfg.c1[0], cfg.c1[1], cfg.c1[2]);
      g.uniform3f(u.uC2, cfg.c2[0], cfg.c2[1], cfg.c2[2]);
      g.uniform1f(u.uTime, tNow);
      g.uniform1f(u.uPhase, cfg.phase);
      g.uniform1f(u.uArch, cfg.arch);
      g.uniform1f(u.uLens, cfg.lens);
      g.uniform1f(u.uAudio, body.audioSmooth);
      g.uniform1f(u.uSpin, body.spin);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      draw();
    };

    // Un shader de este costo no debe gastar GPU cuando el orbe no se ve. El
    // loop solo corre con el orbe en viewport Y la pestaña al frente.
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;

    const sync = () => {
      // Justo antes de arrancar el bucle (o de dibujar el frame único de
      // `prefers-reduced-motion`, ver el `else` de abajo) y NO antes: si el
      // orbe se vuelve visible se necesita el contexto, sin importar si
      // reduced-motion va a impedir que el rAF llegue a correr. Idempotente,
      // así que llamarla en cada `sync()` mientras `visible` sea true es
      // gratis una vez creado el contexto.
      if (visible && !gl) ensureContext();
      const shouldRun = visible && !document.hidden && !motionMq.matches;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) {
        // `lastT = null` evita que el primer dt tras la pausa valga los
        // segundos que estuvo detenido y dispare el giro de golpe.
        body.lastT = null;
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        // Con reduced-motion queda un frame fijo (el orbe se ve, quieto), no
        // un hueco negro.
        if (motionMq.matches) draw();
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0 },
    );
    io.observe(wrap);
    document.addEventListener("visibilitychange", sync);
    motionMq.addEventListener("change", sync);
    // Sin el `resize()` eager de antes: sin contexto todavía es un no-op
    // (ver el guard de `resize()` arriba), y en cuanto haga falta lo llama
    // `ensureContext()`. `ro.observe` sí se registra ya: es barato y deja
    // listo el redimensionado para cuando el contexto exista.
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      running = false;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motionMq.removeEventListener("change", sync);
      // El contexto pudo no haberse creado nunca (orbe que nunca fue
      // visible, p. ej. montado en móvil durante toda la sesión): nada que
      // limpiar en ese caso, y `gl.deleteProgram`/etc. sobre `null` tiraría.
      if (gl) {
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        if (prog) gl.deleteProgram(prog);
        if (buf) gl.deleteBuffer(buf);
        // El navegador tope ~16 contextos WebGL vivos y no los libera al
        // desmontar el canvas; sin esto, cada visita al Home filtra uno.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
  }, []);

  return (
    <div
      {...rest}
      style={{
        ...rest.style,
        position: "relative",
        width: rest.style?.width ?? size,
        height: rest.style?.height ?? size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          width: size,
          height: size,
          flex: "0 0 auto",
          maxWidth: "100%",
          maxHeight: "100%",
          aspectRatio: "1 / 1",
          boxSizing: "border-box",
          borderRadius: "50%",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
          }}
        />
      </div>
    </div>
  );
}

export default CosmicOrb;

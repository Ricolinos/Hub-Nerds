import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// Wordmark embebido como data URI (SVG en base64): satori/ImageResponse no
// comparte origin con el servidor en runtime nodejs, así que una ruta
// relativa a /public no resuelve. type-dark.svg = variante clara-sobre-oscuro
// (texto #f6f6f6 + acento cyan), la que corresponde al fondo #151515 de aquí.
function loadWordmarkDataUri(): string {
  const svg = readFileSync(join(process.cwd(), "public", "trademark", "type-dark.svg"), "utf-8");
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

export async function GET(request: Request) {
  let url = new URL(request.url);
  let title = url.searchParams.get("title") || "Portfolio";
  const wordmark = loadWordmarkDataUri();

  async function loadGoogleFont(font: string) {
    const url = `https://fonts.googleapis.com/css2?family=${font}`;
    const css = await (await fetch(url)).text();
    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

    if (resource) {
      const response = await fetch(resource[1]);
      if (response.status == 200) {
        return await response.arrayBuffer();
      }
    }

    throw new Error("failed to load font data");
  }

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: "6rem",
        background: "#151515",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "4rem",
          fontStyle: "normal",
          color: "white",
        }}
      >
        <span
          style={{
            padding: "1rem",
            fontSize: "6rem",
            lineHeight: "8rem",
            letterSpacing: "-0.05em",
            whiteSpace: "wrap",
            textWrap: "balance",
            overflow: "hidden",
          }}
        >
          {title}
        </span>
        {/* Wordmark de la marca del sitio en vez de la cara/nombre fijos de
            Ricardo (persona del config): esta ruta la heredan blog y demás
            páginas genéricas, así que ninguna debe compartir por default la
            identidad de una sola persona. */}
        <img src={wordmark} width={340} height={52} alt="Hub-Nerds" />
      </div>
    </div>,
    {
      width: 1280,
      height: 720,
      fonts: [
        {
          name: "Geist",
          data: await loadGoogleFont("Geist:wght@400"),
          style: "normal",
        },
      ],
    },
  );
}

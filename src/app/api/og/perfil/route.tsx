import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { isFreelancerRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Paleta de marca disponible para personalizar el perfil (mismo whitelist que
// PROFILE_BRAND_COLORS en src/app/actions/updateProfile.ts), mapeada a un hex
// aproximado (--scheme-<color>-600 de tokens.css): satori no resuelve custom
// properties de CSS, solo estilos inline resueltos, así que no hay forma de
// leer el token real en runtime — se copian los valores a mano.
const BRAND_HEX: Record<string, string> = {
  blue: "#5A93FC",
  indigo: "#9585FA",
  violet: "#B07AFA",
  magenta: "#D166FA",
  pink: "#F854BE",
  red: "#FF5F53",
  orange: "#FD6325",
  yellow: "#E07B00",
  moss: "#4FA900",
  green: "#08AC3A",
  emerald: "#08A97C",
  aqua: "#08A6A5",
  cyan: "#049EE2",
};
// Cyan es la marca fija de Hub-Nerds (ver AGENT PROFILE / memoria de marca):
// fallback cuando el freelancer no personalizó su perfil.
const DEFAULT_BRAND_HEX = BRAND_HEX.cyan;

// El wordmark se embebe como data URI (base64 del SVG) en vez de cargarlo
// como URL http: es un asset local del propio despliegue y satori/ImageResponse
// no comparte el mismo origin en runtime nodejs, así que una ruta relativa no
// resuelve. type-dark.svg es la variante clara-sobre-oscuro (texto #f6f6f6 +
// acento cyan #6ac5d9), la que corresponde al fondo oscuro de esta tarjeta.
function loadWordmarkDataUri(): string {
  const svg = readFileSync(join(process.cwd(), "public", "trademark", "type-dark.svg"), "utf-8");
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

function GenericCard({ wordmark }: { wordmark: string }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0d",
      }}
    >
      {/* biome-ignore lint: img nativo requerido por satori */}
      <img src={wordmark} width={420} height={64} alt="Hub-Nerds" />
    </div>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const username = url.searchParams.get("u");
  const wordmark = loadWordmarkDataUri();

  const profileUser = username
    ? await prisma.user.findUnique({
        where: { username },
        select: {
          name: true,
          username: true,
          imageUrl: true,
          headline: true,
          primaryRole: true,
          cardQuote: true,
          profileBrand: true,
          isPublic: true,
          role: true,
        },
      })
    : null;

  const isEligible = Boolean(
    profileUser && profileUser.isPublic && isFreelancerRole(profileUser.role),
  );

  const response = !isEligible
    ? new ImageResponse(<GenericCard wordmark={wordmark} />, { width: 1200, height: 630 })
    : await renderProfileCard(profileUser!, wordmark);

  response.headers.set("Cache-Control", "public, s-maxage=3600");
  return response;
}

async function renderProfileCard(
  profileUser: {
    name: string | null;
    username: string | null;
    imageUrl: string | null;
    headline: string | null;
    primaryRole: string | null;
    cardQuote: string | null;
    profileBrand: string | null;
  },
  wordmark: string,
) {
  const brandHex = (profileUser.profileBrand && BRAND_HEX[profileUser.profileBrand]) || DEFAULT_BRAND_HEX;
  const displayName = profileUser.name || profileUser.username || "Freelancer";
  const role = profileUser.primaryRole || profileUser.headline;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          // Glow radial del color de marca del freelancer, mismo lenguaje
          // que el reverso de la tarjeta Designerd (Background gradient en
          // DesignerDirectory.tsx): un solo background con dos radial-
          // gradient y varios stops (en vez de divs absolutos superpuestos,
          // que en satori dejaban una costura visible donde una capa de
          // alpha terminaba sobre otra) para un degradado más parejo.
          background: `radial-gradient(circle at 22% 18%, ${brandHex}59 0%, ${brandHex}22 30%, transparent 62%), radial-gradient(circle at 82% 88%, ${brandHex}40 0%, ${brandHex}14 32%, transparent 60%), #08080b`,
        }}
      >
        {/* Contenido centrado */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 176,
              height: 176,
              borderRadius: 9999,
              overflow: "hidden",
              border: `4px solid ${brandHex}`,
              boxShadow: `0 0 60px ${brandHex}55`,
            }}
          >
            {profileUser.imageUrl ? (
              // El overflow:hidden del contenedor no basta para recortar la
              // imagen en satori: el <img> necesita su PROPIO borderRadius
              // (asoman las esquinas cuadradas de la foto fuera del anillo si
              // solo se lo damos al div padre).
              // biome-ignore lint: img nativo requerido por satori
              <img
                src={profileUser.imageUrl}
                width={176}
                height={176}
                style={{ objectFit: "cover", borderRadius: 9999 }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  background: brandHex,
                  fontSize: 72,
                  color: "#0a0a0d",
                  fontWeight: 700,
                }}
              >
                {displayName[0]?.toUpperCase() ?? "H"}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "2.25rem",
              fontSize: 56,
              lineHeight: 1.1,
              fontWeight: 700,
              color: "#f6f6f6",
              textAlign: "center",
              whiteSpace: "pre-wrap",
              textWrap: "balance",
            }}
          >
            {displayName}
          </div>

          {profileUser.username ? (
            <div
              style={{
                display: "flex",
                marginTop: "0.5rem",
                fontSize: 28,
                color: brandHex,
              }}
            >
              {`@${profileUser.username}`}
            </div>
          ) : null}

          {role ? (
            <div
              style={{
                display: "flex",
                marginTop: "1.5rem",
                padding: "0.5rem 1.5rem",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                fontSize: 24,
                color: "#f6f6f6",
              }}
            >
              {role}
            </div>
          ) : null}

          {profileUser.cardQuote ? (
            <div
              style={{
                display: "flex",
                marginTop: "1.75rem",
                maxWidth: 760,
                fontSize: 22,
                fontStyle: "italic",
                color: "rgba(246,246,246,0.55)",
                textAlign: "center",
                whiteSpace: "pre-wrap",
                textWrap: "balance",
              }}
            >
              {`“${profileUser.cardQuote}”`}
            </div>
          ) : null}
        </div>

        <div style={{ position: "absolute", bottom: 36, right: 44, display: "flex" }}>
          {/* biome-ignore lint: img nativo requerido por satori */}
          <img src={wordmark} width={168} height={26} alt="Hub-Nerds" />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

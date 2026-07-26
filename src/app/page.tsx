import { Column, Flex, Meta, Schema } from "@once-ui-system/core";
import { HomeAbout, HomeCreatorsCTA, HomeFeatures, HomeHero, HomeShowcase } from "@/components";
import { caseStudyHref } from "@/lib/caseStudies";
import { coverKindOf, extractYouTubeId, resolveCoverSrc } from "@/lib/coverMedia";
import { getPortfolioFeed } from "@/lib/portfolio";
import { about, baseURL, home, person } from "@/resources";

// El showcase consulta la base de datos: evita congelar el fetch en build.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  // home.title ya es "Hub-Nerds" (la marca): se descarta la clave `title`
  // (no basta con asignarle undefined: Next.js la trataría como "title
  // resuelto vacío" y no renderizaría ningún <title>) para heredar el
  // default del layout raíz en vez de duplicarlo ("Hub-Nerds · Hub-Nerds").
  const { title: _homeTitle, ...metadata } = Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
  return metadata;
}

export default async function Home() {
  const feed = await getPortfolioFeed();
  const pieces = feed.map((piece) => ({
    id: piece.id,
    title: piece.title,
    description: piece.description,
    designer: piece.user.name ?? piece.user.username ?? "Creativo",
    avatarUrl: piece.user.imageUrl,
    location: piece.location,
    tag: piece.category,
    // getPortfolioFeed ya filtra coverUrl no nulo; el fallback solo satisface al tipo.
    image: piece.coverUrl ?? "",
    likes: piece.likes,
    views: piece.views,
    href: piece.user.username
      ? caseStudyHref(piece.user.username, piece.title, piece.hasMarkdown)
      : undefined,
  }));

  return (
    // El home es la única ruta "edge-to-edge" en LayoutShell: el hero va a
    // ancho completo fuera de cualquier maxWidth, y todo lo demás replica a
    // mano el recipe normal de LayoutShell (padding="l" + Flex centrado +
    // Column maxWidth="l") para que el espaciado de esas secciones no cambie.
    <>
      {/* El hero monta piezas REALES dentro de los paneles de cristal
          (ver HeroParallax): se le pasa el mismo feed que alimenta el
          showcase, filtrando las que no tienen portada utilizable. */}
      <HomeHero
        pieces={pieces
          .filter((p) => p.image)
          .map((p) => {
            // p.image es el coverUrl CRUDO (piece.coverUrl ?? "", ver
            // arriba): puede traer el prefijo "video:", un data URL de
            // video o un link de YouTube legado sin prefijo. Se calcula acá
            // (una vez, en el server) en vez de por frame dentro del panel
            // — mismo criterio que coverKindOf/extractYouTubeId en
            // HomeShowcase.tsx.
            const coverKind = coverKindOf(p.image);
            const youtubeId =
              coverKind === "video" ? extractYouTubeId(resolveCoverSrc(p.image)) : null;
            return {
              id: p.id,
              title: p.title,
              image: p.image,
              coverKind,
              youtubeId,
              designer: p.designer,
              tag: p.tag,
              href: p.href,
            };
          })}
      />
      <Flex fillWidth padding="l" horizontal="center">
        <Flex horizontal="center" fillWidth>
          <Column fillWidth maxWidth="l" paddingY="12" horizontal="center">
            <Schema
              as="webPage"
              baseURL={baseURL}
              path={home.path}
              title={home.title}
              description={home.description}
              image={`/api/og/generate?title=${encodeURIComponent(home.title)}`}
              author={{
                name: person.name,
                url: `${baseURL}${about.path}`,
                image: `${baseURL}${person.avatar}`,
              }}
            />
            <HomeAbout />
            <HomeFeatures />
            <HomeShowcase pieces={pieces} />
            <HomeCreatorsCTA />
          </Column>
        </Flex>
      </Flex>
    </>
  );
}

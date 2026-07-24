import { Column, Meta, Schema } from "@once-ui-system/core";
import { HomeCreatorsCTA, HomeHero, HomeShowcase } from "@/components";
import { caseStudyHref } from "@/lib/caseStudies";
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
    designer: piece.user.name ?? piece.user.username ?? "Partner",
    avatarUrl: piece.user.imageUrl,
    location: piece.location,
    tag: piece.category,
    // getPortfolioFeed ya filtra coverUrl no nulo; el fallback solo satisface al tipo.
    image: piece.coverUrl ?? "",
    likes: piece.likes,
    views: piece.views,
    href: piece.user.username
      ? caseStudyHref(piece.user.username, piece.title, Boolean(piece.markdownContent))
      : undefined,
  }));

  return (
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
      <HomeHero />
      <HomeShowcase pieces={pieces} />
      <HomeCreatorsCTA />
    </Column>
  );
}

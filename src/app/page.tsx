import { Column, Meta, Schema } from "@once-ui-system/core";
import { HomeShowcase } from "@/components";
import { about, baseURL, home, person } from "@/resources";
import { getPortfolioFeed } from "@/lib/portfolio";

// El showcase consulta la base de datos: evita congelar el fetch en build.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return Meta.generate({
    title: home.title,
    description: home.description,
    baseURL: baseURL,
    path: home.path,
    image: home.image,
  });
}

export default async function Home() {
  const feed = await getPortfolioFeed();
  const pieces = feed.map((piece) => ({
    id: piece.id,
    title: piece.title,
    designer: piece.user.name ?? piece.user.username ?? "Partner",
    avatarUrl: piece.user.imageUrl,
    location: piece.location,
    tag: piece.category,
    // getPortfolioFeed ya filtra coverUrl no nulo; el fallback solo satisface al tipo.
    image: piece.coverUrl ?? "",
    likes: piece.likes,
    views: piece.views,
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
      <HomeShowcase pieces={pieces} />
    </Column>
  );
}

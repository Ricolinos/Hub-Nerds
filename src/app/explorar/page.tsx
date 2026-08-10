import { getLikeState } from "@/app/actions/likes";
import { ExploreFeed } from "@/components/explore/ExploreFeed";
import { getPortfolioFeed, toShouts } from "@/lib/portfolio";

// El feed consulta la base de datos: evita congelar el fetch en build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explorar Plataforma",
  description: "Descubre las herramientas y soluciones B2B disponibles.",
};

export default async function ExplorarPage() {
  const feed = await getPortfolioFeed();
  const viewerState = await getLikeState(feed.map((piece) => piece.id));
  return <ExploreFeed shouts={toShouts(feed, viewerState)} />;
}

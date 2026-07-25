import { notFound } from "next/navigation";
import { Metadata } from "next";
import { ExploreFeed } from "@/components/explore/ExploreFeed";
import { DesignerDirectory } from "@/components/explore/DesignerDirectory";
import { CATEGORY_SLUGS } from "@/components/explore/categories";
import { prisma } from "@/lib/prisma";
import { getPortfolioFeed, toShouts } from "@/lib/portfolio";
import { FREELANCER_ROLE_VALUES } from "@/lib/roles";

// La rama "freelancers" consulta la base de datos: evita congelar el fetch en build.
export const dynamic = "force-dynamic";

export async function generateStaticParams(): Promise<{ category: string }[]> {
  return Object.keys(CATEGORY_SLUGS).map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = CATEGORY_SLUGS[category];

  return {
    title: label ? `Explorar · ${label}` : "Explorar Plataforma",
    description: "Descubre las herramientas y soluciones B2B disponibles.",
  };
}

export default async function ExplorarCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const label = CATEGORY_SLUGS[category];

  if (!label) notFound();

  if (category === "freelancers") {
    const platformDesigners = await prisma.user.findMany({
      // Los Freelancers con perfil privado no se listan, pero su /[username] sigue accesible.
      where: { role: { in: FREELANCER_ROLE_VALUES }, isPublic: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        imageUrl: true,
        featuredImageUrl: true,
        cardQuote: true,
        headline: true,
        bio: true,
        primaryRole: true,
        secondaryRoles: true,
        profileBrand: true,
        profileAccent: true,
        profileNeutral: true,
        profileBorder: true,
      },
    });
    return <DesignerDirectory platformDesigners={platformDesigners} />;
  }

  const feed = await getPortfolioFeed();
  return <ExploreFeed initialCategory={label} shouts={toShouts(feed)} />;
}

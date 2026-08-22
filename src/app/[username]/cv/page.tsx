import { currentUser } from "@clerk/nextjs/server";
import { Meta } from "@once-ui-system/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CvLivePage } from "@/components/profile/CvLivePage";
import { getCvData } from "@/lib/cvData";
import { isFreelancerRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { baseURL } from "@/resources";

interface UserCvPageProps {
  params: Promise<{ username: string }>;
}

// Página "CV Live" a pantalla completa (ventaja Freelancer Pro, ver
// src/lib/proPlans.ts → advantages[0]). Pública igual que /<username>: sin
// gate de sesión, pero solo existe para perfiles de freelancer — un
// username de client (o inexistente) da 404, mismo criterio que
// src/app/[username]/page.tsx.
export async function generateMetadata({ params }: UserCvPageProps): Promise<Metadata> {
  const { username } = await params;
  const profileUser = await prisma.user.findUnique({ where: { username } });

  if (!profileUser || !isFreelancerRole(profileUser.role)) {
    return {};
  }

  const displayName = profileUser.name || username;

  return Meta.generate({
    title: `CV de ${displayName}`,
    description: `CV Live de ${displayName} (@${username}) en Hub-Nerds`,
    baseURL,
    path: `/${username}/cv`,
  });
}

export default async function UserCvPage({ params }: UserCvPageProps) {
  const { username } = await params;
  const [profileUser, viewer] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    currentUser(),
  ]);

  if (!profileUser || !isFreelancerRole(profileUser.role)) {
    notFound();
  }

  const isOwnProfile = viewer?.username === username;

  return (
    <CvLivePage
      username={username}
      displayName={profileUser.name || username}
      avatarUrl={profileUser.imageUrl ?? undefined}
      headline={profileUser.headline}
      primaryRole={profileUser.primaryRole}
      secondaryRoles={profileUser.secondaryRoles ?? []}
      cvData={getCvData(profileUser)}
      isOwnProfile={isOwnProfile}
      plan={profileUser.plan}
      planStatus={profileUser.planStatus}
    />
  );
}

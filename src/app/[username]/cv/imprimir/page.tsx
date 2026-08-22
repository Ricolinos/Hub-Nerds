import { Meta } from "@once-ui-system/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CvPrintSheet } from "@/components/profile/CvPrintSheet";
import { getCvData } from "@/lib/cvData";
import { isFreelancerRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { baseURL } from "@/resources";

interface UserCvPrintPageProps {
  params: Promise<{ username: string }>;
}

// Hoja imprimible del CV (ventaja Freelancer Pro, ver src/lib/proPlans.ts →
// advantages[0]/CV Live): réplica en tamaño carta de /<username>/cv pensada
// para "Imprimir → Guardar como PDF" desde el navegador — mismo criterio de
// acceso que la página CV Live (público, 404 si no es freelancer).
export async function generateMetadata({ params }: UserCvPrintPageProps): Promise<Metadata> {
  const { username } = await params;
  const profileUser = await prisma.user.findUnique({ where: { username } });

  if (!profileUser || !isFreelancerRole(profileUser.role)) {
    return {};
  }

  const displayName = profileUser.name || username;

  return Meta.generate({
    title: `CV imprimible de ${displayName}`,
    description: `Versión imprimible en PDF del CV de ${displayName} (@${username}) en Hub-Nerds`,
    baseURL,
    path: `/${username}/cv/imprimir`,
  });
}

export default async function UserCvPrintPage({ params }: UserCvPrintPageProps) {
  const { username } = await params;
  const profileUser = await prisma.user.findUnique({ where: { username } });

  if (!profileUser || !isFreelancerRole(profileUser.role)) {
    notFound();
  }

  const cvData = getCvData(profileUser);

  // El QR se genera en el server (paquete `qrcode`) y viaja al cliente ya
  // como data URL — nada de generarlo en el navegador ni de pegarle a un
  // servicio externo. Apunta al portafolio o al CV según qrTarget (elegido
  // desde "Editar CV"), siempre con la URL canónica de producción.
  const qrDestinationPath = cvData.qrTarget === "cv" ? `/${username}/cv` : `/${username}`;
  const qrDataUrl = await QRCode.toDataURL(`${baseURL}${qrDestinationPath}`, {
    margin: 1,
    width: 240,
    color: { dark: "#111111", light: "#ffffff" },
  });

  return (
    <CvPrintSheet
      username={username}
      displayName={profileUser.name || username}
      headline={profileUser.headline}
      primaryRole={profileUser.primaryRole}
      secondaryRoles={profileUser.secondaryRoles ?? []}
      cvData={cvData}
      qrDataUrl={qrDataUrl}
    />
  );
}

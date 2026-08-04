"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Column,
  Heading,
  HeadingNav,
  Icon,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";
import { ScrollToHash } from "@/components";
import { RoleTag } from "@/components/RoleTag";
import type { CvData, CvExperience } from "@/lib/cvData";
import { CvEditorDialog } from "@/components/profile/CvEditorDialog";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";
import { isPro } from "@/lib/plan";

const CV_LIVE_UPSELL_BENEFITS = [
  "CV Live editable con tu experiencia real",
  "Página de CV compartible y descargable en PDF",
  "Prioridad en búsquedas y el feed",
];

// ── CV Live — página completa (ventaja Freelancer Pro, ver src/lib/proPlans.ts) ──
// Réplica de la sección "about" del template magic-portfolio (Once UI):
// TOC lateral con HeadingNav (mismo módulo y layout que ya usa el visor de
// casos de estudio, ver src/app/[username]/proyecto/[slug]/page.tsx) +
// columna de avatar/ubicación/idiomas + columna principal con Introducción,
// Experiencia, Skills y Formación. El contenido (intro/experiencia/skills/
// formación) viene de `cvData` (User.cvData, ver src/lib/cvData.ts) — con
// fallback al mock histórico mientras el Freelancer no guarda su propio CV
// desde el editor (botón "Editar CV", visible solo al dueño).

function formatRange(exp: CvExperience): string {
  return `${exp.startLabel} – ${exp.endLabel ?? "Presente"}`;
}

interface CvLivePageProps {
  username: string;
  displayName: string;
  avatarUrl?: string;
  headline?: string | null;
  primaryRole?: string | null;
  secondaryRoles?: string[];
  cvData: CvData;
  // Solo el dueño del CV ve el botón "Editar CV" (con insignia Pro).
  isOwnProfile: boolean;
  // Plan del DUEÑO del perfil (User.plan/planStatus, ver src/lib/plan.ts).
  // Con isOwnProfile && !isPro(owner), "Editar CV" e "Imprimir CV" abren el
  // ProUpsellModal en vez de su acción real.
  plan?: string | null;
  planStatus?: string | null;
}

export function CvLivePage({
  username,
  displayName,
  avatarUrl,
  headline,
  primaryRole,
  secondaryRoles = [],
  cvData,
  isOwnProfile,
  plan,
  planStatus,
}: CvLivePageProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const ownerIsPro = isPro({ plan, planStatus });
  const gated = isOwnProfile && !ownerIsPro;
  const initials = (displayName[0] ?? "U").toUpperCase();
  const avatarProps = avatarUrl ? { src: avatarUrl } : { value: initials };

  // HeadingNav (módulo Once UI) escanea TODO el `document` en busca de h2-h6
  // dentro de un useEffect propio para armar el TOC. Esta página vive bajo un
  // Suspense boundary (src/app/[username]/loading.tsx cubre también /cv al
  // ser un archivo de convención de segmento) y, con el streaming SSR de
  // Next.js, cuando el bundle de cliente llega con caché caliente (p. ej. al
  // navegar dos veces seguidas en la misma pestaña), la hidratación puede
  // ganarle por una fracción de segundo al script de "reveal" del streaming,
  // dejando momentáneamente DOS copias del contenido en el DOM real. Si
  // HeadingNav escanea el documento justo en ese instante, arma su TOC con
  // headings duplicados → "two children with the same key" (introduccion,
  // experiencia, skills, formacion). Montar <HeadingNav> recién en el efecto
  // siguiente (no en el commit inicial) le da tiempo al reveal de streaming
  // a completarse antes del escaneo, sin cambiar nada visible.
  const [tocReady, setTocReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setTocReady(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <Column as="main" fillWidth horizontal="center" paddingX="32" paddingTop="24" paddingBottom="80">
      <Column fillWidth maxWidth="l" gap="24">
        <Row fillWidth horizontal="between" vertical="center" gap="8" wrap>
          <Button variant="tertiary" size="s" prefixIcon="arrowLeft" href={`/${username}`}>
            Volver al perfil
          </Button>
          <Row gap="8" vertical="center" wrap>
            {isOwnProfile && (
              <Row gap="8" vertical="center">
                <Button
                  variant="secondary"
                  size="s"
                  prefixIcon="edit"
                  onClick={() => (gated ? setUpsellOpen(true) : setEditorOpen(true))}
                >
                  Editar CV
                </Button>
                <Tag variant="gradient" size="s" prefixIcon="shield" label="Pro" />
              </Row>
            )}
            {gated ? (
              <Button
                variant="tertiary"
                size="s"
                prefixIcon="document"
                onClick={() => setUpsellOpen(true)}
              >
                Imprimir CV
              </Button>
            ) : (
              <Button
                variant="tertiary"
                size="s"
                prefixIcon="document"
                href={`/${username}/cv/imprimir`}
              >
                Imprimir CV
              </Button>
            )}
          </Row>
        </Row>

        <Row fillWidth>
          <Row maxWidth={12} m={{ hide: true }} />
          <Row fillWidth horizontal="center">
            <Column as="section" fillWidth maxWidth="m" gap="l">
              <Row fillWidth gap="40" s={{ direction: "column" }}>
                {/* Columna de identidad: avatar, ubicación e idiomas — sticky
                    en desktop (mismo `top` que HeadingNav más abajo), estática
                    en móvil para no tapar el contenido al hacer scroll. */}
                <Column
                  flex="1"
                  gap="16"
                  minWidth={0}
                  position="sticky"
                  top="80"
                  s={{ position: "static" }}
                >
                  <Avatar {...avatarProps} size="xl" />
                  <Row gap="8" vertical="center">
                    <Icon name="globe" size="s" onBackground="neutral-weak" />
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      {cvData.location}
                    </Text>
                  </Row>
                  <Row gap="8" wrap>
                    {cvData.languages.map((lang) => (
                      <Tag key={lang} size="s" variant="neutral" label={lang} />
                    ))}
                  </Row>
                </Column>

                {/* Columna principal: encabezado + secciones ancladas por el TOC */}
                <Column flex="3" gap="40" minWidth={0}>
                  <Column gap="8">
                    <Row gap="8" vertical="center" wrap>
                      <Heading as="h1" variant="display-strong-l">
                        {displayName}
                      </Heading>
                      <Tag variant="gradient" size="s" prefixIcon="shield" label="Pro" />
                    </Row>
                    {headline && (
                      <Text variant="display-default-xs" onBackground="neutral-weak">
                        {headline}
                      </Text>
                    )}
                    {(primaryRole || secondaryRoles.length > 0) && (
                      <Row gap="8" wrap>
                        {primaryRole && <RoleTag role={primaryRole} variant="primary" />}
                        {secondaryRoles.map((role) => (
                          <RoleTag key={role} role={role} variant="secondary" />
                        ))}
                      </Row>
                    )}
                  </Column>

                  <Column gap="16">
                    <Heading as="h2" id="introduccion" variant="display-strong-xs">
                      Introducción
                    </Heading>
                    <Text variant="body-default-m" onBackground="neutral-weak">
                      {cvData.intro}
                    </Text>
                  </Column>

                  <Column gap="24">
                    <Row gap="8" vertical="center">
                      <Icon name="briefcase" size="s" onBackground="neutral-weak" />
                      <Heading as="h2" id="experiencia" variant="display-strong-xs">
                        Experiencia laboral
                      </Heading>
                    </Row>
                    <Column gap="32">
                      {cvData.experiences.map((exp) => (
                        <Column key={exp.id} gap="8" fillWidth>
                          <Row fillWidth horizontal="between" wrap gap="8">
                            <Text variant="label-strong-m">{exp.company}</Text>
                            <Text variant="label-default-s" onBackground="neutral-weak">
                              {formatRange(exp)}
                            </Text>
                          </Row>
                          <Text variant="body-default-m">{exp.role}</Text>
                          <Text variant="body-default-s" onBackground="neutral-weak">
                            {exp.description}
                          </Text>
                          <Column gap="8" paddingTop="4">
                            {exp.achievements.map((achievement) => (
                              <Row key={achievement} gap="8" vertical="start">
                                <Icon
                                  name="check"
                                  size="xs"
                                  onBackground="brand-medium"
                                  style={{ marginTop: "2px", flexShrink: 0 }}
                                />
                                <Text
                                  variant="body-default-s"
                                  onBackground="neutral-weak"
                                  style={{ minWidth: 0 }}
                                >
                                  {achievement}
                                </Text>
                              </Row>
                            ))}
                          </Column>
                        </Column>
                      ))}
                    </Column>
                  </Column>

                  <Column gap="16">
                    <Row gap="8" vertical="center">
                      <Icon name="sparkles" size="s" onBackground="neutral-weak" />
                      <Heading as="h2" id="skills" variant="display-strong-xs">
                        Skills
                      </Heading>
                    </Row>
                    <Row fillWidth gap="8" wrap>
                      {cvData.skills.map((skill) => (
                        <Row
                          key={skill.name}
                          gap="4"
                          vertical="center"
                          background="neutral-weak"
                          border="neutral-alpha-medium"
                          radius="s"
                          paddingX="8"
                          paddingY="4"
                        >
                          <Text variant="label-default-s">{skill.name}</Text>
                          <Row gap="2" vertical="center">
                            {[1, 2, 3, 4, 5].map((dot) => (
                              <Row
                                key={dot}
                                width="4"
                                height="4"
                                radius="full"
                                background={dot <= skill.level ? "brand-strong" : "neutral-alpha-medium"}
                              />
                            ))}
                          </Row>
                        </Row>
                      ))}
                    </Row>
                  </Column>

                  <Column gap="16">
                    <Row gap="8" vertical="center">
                      <Icon name="book" size="s" onBackground="neutral-weak" />
                      <Heading as="h2" id="formacion" variant="display-strong-xs">
                        Formación
                      </Heading>
                    </Row>
                    <Column gap="12">
                      {cvData.education.map((entry) => (
                        <Row key={entry.id} fillWidth horizontal="between" vertical="start" gap="8" wrap>
                          <Text variant="body-default-m" style={{ minWidth: 0 }}>
                            {entry.title} · {entry.institution}
                          </Text>
                          <Text variant="label-default-s" onBackground="neutral-weak">
                            {entry.year}
                          </Text>
                        </Row>
                      ))}
                    </Column>
                  </Column>
                </Column>
              </Row>
            </Column>
          </Row>
          <Column
            maxWidth={12}
            paddingLeft="40"
            fitHeight
            position="sticky"
            top="80"
            gap="16"
            m={{ hide: true }}
          >
            {tocReady && <HeadingNav fitHeight />}
          </Column>
        </Row>
      </Column>
      <ScrollToHash />
      {isOwnProfile && (
        <CvEditorDialog
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          cvData={cvData}
          username={username}
        />
      )}
      {isOwnProfile && (
        <ProUpsellModal
          isOpen={upsellOpen}
          onClose={() => setUpsellOpen(false)}
          title="Completa tu CV Live"
          message="Completa tu CV, compártelo y ten más difusión con una suscripción Pro"
          benefits={CV_LIVE_UPSELL_BENEFITS}
        />
      )}
    </Column>
  );
}

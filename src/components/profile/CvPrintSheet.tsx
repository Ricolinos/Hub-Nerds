"use client";

import { Button, Column, Row, Text } from "@once-ui-system/core";
import type { CvData, CvExperience } from "@/lib/cvData";
import styles from "./CvPrintSheet.module.scss";

// ─── Hoja imprimible del CV — ventaja Freelancer Pro (ver src/lib/proPlans.ts →
// advantages[0]/CV Live) ────────────────────────────────────────────────────
// Réplica en tamaño carta (8.5×11in, ver CvPrintSheet.module.css @page) de la
// página CV Live (src/components/profile/CvLivePage.tsx), pensada para
// "Imprimir → Guardar como PDF" desde el navegador. El contenido imprimible
// usa HTML semántico + el CSS module dedicado (no Once UI/tokens del tema:
// la impresión necesita fondo blanco y texto oscuro fijos). El toolbar de
// arriba sí usa componentes Once UI porque solo se ve en pantalla.

function formatRange(exp: CvExperience): string {
  return `${exp.startLabel} – ${exp.endLabel ?? "Presente"}`;
}

interface CvPrintSheetProps {
  username: string;
  displayName: string;
  headline?: string | null;
  primaryRole?: string | null;
  secondaryRoles?: string[];
  cvData: CvData;
  qrDataUrl: string;
}

export function CvPrintSheet({
  username,
  displayName,
  headline,
  primaryRole,
  secondaryRoles = [],
  cvData,
  qrDataUrl,
}: CvPrintSheetProps) {
  const roles = [primaryRole, ...secondaryRoles].filter((role): role is string => Boolean(role));
  const qrCaption =
    cvData.qrTarget === "cv" ? "Escanéalo para ver mi CV interactivo" : "Escanéalo para ver mi portafolio";

  return (
    // Column (no Fragment): LayoutShell envuelve el contenido de página en un
    // Flex de dirección "row" (src/components/LayoutShell.tsx), así que un
    // Fragment con dos hijos de nivel superior (toolbar + hoja) quedaría uno
    // al lado del otro en vez de apilado — bug real detectado con Playwright
    // en viewport móvil (el toolbar se achicaba a ~67px de ancho). Un único
    // Column raíz fuerza el apilado vertical sin importar el padre, mismo
    // patrón que CvLivePage.tsx (`Column as="main"`).
    <Column as="main" fillWidth>
      <Row
        className={styles.toolbar}
        fillWidth
        horizontal="between"
        vertical="center"
        wrap
        gap="16"
        paddingX="32"
        paddingY="16"
        background="page"
        borderBottom="neutral-alpha-medium"
      >
        <Button variant="tertiary" size="s" prefixIcon="arrowLeft" href={`/${username}/cv`}>
          Volver al CV
        </Button>
        <Text variant="body-default-s" onBackground="neutral-weak" align="center">
          El QR de esta hoja apunta a {cvData.qrTarget === "cv" ? "tu CV interactivo" : "tu portafolio"}. Para
          cambiarlo, edítalo desde "Editar CV".
        </Text>
        <Button variant="primary" size="s" prefixIcon="download" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </Button>
      </Row>

      <div className={styles.page}>
        <div className={styles.sheet}>
          {/* Nota: div, no <header> — el tag semántico colisionaría con el
              selector global :global(header) del CSS module (pensado para
              ocultar el <Header> del sitio en impresión) y desaparecería
              este bloque también. */}
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.name}>{displayName}</h1>
              {headline && <p className={styles.headline}>{headline}</p>}
              <p className={styles.meta}>
                {cvData.location} · {cvData.languages.join(", ")} · @{username}
              </p>
              {roles.length > 0 && <p className={styles.roles}>{roles.join(" · ")}</p>}
            </div>
            <div className={styles.qrBlock}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Código QR" className={styles.qrImage} width={96} height={96} />
              <p className={styles.qrCaption}>{qrCaption}</p>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Introducción</h2>
            <p className={styles.bodyText}>{cvData.intro}</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Experiencia laboral</h2>
            {cvData.experiences.map((exp) => (
              <div key={exp.id} className={styles.experience}>
                <div className={styles.experienceHead}>
                  <span className={styles.company}>{exp.company}</span>
                  <span className={styles.dates}>{formatRange(exp)}</span>
                </div>
                <p className={styles.role}>{exp.role}</p>
                {exp.description && <p className={styles.bodyTextSmall}>{exp.description}</p>}
                {exp.achievements.length > 0 && (
                  <ul className={styles.achievements}>
                    {exp.achievements.map((achievement) => (
                      <li key={achievement}>{achievement}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Skills</h2>
            <div className={styles.skills}>
              {cvData.skills.map((skill) => (
                <span key={skill.name} className={styles.skillChip}>
                  {skill.name}
                  <span className={styles.dots}>
                    {[1, 2, 3, 4, 5].map((dot) => (
                      <span key={dot} className={dot <= skill.level ? styles.dotFilled : styles.dotEmpty} />
                    ))}
                  </span>
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Formación</h2>
            {cvData.education.map((entry) => (
              <div key={entry.id} className={styles.educationRow}>
                <span>
                  {entry.title} · {entry.institution}
                </span>
                <span className={styles.dates}>{entry.year}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </Column>
  );
}

import Image from "next/image";
import { Column, Grid, Row, SmartLink, Text } from "@once-ui-system/core";
import { LEGAL_DOCS } from "@/resources";
import styles from "./Footer.module.scss";

type FooterLink = { label: string; href: string };

const exploreLinks: FooterLink[] = [
  { label: "Animación", href: "/explorar/animacion" },
  { label: "Branding", href: "/explorar/branding" },
  { label: "Ilustración", href: "/explorar/ilustracion" },
];

const serviceLinks: FooterLink[] = [
  { label: "Cotiza tu proyecto", href: "/servicios/cotizador" },
  { label: "Diseño Estratégico", href: "/servicios/informacion" },
  { label: "Facturación", href: "/servicios/facturacion" },
];

const accountLinks: FooterLink[] = [
  // "Proyectos" apunta al router universal (src/app/dashboard/page.tsx), que
  // redirige por rol (client|collaborator); el Footer no tiene noción de rol.
  { label: "Panel de proyectos", href: "/dashboard" },
  { label: "Configuración", href: "/dashboard/client/settings" },
];

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <Column gap="16">
      <Text variant="label-strong-m">{title}</Text>
      <Column gap="12">
        {links.map((link) => (
          <SmartLink key={link.href} href={link.href}>
            <Text variant="body-default-s" onBackground="neutral-weak">
              {link.label}
            </Text>
          </SmartLink>
        ))}
      </Column>
    </Column>
  );
}

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    // El fondo/borde va en este Column fillWidth (edge-to-edge, igual que el
    // masthead del Header): lo que se acota a maxWidth="l" es el Column
    // interior de abajo, para que en 4K las 4 columnas de enlaces no se
    // dispersen por los 3840px del viewport.
    <Column
      as="footer"
      paddingY="64"
      paddingX="32"
      background="surface"
      borderTop="neutral-alpha-weak"
      fillWidth
      horizontal="center"
    >
      <Column fillWidth maxWidth="l">
        <Grid columns={4} m={{ columns: 2 }} s={{ columns: 1 }} gap="40" fillWidth paddingBottom="48">
          <Column gap="16">
            <Row>
              <Image
                src="/trademark/icon-dark.svg"
                alt="HUB-NERDS"
                width={32}
                height={35}
                className={styles.logoDark}
              />
              <Image
                src="/trademark/icon-light.svg"
                alt="HUB-NERDS"
                width={32}
                height={35}
                className={styles.logoLight}
              />
            </Row>
            <Text variant="body-default-s" onBackground="neutral-weak">
              Una colaboración de creativos: la plataforma B2B donde marcas y estudios conectan con
              el mejor talento creativo de Latinoamérica.
            </Text>
          </Column>
          <FooterColumn title="Explorar" links={exploreLinks} />
          <FooterColumn title="Servicios" links={serviceLinks} />
          <FooterColumn title="Mi Cuenta" links={accountLinks} />
        </Grid>
        <Row
          horizontal="between"
          vertical="center"
          paddingTop="32"
          borderTop="neutral-alpha-weak"
          fillWidth
          gap="16"
          s={{ direction: "column" }}
        >
          <Row gap="16" wrap vertical="center">
            <Text variant="body-default-xs" onBackground="neutral-weak">
              © {currentYear} HUB-NERDS. Todos los derechos reservados.
            </Text>
            <SmartLink href={LEGAL_DOCS.terms.href}>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                Términos y Condiciones
              </Text>
            </SmartLink>
            <SmartLink href={LEGAL_DOCS.privacy.href}>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                Privacidad
              </Text>
            </SmartLink>
          </Row>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Diseñado con Once UI, sistema de diseño de{" "}
            <SmartLink href="https://github.com/lorant-one">Lorànt One</SmartLink>.
          </Text>
        </Row>
      </Column>
    </Column>
  );
};

import {
  Avatar,
  Background,
  Button,
  Column,
  Grid,
  Heading,
  Icon,
  IconButton,
  Line,
  RevealFx,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";
import type { MockBrandPage } from "@/lib/mockBrandPage";

interface ClientBrandPageViewProps {
  brand: MockBrandPage;
}

// Maqueta de la "brand page" pública que traería Client Pro — espejo del
// portafolio del freelancer pero para marcas. Todo el contenido llega vía
// props desde src/lib/mockBrandPage.ts (mock temporal, sin BD todavía).
export function ClientBrandPageView({ brand }: ClientBrandPageViewProps) {
  return (
    <Column fillWidth horizontal="center" paddingX="24" paddingTop="16" minWidth={0}>
      <Column fillWidth maxWidth="l" gap="40" minWidth={0}>
        {/* ── Cabecera de marca ────────────────────────────────────────── */}
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="32"
          gap="24"
          overflow="hidden"
          minWidth={0}
        >
          <Background
            position="absolute"
            top="0"
            left="0"
            fill
            pointerEvents="none"
            gradient={{
              display: true,
              colorStart: "brand-alpha-medium",
              colorEnd: "page-background",
              x: 15,
              y: 0,
              width: 130,
              height: 130,
            }}
            dots={{ display: true, opacity: 30, size: "2", color: "brand-background-strong" }}
          />

          <Column zIndex={1} gap="24" fillWidth minWidth={0}>
            <Row fillWidth gap="24" wrap s={{ direction: "column" }}>
              <Row gap="20" vertical="center" flex={1} minWidth={0} fillWidth>
                <Avatar value={brand.initials} size="l" />
                <Column gap="8" minWidth={0}>
                  <Row gap="8" vertical="center" wrap>
                    <Heading as="h1" variant="heading-strong-l" style={{ overflowWrap: "anywhere" }}>
                      {brand.name}
                    </Heading>
                    <Tag size="s" variant="brand" prefixIcon="sparkles" label="Pro" />
                  </Row>
                  <Text
                    variant="body-default-m"
                    onBackground="neutral-weak"
                    style={{ fontStyle: "italic", overflowWrap: "break-word" }}
                  >
                    “{brand.motto}”
                  </Text>
                  <Row gap="8" wrap>
                    <Tag size="s" variant="neutral" prefixIcon="briefcase" label={brand.industry} />
                    <Tag size="s" variant="neutral" prefixIcon="mapPin" label={brand.location} />
                  </Row>
                </Column>
              </Row>

              <Row gap="8" vertical="center">
                <Button variant="primary" size="m" prefixIcon="email">
                  Contactar
                </Button>
                <IconButton
                  icon="infoCircle"
                  variant="tertiary"
                  size="m"
                  tooltip="Vista previa: el contacto real llega con Client Pro"
                  tooltipPosition="top"
                />
              </Row>
            </Row>

            <Line background="neutral-alpha-weak" />

            <Row gap="32" wrap>
              {brand.stats.map((stat) => (
                <Row key={stat.label} gap="8" vertical="center" minWidth={0}>
                  <Icon name={stat.icon} size="s" onBackground="brand-medium" />
                  <Text variant="label-strong-m" onBackground="neutral-strong">
                    {stat.value}
                  </Text>
                  <Text
                    variant="label-default-s"
                    onBackground="neutral-weak"
                    style={{ overflowWrap: "break-word" }}
                  >
                    {stat.label}
                  </Text>
                </Row>
              ))}
            </Row>
          </Column>
        </Column>

        {/* ── Proyectos realizados ─────────────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Proyectos realizados
          </Heading>
          <Grid columns="2" gap="16" s={{ columns: 1 }}>
            {brand.projects.map((project, index) => (
              <RevealFx key={project.id} translateY="8" delay={index * 0.1}>
                <Column
                  fillWidth
                  background="surface"
                  border="neutral-alpha-weak"
                  radius="l"
                  overflow="hidden"
                  minWidth={0}
                >
                  <Column fillWidth height="128" position="relative">
                    <Background
                      position="absolute"
                      top="0"
                      left="0"
                      fill
                      pointerEvents="none"
                      gradient={{
                        display: true,
                        colorStart: "brand-alpha-medium",
                        colorEnd: "accent-alpha-weak",
                        x: (index * 35) % 100,
                        y: 30,
                        width: 200,
                        height: 200,
                      }}
                      dots={{ display: true, opacity: 20, size: "2", color: "neutral-background-strong" }}
                    />
                  </Column>
                  <Column padding="16" gap="8" minWidth={0}>
                    <Row fillWidth horizontal="between" vertical="start" gap="8">
                      <Tag size="s" variant="neutral" label={project.category} />
                      <IconButton
                        icon="infoCircle"
                        size="s"
                        variant="tertiary"
                        tooltip={project.description}
                        tooltipPosition="top"
                      />
                    </Row>
                    <Text
                      variant="label-strong-m"
                      onBackground="neutral-strong"
                      style={{ overflowWrap: "break-word" }}
                    >
                      {project.title}
                    </Text>
                  </Column>
                </Column>
              </RevealFx>
            ))}
          </Grid>
        </Column>

        {/* ── Freelancers de confianza ─────────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Freelancers de confianza
          </Heading>
          <Row gap="16" wrap fillWidth>
            {brand.trustedFreelancers.map((freelancer) => (
              <Row
                key={freelancer.id}
                gap="12"
                vertical="center"
                background="neutral-alpha-weak"
                border="neutral-alpha-weak"
                radius="m"
                padding="12"
                minWidth={0}
              >
                <Avatar value={(freelancer.name[0] ?? "F").toUpperCase()} size="m" />
                <Column gap="2" minWidth={0}>
                  <Text
                    variant="label-default-m"
                    onBackground="neutral-strong"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {freelancer.name}
                  </Text>
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {freelancer.specialty}
                  </Text>
                </Column>
              </Row>
            ))}
          </Row>
        </Column>

        {/* ── Contacto final ───────────────────────────────────────────── */}
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="24"
          gap="12"
          horizontal="center"
          center
          minWidth={0}
        >
          <Icon name="email" size="m" onBackground="brand-medium" />
          <Text
            variant="body-default-m"
            onBackground="neutral-weak"
            align="center"
            style={{ overflowWrap: "break-word" }}
          >
            ¿Interesado en trabajar con {brand.name}? Escríbeles directamente desde Hub-Nerds.
          </Text>
          <Button variant="secondary" size="m" prefixIcon="email">
            Contactar a {brand.name}
          </Button>
        </Column>
      </Column>
    </Column>
  );
}

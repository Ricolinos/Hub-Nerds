"use client";

import {
  Avatar,
  BarChart,
  Button,
  Chip,
  Column,
  Grid,
  Heading,
  Icon,
  IconButton,
  LineChart,
  Line,
  PieChart,
  ProgressBar,
  Row,
  Tag,
  Text,
  RevealFx,
} from "@once-ui-system/core";
import { useState } from "react";
import type { MockClientPanel } from "@/lib/mockClientPanel";

interface ClientProPanelPreviewProps {
  panel: MockClientPanel;
}

// Maqueta del "Panel Client Pro" — espejo del dashboard que traería Client
// Pro para gestionar varios proyectos y freelancers a la vez. Todo el
// contenido llega vía props desde src/lib/mockClientPanel.ts (mock temporal,
// sin BD todavía).
export function ClientProPanelPreview({ panel }: ClientProPanelPreviewProps) {
  const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<string[]>([
    panel.alertFreelancers[0]?.id ?? "",
  ]);
  const [selectedPreset, setSelectedPreset] = useState<string>(panel.alertPresets[0] ?? "");

  const toggleFreelancer = (id: string) => {
    setSelectedFreelancerIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <Column fillWidth horizontal="center" paddingX="24" paddingTop="16" minWidth={0}>
      <Column fillWidth maxWidth="l" gap="40" minWidth={0}>
        {/* ── Encabezado ───────────────────────────────────────────────── */}
        <Column gap="4" minWidth={0}>
          <Row gap="8" vertical="center" wrap>
            <Heading as="h1" variant="heading-strong-l">
              Panel de {panel.client.name}
            </Heading>
            <Tag size="s" variant="brand" prefixIcon="sparkles" label="Pro" />
          </Row>
          <Row gap="8" vertical="center">
            <Icon name="mapPin" size="xs" onBackground="neutral-weak" />
            <Text variant="body-default-s" onBackground="neutral-weak">
              {panel.client.city}
            </Text>
          </Row>
        </Column>

        {/* ── 1. Sugerencias para ti ──────────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Sugerencias para ti
          </Heading>
          <Grid columns="3" gap="16" s={{ columns: 1 }}>
            {panel.suggestedFreelancers.map((freelancer, index) => (
              <RevealFx key={freelancer.id} translateY="8" delay={index * 0.1}>
                <Column
                  fillWidth
                  background="surface"
                  border="neutral-alpha-weak"
                  radius="l"
                  padding="16"
                  gap="12"
                  minWidth={0}
                >
                  <Row gap="12" vertical="center" minWidth={0}>
                    <Avatar value={freelancer.initials} size="m" />
                    <Column gap="2" minWidth={0} flex={1}>
                      <Text
                        variant="label-strong-m"
                        onBackground="neutral-strong"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {freelancer.name}
                      </Text>
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        {freelancer.specialty}
                      </Text>
                    </Column>
                    <Tag size="s" variant="success" label={`${freelancer.affinity}%`} />
                  </Row>
                  <Row gap="8" wrap>
                    {freelancer.reasons.map((reason) => (
                      <Tag
                        key={reason}
                        size="s"
                        variant="neutral"
                        label={reason}
                        style={{ overflowWrap: "break-word" }}
                      />
                    ))}
                  </Row>
                </Column>
              </RevealFx>
            ))}
          </Grid>
        </Column>

        {/* ── 2. Proyectos en simultáneo ──────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Proyectos en simultáneo
          </Heading>
          <Grid columns="3" gap="16" s={{ columns: 1 }}>
            {panel.activeProjects.map((project) => (
              <Column
                key={project.id}
                fillWidth
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
                padding="16"
                gap="12"
                minWidth={0}
              >
                <Text
                  variant="label-strong-m"
                  onBackground="neutral-strong"
                  style={{ overflowWrap: "break-word" }}
                >
                  {project.name}
                </Text>
                <ProgressBar value={project.progress} label fillWidth />
                <Row horizontal="between" vertical="center" gap="8" wrap>
                  <Row gap="8" vertical="center" minWidth={0}>
                    <Avatar value={project.freelancerInitials} size="xs" />
                    <Text
                      variant="label-default-s"
                      onBackground="neutral-weak"
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {project.freelancerName}
                    </Text>
                  </Row>
                  <Row gap="4" vertical="center">
                    <Icon name="calendar" size="xs" onBackground="neutral-weak" />
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      {project.nextDelivery}
                    </Text>
                  </Row>
                </Row>
              </Column>
            ))}
          </Grid>
        </Column>

        {/* ── 3. Gráficas ──────────────────────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Rendimiento
          </Heading>
          <Grid columns="3" gap="16" s={{ columns: 1 }}>
            <BarChart
              title="Avance por proyecto"
              description="% completado"
              minHeight={16}
              axis="x"
              grid="y"
              legend={{ display: false }}
              barWidth="m"
              series={[{ key: "avance", color: "blue" }]}
              data={panel.performance.progressByProject.map((point) => ({
                label: point.label,
                avance: point.value,
              }))}
            />
            <LineChart
              title="Entregas por semana"
              description="Piezas entregadas"
              minHeight={16}
              axis="x"
              grid="y"
              legend={{ display: false }}
              series={[{ key: "entregas", color: "green" }]}
              data={panel.performance.deliveriesByWeek.map((point) => ({
                label: point.label,
                entregas: point.value,
              }))}
            />
            <PieChart
              title="Inversión por categoría"
              description="% del gasto total"
              minHeight={16}
              legend={{ display: true, position: "bottom-center" }}
              series={{ key: "value" }}
              data={panel.performance.investmentByCategory.map((point) => ({
                name: point.label,
                value: point.value,
              }))}
            />
          </Grid>
        </Column>

        {/* ── 4. Alertas rápidas ───────────────────────────────────────── */}
        <Column
          fillWidth
          background="surface"
          border="neutral-alpha-weak"
          radius="l"
          padding="24"
          gap="16"
          minWidth={0}
        >
          <Row gap="8" vertical="center">
            <Icon name="bell" size="s" onBackground="brand-medium" />
            <Heading as="h2" variant="heading-strong-m">
              Alertas rápidas
            </Heading>
          </Row>
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ overflowWrap: "break-word" }}>
            Manda un aviso instantáneo a los freelancers con los que trabajas.
          </Text>

          <Column gap="8" minWidth={0}>
            <Text variant="label-default-s" onBackground="neutral-weak">
              Para
            </Text>
            <Row gap="8" wrap>
              {panel.alertFreelancers.map((freelancer) => (
                <Chip
                  key={freelancer.id}
                  label={freelancer.name}
                  prefixIcon="person"
                  selected={selectedFreelancerIds.includes(freelancer.id)}
                  onClick={() => toggleFreelancer(freelancer.id)}
                />
              ))}
            </Row>
          </Column>

          <Column gap="8" minWidth={0}>
            <Text variant="label-default-s" onBackground="neutral-weak">
              Mensaje
            </Text>
            <Row gap="8" wrap>
              {panel.alertPresets.map((preset) => (
                <Chip
                  key={preset}
                  label={preset}
                  selected={selectedPreset === preset}
                  onClick={() => setSelectedPreset(preset)}
                />
              ))}
            </Row>
          </Column>

          <Row>
            <Button variant="primary" size="m" prefixIcon="bell">
              Enviar alerta
            </Button>
          </Row>
        </Column>

        {/* ── 5. Contactos directos ───────────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Contactos directos
          </Heading>
          <Column
            fillWidth
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
            overflow="hidden"
            minWidth={0}
          >
            {panel.contacts.map((contact, index) => (
              <Column key={contact.id} fillWidth minWidth={0}>
                {index > 0 && <Line background="neutral-alpha-weak" />}
                <Row
                  fillWidth
                  padding="16"
                  gap="12"
                  vertical="center"
                  horizontal="between"
                  wrap
                  minWidth={0}
                >
                  <Row gap="12" vertical="center" minWidth={0}>
                    <Avatar value={contact.name[0]?.toUpperCase() ?? "F"} size="s" />
                    <Column gap="2" minWidth={0}>
                      <Text
                        variant="label-default-m"
                        onBackground="neutral-strong"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {contact.name}
                      </Text>
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        {contact.specialty}
                      </Text>
                    </Column>
                  </Row>

                  {contact.unlocked ? (
                    <Row gap="16" vertical="center" wrap>
                      <Row gap="4" vertical="center">
                        <Icon name="whatsapp" size="xs" onBackground="success-medium" />
                        <Text variant="label-default-s" onBackground="neutral-strong">
                          {contact.whatsapp}
                        </Text>
                      </Row>
                      <Row gap="4" vertical="center">
                        <Icon name="email" size="xs" onBackground="neutral-weak" />
                        <Text variant="label-default-s" onBackground="neutral-strong">
                          {contact.email}
                        </Text>
                      </Row>
                      <IconButton
                        icon="eye"
                        size="s"
                        variant="tertiary"
                        tooltip="Contacto directo activado por este freelancer"
                        tooltipPosition="top"
                      />
                    </Row>
                  ) : (
                    <Row gap="8" vertical="center">
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Contacto oculto
                      </Text>
                      <IconButton
                        icon="eyeOff"
                        size="s"
                        variant="tertiary"
                        tooltip="Este freelancer no ha activado “Permitir que los Clients Pro me contacten directamente”"
                        tooltipPosition="top"
                      />
                    </Row>
                  )}
                </Row>
              </Column>
            ))}
          </Column>
        </Column>

        {/* ── 6. Grupos de chat organizados ────────────────────────────── */}
        <Column gap="16" fillWidth minWidth={0}>
          <Heading as="h2" variant="heading-strong-m">
            Grupos de chat organizados
          </Heading>
          <Grid columns="3" gap="16" s={{ columns: 1 }}>
            {panel.chatGroups.map((group) => (
              <Row
                key={group.id}
                fillWidth
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
                padding="16"
                gap="12"
                vertical="center"
                minWidth={0}
              >
                <Row
                  width="40"
                  height="40"
                  radius="m"
                  background="brand-alpha-weak"
                  horizontal="center"
                  vertical="center"
                >
                  <Icon name={group.icon} size="s" onBackground="brand-medium" />
                </Row>
                <Column gap="2" flex={1} minWidth={0}>
                  <Text
                    variant="label-default-m"
                    onBackground="neutral-strong"
                    style={{ overflowWrap: "break-word" }}
                  >
                    {group.projectName}
                  </Text>
                  <Row gap="4" vertical="center">
                    <Icon name="userGroup" size="xs" onBackground="neutral-weak" />
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      {group.members} miembros
                    </Text>
                  </Row>
                </Column>
                {group.unread > 0 && <Tag size="s" variant="brand" label={`${group.unread}`} />}
              </Row>
            ))}
          </Grid>
        </Column>
      </Column>
    </Column>
  );
}

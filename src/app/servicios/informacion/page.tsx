import type { IconName } from "@once-ui-system/core";
import {
  AccordionGroup,
  Button,
  Column,
  Feedback,
  Grid,
  Heading,
  Icon,
  Line,
  RevealFx,
  Row,
  Text,
} from "@once-ui-system/core";

export const metadata = {
  title: "Información",
  description:
    "Cómo trabajamos, de dónde salen los precios del cotizador, uso permitido y plantillas de referencia de Hub-Nerds.",
};

const PROCESS_STEPS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "document",
    title: "Brief",
    description: "Nos cuentas tu proyecto, objetivos y referencias.",
  },
  {
    icon: "edit",
    title: "Propuesta",
    description: "Preparamos alcance, tiempos y una cotización a medida.",
  },
  {
    icon: "paintBrush",
    title: "Producción",
    description: "Diseñamos, iteramos contigo y afinamos cada detalle.",
  },
  {
    icon: "check",
    title: "Entrega",
    description: "Recibes los archivos finales listos para usar.",
  },
];

const SERVICES: { icon: IconName; label: string }[] = [
  { icon: "sparkles", label: "Branding" },
  { icon: "film", label: "Motion graphics" },
  { icon: "carousel", label: "Plecas" },
  { icon: "shapes", label: "Videobugs" },
  { icon: "refreshCw", label: "Wippers" },
  { icon: "paintBrush", label: "Ilustración" },
];

const USAGE_ITEMS = [
  {
    title: "Qué puedes hacer en Hub-Nerds",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Cotizar y contratar proyectos creativos con fines comerciales legítimos, dar seguimiento a
        entregas, chatear con tu Freelancer o client y compartir archivos de trabajo. La plataforma
        está pensada para relaciones profesionales reales entre clients y diseñadores/animadores.
      </Text>
    ),
  },
  {
    title: "Qué no está permitido",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        No se permite subir o solicitar contenido ilegal, enviar spam, suplantar identidades ni usar
        la plataforma para fines distintos a la colaboración creativa. Las cuentas que incumplan
        estas reglas pueden suspenderse sin previo aviso.
      </Text>
    ),
  },
];

const LEGAL_ITEMS = [
  {
    title: "Propiedad intelectual",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Cada Freelancer conserva los derechos de autor sobre su trabajo, salvo que exista un acuerdo
        específico de cesión con el client (por ejemplo, dentro del contrato del proyecto). Las
        plantillas y recursos de referencia disponibles en esta página son modelos genéricos, no
        documentos legales personalizados.
      </Text>
    ),
  },
  {
    title: "Privacidad de datos de contacto",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Los datos de contacto directo (como WhatsApp) solo se comparten entre client y Freelancer
        cuando ambas partes lo autorizan explícitamente. El resto de la comunicación puede seguir
        por el chat de la plataforma.
      </Text>
    ),
  },
  {
    title: "Limitación de responsabilidad",
    content: (
      <Text variant="body-default-s" onBackground="neutral-weak">
        Hub-Nerds facilita el contacto, la cotización y el seguimiento del proyecto, pero no es
        parte del acuerdo comercial entre client y Freelancer. La plataforma no se hace responsable
        por disputas, incumplimientos o resultados del trabajo entregado.
      </Text>
    ),
  },
];

const TEMPLATES: { icon: IconName; title: string; description: string; filename: string }[] = [
  {
    icon: "document",
    title: "Contrato de servicios",
    description: "Partes, alcance, entregables, calendario de pagos en MXN y derechos de uso.",
    filename: "contrato-de-servicios-template.md",
  },
  {
    icon: "creditCard",
    title: "Formato de cotización",
    description: "Desglose de conceptos, totales y condiciones de pago listos para personalizar.",
    filename: "formato-cotizacion-template.md",
  },
  {
    icon: "briefcase",
    title: "Datos para factura (CFDI)",
    description: "Campos fiscales que necesitas pedirle a tu client para timbrar.",
    filename: "formato-factura-datos.md",
  },
];

export default function InformacionPage() {
  return (
    <Column fillWidth maxWidth="l" paddingY="80" paddingX="24" gap="48" horizontal="center">
      <RevealFx fillWidth translateY="8" horizontal="center">
        <Column fillWidth gap="16" horizontal="center" align="center" maxWidth="s">
          <Heading variant="display-strong-l" align="center">
            Información
          </Heading>
          <Text onBackground="neutral-weak" variant="body-default-l" align="center">
            Quiénes somos, cómo trabajamos, de dónde salen los precios y qué puedes esperar de la
            plataforma.
          </Text>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.1}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Sobre la plataforma</Heading>
          <Row
            fillWidth
            gap="16"
            s={{ direction: "column" }}
            padding="24"
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
          >
            <Icon
              name="sparkles"
              size="l"
              padding="16"
              radius="l"
              background="neutral-alpha-weak"
              border="neutral-alpha-weak"
            />
            <Column gap="8">
              <Text variant="label-strong-m" onBackground="neutral-strong">
                Hub-Nerds
              </Text>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Hub-Nerds nació de Ricardo (Ricolinos), diseñador gráfico y motion animator
                mexicano, para resolver un problema que vivió de primera mano: cotizar, dar
                seguimiento y entregar proyectos creativos suele estar disperso entre chats, hojas
                de cálculo y carpetas sueltas. La plataforma centraliza cotización, mensajería,
                proyectos y entregas entre clients y una comunidad de diseñadores/animadores
                ("Freelancers"), para profesionalizar la colaboración creativa en México.
              </Text>
            </Column>
          </Row>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.15}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Cómo trabajamos</Heading>
          <Grid columns={4} m={{ columns: 2 }} s={{ columns: 1 }} gap="16" fillWidth>
            {PROCESS_STEPS.map((step) => (
              <Column
                key={step.title}
                gap="12"
                padding="24"
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
              >
                <Icon
                  name={step.icon}
                  size="l"
                  padding="16"
                  radius="l"
                  background="neutral-alpha-weak"
                  border="neutral-alpha-weak"
                />
                <Text variant="label-strong-m" onBackground="neutral-strong">
                  {step.title}
                </Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {step.description}
                </Text>
              </Column>
            ))}
          </Grid>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.2}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Qué cubre el estudio</Heading>
          <Row gap="16" wrap>
            {SERVICES.map((service) => (
              <Row
                key={service.label}
                gap="8"
                vertical="center"
                padding="16"
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
              >
                <Icon name={service.icon} size="s" onBackground="neutral-weak" />
                <Text variant="label-default-m" onBackground="neutral-strong">
                  {service.label}
                </Text>
              </Row>
            ))}
          </Row>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.25}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Metodología de costos del cotizador</Heading>
          <Row
            fillWidth
            gap="16"
            s={{ direction: "column" }}
            padding="24"
            background="surface"
            border="neutral-alpha-weak"
            radius="l"
          >
            <Icon
              name="briefcase"
              size="l"
              padding="16"
              radius="l"
              background="neutral-alpha-weak"
              border="neutral-alpha-weak"
            />
            <Column gap="4">
              <Text variant="label-strong-m" onBackground="neutral-strong">
                Cobramos por proyecto
              </Text>
              <Text variant="body-default-s" onBackground="neutral-weak">
                Sin tarifas por hora: cada cotización cubre el proyecto completo, de principio a
                fin.
              </Text>
            </Column>
          </Row>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Los rangos que arroja el cotizador se arman a partir de tres ingredientes: promedios
            publicados del mercado creativo mexicano, tabuladores de referencia usados por el gremio
            de diseño y motion, y la experiencia acumulada de proyectos reales entregados en la
            plataforma. Cada cifra se ajusta después según la complejidad técnica, la urgencia del
            entregable y el alcance de uso. El resultado es una{" "}
            <strong>referencia orientativa, no una cotización cerrada</strong>: el monto final
            siempre lo confirma el Freelancer asignado tras revisar tu brief completo.
          </Text>
        </Column>
      </RevealFx>

      <Line background="neutral-alpha-weak" />

      <RevealFx fillWidth translateY="8" delay={0.3}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Uso y restricciones</Heading>
          <AccordionGroup items={USAGE_ITEMS} />
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.35}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Legales y derechos de uso</Heading>
          <AccordionGroup items={LEGAL_ITEMS} />
        </Column>
      </RevealFx>

      <Line background="neutral-alpha-weak" />

      <RevealFx fillWidth translateY="8" delay={0.4}>
        <Column fillWidth gap="24">
          <Heading variant="display-strong-xs">Descargas</Heading>
          <Text variant="body-default-s" onBackground="neutral-weak">
            Plantillas de referencia para tus proyectos. Revísalas y ajústalas con tu propio asesor
            legal o contable antes de usarlas.
          </Text>
          <Grid columns={3} m={{ columns: 1 }} gap="16" fillWidth>
            {TEMPLATES.map((template) => (
              <Column
                key={template.filename}
                gap="12"
                padding="24"
                background="surface"
                border="neutral-alpha-weak"
                radius="l"
              >
                <Icon
                  name={template.icon}
                  size="l"
                  padding="16"
                  radius="l"
                  background="neutral-alpha-weak"
                  border="neutral-alpha-weak"
                />
                <Text variant="label-strong-m" onBackground="neutral-strong">
                  {template.title}
                </Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  {template.description}
                </Text>
                <Button
                  href={`/plantillas/${template.filename}`}
                  download
                  variant="secondary"
                  size="s"
                  prefixIcon="download"
                  label="Descargar"
                />
              </Column>
            ))}
          </Grid>
        </Column>
      </RevealFx>

      <RevealFx fillWidth translateY="8" delay={0.45}>
        <Feedback
          variant="warning"
          title="Antes de continuar"
          description={
            "Hub-Nerds facilita el contacto y la gestión del proyecto, pero el acuerdo final es entre el Client y el Freelancer. La plataforma no se hace responsable por el mal uso del servicio, y los montos del cotizador son estimaciones: siempre confirma alcance, tiempos y precio directamente con tu Freelancer antes de arrancar."
          }
        />
      </RevealFx>
    </Column>
  );
}

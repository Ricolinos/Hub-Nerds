import { Column, Grid, Heading, List, ListItem, Text } from "@once-ui-system/core";
import { LEGAL_DOCS, LEGAL_UPDATED_LABEL } from "@/resources";

export const metadata = {
  title: LEGAL_DOCS.privacy.title,
  description: LEGAL_DOCS.privacy.description,
};

export default function PrivacidadPage() {
  return (
    <Column fillWidth gap="40">
      <Column gap="8">
        <Heading variant="display-strong-s">
          POLÍTICA DE PRIVACIDAD Y USO DE INTELIGENCIA ARTIFICIAL
        </Heading>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Última actualización: {LEGAL_UPDATED_LABEL}
        </Text>
      </Column>

      <Text variant="body-default-m" onBackground="neutral-weak">
        Normativa de Referencia: Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares (LFPDPPP), publicada en el Diario Oficial de la Federación el 20 de marzo de
        2025, vigente en México, así como sus disposiciones reglamentarias, lineamientos, criterios
        y demás normativa aplicable en materia de protección de datos personales.
      </Text>

      <Text variant="body-default-m" onBackground="neutral-weak">
        En Hub-Nerds, nos tomamos muy en serio la seguridad de tu información personal y tus
        activos creativos. Esta política explica cómo recopilamos, usamos, protegemos y procesamos
        tus datos.
      </Text>

      <Column gap="16">
        <Heading variant="display-strong-xs">1. RECOPILACIÓN DE DATOS</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Recopilamos la siguiente información para poder prestar nuestros servicios:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Datos de Identidad e Inicio de Sesión:</strong> Nombre, correo electrónico,
            fotografía de perfil y autenticación gestionada a través de nuestros proveedores
            seguros (Clerk).
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Datos de Perfil y Portafolio:</strong> Rol profesional, casos de estudio,
            archivos multimedia adjuntos y enlaces de proyectos.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Datos de Facturación y Pagos:</strong> Información de procesamiento
            transaccional procesada mediante pasarelas de pago cifradas (Stripe / PayPal).
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Metadatos de Uso y Navegación:</strong> Tiempos de interacción, registros de
            actividad en proyectos, visualizaciones de portafolio y logs del sistema.
          </ListItem>
        </List>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">2. PROTECCIÓN Y CONFIDENCIALIDAD</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Implementamos estándares de seguridad de nivel industrial para garantizar que tus datos
          estén protegidos:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Cifrado:</strong> Toda la información en tránsito está protegida mediante
            TLS/SSL y los datos en reposo se almacenan con algoritmos de cifrado avanzado (AES-256)
            en nuestras bases de datos en Supabase.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Acceso Restringido:</strong> Solo el personal autorizado y con acuerdos de
            confidencialidad estrictos puede acceder a la infraestructura operativa de la
            Plataforma.
          </ListItem>
        </List>
      </Column>

      <Column gap="24">
        <Heading variant="display-strong-xs">
          3. USO DE INTELIGENCIA ARTIFICIAL Y ENTRENAMIENTO DE ALGORITMOS
        </Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Hub-Nerds integra herramientas de Inteligencia Artificial para optimizar la
          compatibilidad entre postulantes y convocatorias, automatizar flujos de trabajo en
          proyectos colaborativos y mejorar la experiencia de usuario.
        </Text>

        <Grid columns={2} s={{ columns: 1 }} gap="16" fillWidth>
          <Column
            gap="12"
            padding="24"
            radius="l"
            border="success-alpha-medium"
            background="success-alpha-weak"
          >
            <Text variant="heading-strong-s" onBackground="success-strong">
              Uso permitido para modelos internos
            </Text>
            <List>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Metadatos de uso anonimizados
              </ListItem>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Patrones de interacción agregados
              </ListItem>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Roles y etiquetas de categorías
              </ListItem>
            </List>
          </Column>
          <Column
            gap="12"
            padding="24"
            radius="l"
            border="danger-alpha-medium"
            background="danger-alpha-weak"
          >
            <Text variant="heading-strong-s" onBackground="danger-strong">
              Contenido estrictamente protegido
            </Text>
            <List>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Archivos crudos de diseño
              </ListItem>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Briefs confidenciales B2B
              </ListItem>
              <ListItem variant="body-default-m" onBackground="neutral-weak">
                Mensajes y chats privados
              </ListItem>
            </List>
          </Column>
        </Grid>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            3.1 Datos Agregados y Metadatos para Modelos Propios
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Aceptas que Hub-Nerds pueda utilizar metadatos, estadísticas de interacción
            anonimizadas y patrones de comportamiento agrupados (por ejemplo: &quot;porcentaje de
            cumplimiento de tareas en roles de diseño&quot;) para entrenar y calibrar sus
            algoritmos de recomendación y coincidencia de perfiles internos. Ninguno de estos
            procesos revelará tu identidad personal.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            3.2 Protección Absoluta del Contenido Creativo y Confidencial
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            <strong>Garantía Anti-Entrenamiento:</strong> Hub-Nerds NO utilizará tus archivos
            crudos de diseño, piezas visuales completas de portafolios, briefs comerciales
            confidenciales de Clients, ni mensajes privados intercambiados en el gestor de
            proyectos para entrenar modelos de Inteligencia Artificial generativa propios o de
            terceros, salvo que otorgues tu consentimiento explícito por escrito.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            3.3 Mecanismo de Opt-Out (Exclusión Voluntaria)
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Tienes el derecho absoluto de solicitar que tus metadatos y patrones de navegación no
            sean procesados para la mejora de modelos algorítmicos. Puedes activar esta opción en
            la sección de Ajustes de Privacidad de tu perfil o enviando una solicitud por correo a
            ricardo@ricolinos.com.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            3.4 Postura sobre IA Generativa en los Proyectos y Transparencia
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Hub-Nerds respeta el uso moderado y transparente de la inteligencia artificial
            generativa como herramienta de apoyo, priorizando siempre a los creativos y sus
            procesos frente al desplazamiento por IA. Todo proyecto que emplee IA generativa en
            una parte sustancial de su proceso debe declararlo de manera explícita, y la
            Plataforma se reserva el derecho de retirar los proyectos en los que se detecte uso no
            declarado. Consulta la §8 de los Términos y Condiciones para el detalle completo de
            esta política.
          </Text>
        </Column>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">4. CESIÓN A TERCEROS</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Hub-Nerds no vende, alquila ni comercializa tus datos personales a terceros bajo ninguna
          circunstancia. Únicamente compartimos datos con proveedores de infraestructura
          esenciales que cumplen con normativas globales de privacidad:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Procesadores de Pago:</strong> Stripe / PayPal (para ejecutar dispersiones
            financieras).
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Autenticación e Infraestructura:</strong> Clerk y Supabase (para gestión de
            identidad y base de datos).
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Servicios de Email:</strong> Resend (para el envío de notificaciones del
            sistema y cotizaciones).
          </ListItem>
        </List>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">5. DERECHOS DEL TITULAR Y CONTACTO</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte (Derechos ARCO / GDPR) al
          tratamiento de tus datos personales en cualquier momento. Para ejercer estos derechos,
          contáctanos en:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Correo electrónico:</strong> ricardo@ricolinos.com
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Domicilio Legal:</strong> Avenida Juárez, No. 30, Villa del Carbón, Edo. Mex.
          </ListItem>
        </List>
      </Column>
    </Column>
  );
}

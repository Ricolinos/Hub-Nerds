import { Column, Heading, List, ListItem, Text } from "@once-ui-system/core";
import { LEGAL_DOCS, LEGAL_UPDATED_LABEL } from "@/resources";

export const metadata = {
  title: LEGAL_DOCS.terms.title,
  description: LEGAL_DOCS.terms.description,
};

export default function TerminosPage() {
  return (
    <Column fillWidth gap="40">
      <Column gap="8">
        <Heading variant="display-strong-s">TÉRMINOS Y CONDICIONES DEL SERVICIO DE HUB-NERDS</Heading>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Última actualización: {LEGAL_UPDATED_LABEL}
        </Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          Jurisdicción y Ley Aplicable: Ciudad de México, México
        </Text>
      </Column>

      <Text variant="body-default-m" onBackground="neutral-weak">
        Bienvenido a Hub-Nerds (hub-nerds.com). Al registrarte, acceder o utilizar nuestra
        plataforma, aceptas de manera explícita y vinculante quedar sujeto a los presentes Términos
        y Condiciones. Si no estás de acuerdo con alguna parte de este documento, deberás
        abstenerte de utilizar la plataforma.
      </Text>

      <Column gap="24">
        <Heading variant="display-strong-xs">1. ACEPTACIÓN Y MODIFICACIONES</Heading>

        <Column gap="12">
          <Heading variant="heading-strong-s">1.1 Naturaleza del Acuerdo</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            El presente contrato regula la relación entre Hub-Nerds, plataforma operada por
            Ricardo Gómez Ruiz Velasco, persona física con domicilio fiscal en Avenida Juárez, No.
            30, Villa del Carbón, Edo. Mex. Marca comercial en proceso de constitución. (en
            adelante, &quot;Hub-Nerds&quot; o &quot;la Plataforma&quot;) y los usuarios registrados
            en el sistema.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">1.2 Modificaciones a los Términos</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Hub-Nerds se reserva el derecho de actualizar o modificar estos Términos y Condiciones
            en cualquier momento. Notificaremos cualquier cambio sustancial con al menos 15 días de
            antelación a través de:
          </Text>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              Un correo electrónico enviado a la dirección asociada a tu cuenta.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              Un banner o aviso emergente (pop-up) dentro de la plataforma.
            </ListItem>
          </List>
          <Text variant="body-default-m" onBackground="neutral-weak">
            El uso continuado de Hub-Nerds tras la fecha de entrada en vigor de las modificaciones
            constituirá tu aceptación tácita de los nuevos términos.
          </Text>
        </Column>
      </Column>

      <Column gap="24">
        <Heading variant="display-strong-xs">2. CUENTAS DE USUARIO Y ROLES</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Hub-Nerds opera como un ecosistema B2B y marketplace creativo. Para mantener la seguridad
          y calidad, los usuarios se categorizan en dos roles principales:
        </Text>

        <Column gap="12">
          <Heading variant="heading-strong-s">2.1 Roles del Sistema</Heading>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Clients:</strong> Empresas, marcas o estudios que publican convocatorias,
              abren proyectos colaborativos y contratan talento creativo.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Freelancers:</strong> Creativos y profesionales de la industria que postulan
              a convocatorias mediante su portafolio y desarrollan entregables para Clients.
            </ListItem>
          </List>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">2.2 Reglas Generales de Cuenta</Heading>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Veracidad:</strong> Te comprometes a proporcionar información verdadera,
              precisa y actualizada durante el registro y en la creación de tu portafolio/perfil.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Seguridad:</strong> Eres el único responsable de mantener la confidencialidad
              de tus credenciales de acceso y de cualquier actividad realizada desde tu cuenta.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Matriz de Roles de Perfil:</strong> Los Freelancers podrán exhibir un Rol
              Principal y un máximo de 2 Roles Secundarios en su perfil público.
            </ListItem>
          </List>
        </Column>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">
          3. MODELO DE CONVOCATORIAS Y FILOSOFÍA &quot;ANTI SPEC-WORK&quot;
        </Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Hub-Nerds prohíbe explícitamente el trabajo especulativo gratuito (spec-work). Las
          convocatorias publicadas por los Clients operan bajo el siguiente flujo de estados:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Postulación:</strong> Los Freelancers postulan únicamente vinculando casos de
            estudio y piezas existentes de su portafolio actual junto con un pitch. Queda
            estrictamente prohibido que los Clients soliciten trabajo original gratuito en esta
            fase.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Shortlist (Terna Finalista):</strong> El Client selecciona únicamente a una
            terna de finalistas. Solo estos Freelancers seleccionados desarrollarán una
            propuesta/entrega formal y recibirán obligatoriamente un shortlist fee garantizado, el
            cual será depositado previamente por el Client en la Plataforma.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Adjudicación (Awarded):</strong> El Client elige la propuesta ganadora para el
            desarrollo total o la entrega final del proyecto.
          </ListItem>
        </List>
      </Column>

      <Column gap="24">
        <Heading variant="display-strong-xs">4. PROPIEDAD INTELECTUAL (PI)</Heading>

        <Column gap="12">
          <Heading variant="heading-strong-s">4.1 Titularidad Originaria del Freelancer</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Los Freelancers conservan en todo momento la titularidad originaria de los derechos de
            autor morales y patrimoniales sobre todas las obras, diseños, ideas o piezas
            preexistentes que formen parte de su portafolio o de sus postulaciones iniciales.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            4.2 Cesión de Derechos Condicionada al Pago Total
          </Heading>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              Cuando un Freelancer desarrolle una entrega final o propuesta adjudicada para un
              Client, la transferencia de los derechos de explotación comercial (modelo Work for
              Hire o Cesión Patrimonial de Derechos) a favor del Client ocurrirá única y
              exclusivamente tras el pago del 100% de la tarifa acordada.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              Si el Client no liquida la totalidad del importe retenido o pactado, los derechos de
              explotación sobre el material entregado no se transferirán, y el Client no podrá
              utilizar, reproducir ni difundir dicho trabajo bajo ninguna circunstancia.
            </ListItem>
          </List>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">4.3 Licencia de Promoción para la Plataforma</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Salvo que el usuario configure expresamente su contenido o proyecto como
            &quot;Privado&quot; en las opciones de su perfil, los Freelancers otorgan a Hub-Nerds
            una licencia mundial, no exclusiva, libre de regalías y temporal para mostrar sus casos
            de estudio y piezas de portafolio únicamente con fines de promoción, marketing y
            exhibición del talento dentro y fuera del sitio web de la Plataforma.
          </Text>
        </Column>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">5. PAGOS, CUSTODIA Y COMISIONES</Heading>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Comisión por Servicio:</strong> Hub-Nerds cobrará una comisión fija del 5%
            sobre el monto total de cada transacción o proyecto adjudicado en concepto de uso de la
            plataforma, infraestructura técnica y mediación.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Sistema de Fondos en Garantía (Escrow):</strong> Los pagos de los Clients para
            convocatorias y proyectos se retendrán en custodia temporal a través de nuestros
            procesadores de pago seguros. Los fondos se liberarán al Freelancer una vez que el hito
            o la entrega correspondiente sea aprobada en la plataforma.
          </ListItem>
        </List>
      </Column>

      <Column gap="24">
        <Heading variant="display-strong-xs">
          6. LIMITACIÓN DE RESPONSABILIDAD E INTERMEDIACIÓN
        </Heading>

        <Column gap="12">
          <Heading variant="heading-strong-s">6.1 Naturaleza de Intermediario</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Hub-Nerds es una plataforma tecnológica de intermediación. Hub-Nerds no es una agencia
            de empleo, ni actúa como patrón o empleador directo de los Freelancers.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">6.2 Exención de Responsabilidades</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Hub-Nerds no se hace legal ni financieramente responsable por:
          </Text>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              La calidad técnica o estética final del trabajo realizado por un Freelancer.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              El incumplimiento de plazos por parte de los Freelancers o la falta de claridad en
              los briefs por parte de los Clients.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              Daños indirectos, diferidos o pérdidas financieras entre las partes.
            </ListItem>
          </List>
          <Text variant="body-default-m" onBackground="neutral-weak">
            No obstante, Hub-Nerds pone a disposición de ambas partes herramientas internas de
            mediación y resolución de disputas para solucionar controversias de forma amigable.
          </Text>
        </Column>
      </Column>

      <Column gap="16">
        <Heading variant="display-strong-xs">7. SUSPENSIÓN Y TERMINACIÓN DE CUENTAS</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          Hub-Nerds se reserva el derecho de suspender temporalmente o cancelar de forma definitiva
          la cuenta de cualquier usuario, sin responsabilidad para la Plataforma, bajo los
          siguientes supuestos:
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Desintermediación:</strong> Intentar o realizar pagos fuera de la plataforma
            con el fin de evadir las comisiones de Hub-Nerds.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Acoso o Comportamiento Tóxico:</strong> Conductas difamatorias, lenguaje de
            odio o acoso hacia otros miembros del ecosistema o al equipo de la Plataforma.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Fraude o Violación de PI:</strong> Subir trabajo plagiado, atribuirse autorías
            falsas o utilizar tarjetas de crédito/métodos de pago fraudulentos.
          </ListItem>
        </List>
      </Column>
    </Column>
  );
}

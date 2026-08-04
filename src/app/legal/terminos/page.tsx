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

      <Column gap="24">
        <Heading variant="display-strong-xs">
          3. MODELO DE CONVOCATORIAS Y FILOSOFÍA &quot;ANTI SPEC-WORK&quot;
        </Heading>

        <Column gap="12">
          <Heading variant="heading-strong-s">3.1 Filosofía Anti Spec-Work y Flujo</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Hub-Nerds prohíbe explícitamente el trabajo especulativo gratuito (spec-work). Las
            convocatorias publicadas por los Clients operan bajo el siguiente flujo de estados:
          </Text>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Postulación:</strong> Los Freelancers postulan únicamente vinculando casos
              de estudio y piezas existentes de su portafolio actual junto con un pitch. Queda
              estrictamente prohibido que los Clients soliciten trabajo original gratuito en esta
              fase.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Shortlist (Terna Finalista):</strong> El Client selecciona únicamente a una
              terna de finalistas. Solo estos Freelancers seleccionados desarrollarán una
              propuesta/entrega formal y recibirán obligatoriamente un shortlist fee garantizado,
              el cual será depositado previamente por el Client en la Plataforma.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Adjudicación (Awarded):</strong> El Client elige la propuesta ganadora para
              el desarrollo total o la entrega final del proyecto.
            </ListItem>
          </List>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">3.2 Cupos de Publicación por Plan</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            La cantidad de convocatorias que un Client puede mantener activas o publicar depende
            del plan contratado:
          </Text>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Cuentas Client Free:</strong> máximo una (1) convocatoria publicada activa
              en simultáneo, y una (1) publicación por periodo móvil de noventa (90) días
              naturales (máximo cuatro al año).
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Cuentas Client Pro:</strong> máximo dos (2) convocatorias activas en
              simultáneo, y dos (2) publicaciones por periodo móvil de noventa (90) días naturales
              (máximo ocho al año).
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Borradores:</strong> Los borradores no publicados no consumen cupo anual. No
              obstante, las cuentas Free no pueden mantener más de una convocatoria activa,
              incluyendo borradores.
            </ListItem>
          </List>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">3.3 Configuración según el Plan</Heading>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Client Free:</strong> configuración estándar. Las fechas límite no admiten
              prórrogas ni modificaciones una vez publicada la convocatoria. El premio debe ser
              estrictamente monetario y cubrirse de forma anticipada e íntegra (100%) antes de la
              publicación; no se admite premio en especie.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Client Pro:</strong> puede establecer cláusulas, términos y condiciones
              particulares adicionales para su convocatoria, siempre que no contravengan los
              presentes Términos (en caso de conflicto, prevalecerán los de la Plataforma); puede
              estructurar la convocatoria en etapas o fases; y puede solicitar prórrogas conforme
              a las reglas de la Plataforma.
            </ListItem>
          </List>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">3.4 Premios Monetarios (Client Pro)</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            El valor del premio se entrega a la Plataforma en custodia (escrow) en dos
            exhibiciones: cincuenta por ciento (50%) para poder publicar la convocatoria, y el
            cincuenta por ciento (50%) restante liquidado a más tardar diez (10) días naturales
            antes del cierre de la convocatoria. La falta de liquidación oportuna faculta a la
            Plataforma para suspender la convocatoria y aplicar lo previsto en materia de
            incumplimiento en la §7.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">
            3.5 Premios en Especie (Exclusivo Client Pro)
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            El premio en especie está disponible únicamente para cuentas Client Pro, bajo dos
            modalidades:
          </Text>
          <List>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Entrega directa:</strong> el Client retribuye a la Plataforma una tarifa del
              ocho por ciento (8%) del valor total declarado del premio, pagadera antes de la
              publicación, y suscribe una carta de responsabilidad mediante la cual asume de
              manera exclusiva y total la obligación de entrega del premio a finalistas y
              ganador.
            </ListItem>
            <ListItem variant="body-default-m" onBackground="neutral-weak">
              <strong>Entrega mediante la Plataforma:</strong> el Client retribuye a la Plataforma
              una tarifa del doce por ciento (12%) del valor total declarado, y la Plataforma
              asume el compromiso de entrega del premio o premios al ganador y finalistas.
            </ListItem>
          </List>
          <Text variant="body-default-m" onBackground="neutral-weak">
            En ambos casos, el valor declarado del premio debe ser veraz; la falsedad se
            considerará fraude conforme a la §7.
          </Text>
        </Column>

        <Column gap="12">
          <Heading variant="heading-strong-s">3.6 Incumplimiento del Client (BREACHED)</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Si el Client no emite fallo dentro de los siete (7) días naturales posteriores a la
            fecha de resultados de la convocatoria, esta se marcará automáticamente como
            incumplida (&quot;BREACHED&quot;), con las consecuencias reputacionales y de
            suspensión previstas en la §7.
          </Text>
        </Column>
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
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Tarifas de Premios en Convocatorias:</strong> Las tarifas descritas en las §3.4
            (premios monetarios) y §3.5 (premios en especie, 8% o 12% según modalidad) son
            independientes de la comisión general del 5% y se aplican exclusivamente sobre el
            valor del premio de la convocatoria.
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

      <Column gap="16">
        <Heading variant="display-strong-xs">
          8. USO DE INTELIGENCIA ARTIFICIAL EN LOS PROYECTOS
        </Heading>
        <Text variant="body-default-m" onBackground="neutral-weak">
          La Plataforma no se posiciona en contra absoluta de la inteligencia artificial y respeta
          el uso moderado de herramientas de IA generativa como apoyo dentro del proceso creativo,
          siempre bajo el principio de transparencia.
        </Text>
        <Text variant="body-default-m" onBackground="neutral-weak">
          No obstante, Hub-Nerds se decanta por conservar el arte para los artistas y por proteger
          la esencia de la creatividad y los procesos de los creativos frente al desplazamiento
          por IA generativa.
        </Text>
        <List>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Obligación de declaración:</strong> Todo proyecto publicado o solicitado en la
            Plataforma que haya empleado IA generativa en cualquier parte sustancial de su proceso
            debe declararlo de manera explícita.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Prohibición de uso no declarado:</strong> Está prohibido usar IA generativa en
            la Plataforma sin anunciarlo.
          </ListItem>
          <ListItem variant="body-default-m" onBackground="neutral-weak">
            <strong>Consecuencias:</strong> Hub-Nerds se reserva el derecho de retirar o dar de
            baja proyectos en los que se detecte uso de IA no declarado, y de aplicar lo previsto
            en la §7 en casos de reincidencia.
          </ListItem>
        </List>
      </Column>
    </Column>
  );
}

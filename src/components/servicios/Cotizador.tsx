"use client";

import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Button,
  Card,
  Column,
  Feedback,
  Heading,
  Icon,
  IconButton,
  Input,
  Line,
  Row,
  SegmentedControl,
  Select,
  Switch,
  Text,
  Textarea,
} from "@once-ui-system/core";
import { sendQuote } from "@/app/actions/sendQuote";
import { selectValue } from "@/lib/onceUiSelect";

/* ══ Catálogo de servicios y precios base (MXN, sin IVA) ═════════════════════ */

type Disciplina  = "diseno" | "ilustracion" | "motion";
type Complejidad = "S" | "M" | "C";
type Cliente     = "nacional" | "trasnacional";
type Difusion    = "regional" | "estatal" | "nacional" | "internacional";

interface Servicio {
  value: string;
  label: string;
  detalle: string;
  precios: Record<Complejidad, number>; // MXN
}

interface Catalogo {
  label: string;      // nombre de la disciplina
  titulo: string;     // título del selector
  tooltip: string;    // explicación del selector
  items: Servicio[];
}

const CATALOGOS: Record<Disciplina, Catalogo> = {
  diseno: {
    label: "Diseño gráfico",
    titulo: "Tipo de proyecto",
    tooltip: "Elige el entregable principal. Cada proyecto incluye conceptualización, propuestas y rondas de ajustes.",
    items: [
      { value: "logotipo",       label: "Logotipo",                  detalle: "Diseño de logo con propuestas y rondas de ajustes",          precios: { S: 4000,  M: 9000,  C: 18000 } },
      { value: "branding",       label: "Branding completo",         detalle: "Logo, paleta, tipografías, manual y aplicaciones de marca",  precios: { S: 15000, M: 30000, C: 55000 } },
      { value: "rebranding",     label: "Rebranding",                detalle: "Rediseño y actualización de una identidad existente",       precios: { S: 12000, M: 25000, C: 45000 } },
      { value: "manual",         label: "Manual de marca",           detalle: "Guía de uso y aplicaciones para una identidad ya creada",   precios: { S: 8000,  M: 14000, C: 22000 } },
      { value: "pieza",          label: "Pieza comercial",           detalle: "Flyer, banner, espectacular o post individual",             precios: { S: 800,   M: 1500,  C: 3000  } },
      { value: "kit-redes",      label: "Kit de redes sociales",     detalle: "Plantillas y ~10 publicaciones listas para publicar",       precios: { S: 4000,  M: 8000,  C: 14000 } },
      { value: "marketing",      label: "Paquetería de marketing",   detalle: "Key visual de campaña y adaptaciones a distintos formatos", precios: { S: 8000,  M: 15000, C: 28000 } },
      { value: "editorial",      label: "Diseño editorial",          detalle: "Catálogo, revista, ebook o informe anual",                  precios: { S: 6000,  M: 15000, C: 30000 } },
      { value: "empaque",        label: "Empaque / Etiqueta",        detalle: "Diseño gráfico de packaging con mockup",                    precios: { S: 7000,  M: 12000, C: 22000 } },
      { value: "presentacion",   label: "Presentación corporativa",  detalle: "Deck o pitch con diseño a la medida",                       precios: { S: 3500,  M: 7000,  C: 12000 } },
      { value: "web",            label: "Diseño web / UI",           detalle: "Landing o sitio básico (diseño, no desarrollo)",            precios: { S: 9000,  M: 18000, C: 35000 } },
    ],
  },
  ilustracion: {
    label: "Ilustración digital",
    titulo: "Tipo de ilustración",
    tooltip: "Todas las ilustraciones se trabajan en digital, en el estilo que tu proyecto necesite.",
    items: [
      { value: "personaje",   label: "Diseño de personajes",     detalle: "Personaje original con vistas y hoja de modelo",              precios: { S: 2500, M: 5500,  C: 10000 } },
      { value: "escenario",   label: "Diseño de escenarios",     detalle: "Fondos y ambientes para animación, juegos o editorial",       precios: { S: 3000, M: 6500,  C: 12000 } },
      { value: "mascota",     label: "Mascota de marca",         detalle: "Personaje comercial con expresiones y usos de marca",         precios: { S: 4500, M: 9000,  C: 16000 } },
      { value: "editorial",   label: "Ilustración editorial",    detalle: "Portadas, artículos y contenido impreso o digital",           precios: { S: 3500, M: 7000,  C: 13000 } },
      { value: "publicitaria",label: "Ilustración publicitaria", detalle: "Key visual para campañas y anuncios",                         precios: { S: 5000, M: 10000, C: 18000 } },
      { value: "concept",     label: "Concept art",              detalle: "Exploración visual de personajes, props o mundos",            precios: { S: 3000, M: 6000,  C: 11000 } },
      { value: "iconos",      label: "Set de íconos / stickers", detalle: "Set de ~10 piezas con estilo unificado",                      precios: { S: 2500, M: 5000,  C: 9000  } },
      { value: "retrato",     label: "Retrato / avatar",         detalle: "Retrato personalizado o avatar para perfil",                  precios: { S: 1200, M: 2500,  C: 4500  } },
      { value: "patron",      label: "Patrón repetible",         detalle: "Textura o estampado para producto, textil o fondo",           precios: { S: 2000, M: 4000,  C: 7500  } },
      { value: "infografia",  label: "Infografía ilustrada",     detalle: "Datos y procesos explicados visualmente",                     precios: { S: 3000, M: 6000,  C: 10000 } },
    ],
  },
  motion: {
    label: "Motion / Animación",
    titulo: "Tipo de pieza animada",
    tooltip: "Piezas de motion graphics para video, TV, streaming y redes. Incluyen animación y salida en los formatos que necesites.",
    items: [
      { value: "logo-animado", label: "Logo animado",               detalle: "Animación de identidad, de 3 a 7 segundos",                   precios: { S: 2500,  M: 5000,  C: 9000  } },
      { value: "pleca",        label: "Pleca animada (lower third)",detalle: "Rótulos animados de nombre o tema para video",                precios: { S: 1500,  M: 3000,  C: 5500  } },
      { value: "videobug",     label: "Videobug",                   detalle: "Marca de agua o bug animado en pantalla",                     precios: { S: 1200,  M: 2500,  C: 4500  } },
      { value: "wipper",       label: "Wipper / cortinilla",        detalle: "Transición animada entre secciones o escenas",                precios: { S: 1800,  M: 3500,  C: 6500  } },
      { value: "intro",        label: "Intro / outro",              detalle: "Apertura o cierre para video o canal, 5 a 10 segundos",       precios: { S: 3000,  M: 6000,  C: 11000 } },
      { value: "broadcast",    label: "Paquete gráfico completo",   detalle: "Intro, plecas, cortinillas, videobug y créditos",             precios: { S: 12000, M: 25000, C: 45000 } },
      { value: "post",         label: "Post animado para redes",    detalle: "Motion de 10 a 15 segundos listo para publicar",              precios: { S: 3000,  M: 6000,  C: 10000 } },
      { value: "reel",         label: "Reel / story animado",       detalle: "Pieza vertical de 15 a 30 segundos con ritmo y música",       precios: { S: 4000,  M: 8000,  C: 15000 } },
      { value: "explainer",    label: "Video explicativo",          detalle: "Explainer por minuto: guion visual y animación",              precios: { S: 15000, M: 30000, C: 55000 } },
      { value: "kinetic",      label: "Kinetic typography",         detalle: "Texto animado al ritmo del audio, ~30 segundos",              precios: { S: 3500,  M: 7000,  C: 12000 } },
      { value: "gif",          label: "GIF / sticker animado",      detalle: "Loop corto para chats, web o redes",                          precios: { S: 1200,  M: 2500,  C: 4500  } },
    ],
  },
};

// Aumento porcentual sobre el precio base según cliente y difusión: [mínimo, máximo]
const MULTIPLICADORES: Record<Disciplina, Record<Cliente, Record<Difusion, [number, number]>>> = {
  diseno: {
    nacional:     { regional: [50, 100],  estatal: [100, 200], nacional: [200, 300], internacional: [300, 500]  },
    trasnacional: { regional: [200, 300], estatal: [300, 450], nacional: [450, 600], internacional: [600, 1500] },
  },
  ilustracion: {
    nacional:     { regional: [50, 100],  estatal: [100, 150], nacional: [150, 200], internacional: [200, 500]  },
    trasnacional: { regional: [150, 300], estatal: [300, 450], nacional: [450, 600], internacional: [600, 1500] },
  },
  motion: {
    nacional:     { regional: [50, 100],  estatal: [100, 200], nacional: [200, 300], internacional: [300, 500]  },
    trasnacional: { regional: [200, 300], estatal: [300, 450], nacional: [450, 600], internacional: [600, 1500] },
  },
};

// Unidades mínimas para el descuento de mayoreo (−10%)
const UMBRAL_MAYOREO: Record<Disciplina, number> = { diseno: 8, ilustracion: 6, motion: 6 };

// Cesión de archivos editables: factor sobre la cotización
const FACTOR_EDITABLES: Record<Disciplina, number> = { diseno: 1.5, ilustracion: 2, motion: 1.5 };

const COMPLEJIDADES: Record<Disciplina, { value: Complejidad; label: string; detalle: string }[]> = {
  diseno: [
    { value: "S", label: "Sencillo", detalle: "Aplicación directa de estilos ya definidos, pocos elementos" },
    { value: "M", label: "Medio",    detalle: "Conceptualización, varias propuestas y rondas de ajustes"    },
    { value: "C", label: "Complejo", detalle: "Investigación, dirección de arte y sistema visual completo"  },
  ],
  ilustracion: [
    { value: "S", label: "Sencillo", detalle: "Formas simples, paleta reducida, sin fondo"                  },
    { value: "M", label: "Medio",    detalle: "Detalle medio, iluminación y fondo sencillo"                 },
    { value: "C", label: "Complejo", detalle: "Alto detalle, composición elaborada y acabado pulido"        },
  ],
  motion: [
    { value: "S", label: "Sencillo", detalle: "Elementos simples, cortes, fades y movimientos básicos"      },
    { value: "M", label: "Medio",    detalle: "Transiciones elaboradas, ritmo con música y rigging básico"  },
    { value: "C", label: "Complejo", detalle: "Animación avanzada, efectos, personajes y sound design"      },
  ],
};

const CLIENTES: { value: Cliente; label: string; detalle: string }[] = [
  { value: "nacional",     label: "Empresa nacional",     detalle: "Negocio local, PyME o empresa mexicana"            },
  { value: "trasnacional", label: "Empresa trasnacional", detalle: "Corporativo con presencia en varios países"        },
];

const DIFUSIONES: { value: Difusion; label: string; detalle: string }[] = [
  { value: "regional",      label: "Regional",      detalle: "Circulará en una ciudad o zona local"       },
  { value: "estatal",       label: "Estatal",       detalle: "Alcance en todo un estado"                  },
  { value: "nacional",      label: "Nacional",      detalle: "Campañas o medios en todo el país"          },
  { value: "internacional", label: "Internacional", detalle: "Uso fuera de México o alcance global"       },
];

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

// Validación de los datos de contacto (espejo de la validación del servidor)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_REGEX = /^[+\d][\d\s\-()]{6,19}$/;

/* ══ Utilidades de UI ═════════════════════════════════════════════════════════ */

function SectionLabel({ texto, tooltip }: { texto: string; tooltip: string }) {
  return (
    <Row gap="4" vertical="center">
      <Text variant="label-strong-s" onBackground="neutral-weak">
        {texto}
      </Text>
      <IconButton
        icon="infoCircle"
        size="s"
        variant="ghost"
        tooltip={tooltip}
        tooltipPosition="right"
      />
    </Row>
  );
}

/* ══ Componente ═══════════════════════════════════════════════════════════════ */

export function Cotizador() {
  const [disciplina, setDisciplina]   = useState<Disciplina>("diseno");
  const [servicio, setServicio]       = useState(CATALOGOS.diseno.items[0].value);
  const [complejidad, setComplejidad] = useState<Complejidad>("M");
  const [cliente, setCliente]         = useState<Cliente>("nacional");
  const [difusion, setDifusion]       = useState<Difusion>("regional");
  const [cantidad, setCantidad]       = useState(1);
  const [urgente, setUrgente]         = useState(false);
  const [editables, setEditables]     = useState(false);

  const [nombre, setNombre]           = useState("");
  const [whatsapp, setWhatsapp]       = useState("");
  const [correo, setCorreo]           = useState("");
  const [marca, setMarca]             = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [intentado, setIntentado]     = useState(false);
  const [enviando, setEnviando]       = useState(false);
  const [enviado, setEnviado]         = useState(false);
  const [errorEnvio, setErrorEnvio]   = useState<string | null>(null);

  // Autollenado con la sesión de Clerk (solo campos que el visitante no haya escrito)
  const { isLoaded, user } = useUser();
  useEffect(() => {
    if (!isLoaded || !user) return;
    setNombre((v) => v || user.fullName || "");
    setCorreo((v) => v || user.emailAddresses[0]?.emailAddress || "");
    setWhatsapp((v) => v || user.primaryPhoneNumber?.phoneNumber || "");
  }, [isLoaded, user]);

  const catalogo = CATALOGOS[disciplina];
  const item = catalogo.items.find((s) => s.value === servicio) ?? catalogo.items[0];

  const cambiarDisciplina = (v: string) => {
    setDisciplina(v as Disciplina);
    setServicio(CATALOGOS[v as Disciplina].items[0].value);
  };

  const resultado = useMemo(() => {
    const base = item.precios[complejidad];
    const [multMin, multMax] = MULTIPLICADORES[disciplina][cliente][difusion];
    const mayoreo = cantidad >= UMBRAL_MAYOREO[disciplina];
    const factorEditables = editables ? FACTOR_EDITABLES[disciplina] : 1;

    const calcular = (mult: number) => {
      let total = base * (1 + mult / 100) * cantidad;
      if (mayoreo) total *= 0.9;
      if (urgente) total *= 1.5;
      return total * factorEditables;
    };

    return { base, multMin, multMax, mayoreo, min: calcular(multMin), max: calcular(multMax) };
  }, [item, disciplina, complejidad, cliente, difusion, cantidad, urgente, editables]);

  const desglose: { label: string; valor: string }[] = [
    { label: "Precio base",        valor: mxn.format(resultado.base) },
    { label: "Alcance y difusión", valor: `+${resultado.multMin}% a +${resultado.multMax}%` },
    ...(cantidad > 1      ? [{ label: "Cantidad",             valor: `× ${cantidad}` }] : []),
    ...(resultado.mayoreo ? [{ label: "Mayoreo",              valor: "−10%" }] : []),
    ...(urgente           ? [{ label: "Entrega urgente",      valor: "+50%" }] : []),
    ...(editables         ? [{ label: "Archivos editables",   valor: FACTOR_EDITABLES[disciplina] === 2 ? "× 2" : "+50%" }] : []),
  ];

  const nombreValido   = nombre.trim().length > 0;
  const whatsappValido = TEL_REGEX.test(whatsapp.trim());
  const correoValido   = EMAIL_REGEX.test(correo.trim());

  const solicitar = async () => {
    setIntentado(true);
    setErrorEnvio(null);
    if (!nombreValido || !whatsappValido || !correoValido) return;

    setEnviando(true);
    const nivelComplejidad = COMPLEJIDADES[disciplina].find((c) => c.value === complejidad);
    const tipoCliente = CLIENTES.find((c) => c.value === cliente);
    const nivelDifusion = DIFUSIONES.find((d) => d.value === difusion);
    const respuesta = await sendQuote({
      nombre: nombre.trim(),
      whatsapp: whatsapp.trim(),
      correo: correo.trim(),
      marca: marca.trim(),
      descripcion: descripcion.trim(),
      proyecto: `${CATALOGOS[disciplina].label} · ${item.label}`,
      complejidad: `${nivelComplejidad?.label ?? complejidad} — ${nivelComplejidad?.detalle ?? ""}`,
      alcance: `${tipoCliente?.label ?? cliente} · Difusión ${nivelDifusion?.label.toLowerCase() ?? difusion}`,
      estimacion: `${mxn.format(resultado.min)} – ${mxn.format(resultado.max)} MXN`,
      desglose,
    });
    setEnviando(false);

    if (respuesta.ok) {
      setEnviado(true);
      setNombre("");
      setWhatsapp("");
      setCorreo("");
      setMarca("");
      setDescripcion("");
      setIntentado(false);
    } else {
      setErrorEnvio(respuesta.error ?? "No se pudo enviar la solicitud. Intenta de nuevo.");
    }
  };

  return (
    <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
      {/* ── Configuración ─────────────────────────────────────────────────── */}
      <Column flex={7} fillWidth>
        <Card fillWidth padding="32">
          <Column fillWidth gap="24">
            <Column gap="12">
              <SectionLabel
                texto="¿Qué necesitas?"
                tooltip="Elige la disciplina de tu proyecto: diseño gráfico, ilustración digital o animación."
              />
              <SegmentedControl
                selected={disciplina}
                fillWidth={false}
                buttons={(Object.keys(CATALOGOS) as Disciplina[]).map((d) => ({
                  value: d,
                  label: CATALOGOS[d].label,
                }))}
                onToggle={cambiarDisciplina}
              />
              <Select
                id="servicio"
                label={catalogo.titulo}
                options={catalogo.items.map(({ value, label }) => ({ value, label }))}
                value={servicio}
                onSelect={(v) => setServicio(selectValue(v))}
                fillWidth
              />
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {item.detalle}
              </Text>
            </Column>

            <Line background="neutral-alpha-weak" />

            <Column gap="12">
              <SectionLabel
                texto="Nivel de complejidad"
                tooltip="Qué tan elaborada será la pieza: define el tiempo de producción y el nivel de acabado."
              />
              <SegmentedControl
                selected={complejidad}
                buttons={COMPLEJIDADES[disciplina].map(({ value, label }) => ({ value, label }))}
                onToggle={(v) => setComplejidad(v as Complejidad)}
              />
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {COMPLEJIDADES[disciplina].find((c) => c.value === complejidad)?.detalle}
              </Text>
            </Column>

            <Line background="neutral-alpha-weak" />

            <Column gap="12">
              <SectionLabel
                texto="Alcance del proyecto"
                tooltip="El valor de una pieza también depende de quién la usa y dónde circula: a mayor alcance, mayores derechos de uso."
              />
              <SegmentedControl
                selected={cliente}
                fillWidth={false}
                buttons={CLIENTES.map(({ value, label }) => ({ value, label }))}
                onToggle={(v) => setCliente(v as Cliente)}
              />
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {CLIENTES.find((c) => c.value === cliente)?.detalle}
              </Text>
              <Select
                id="difusion"
                label="Difusión del trabajo"
                options={DIFUSIONES.map(({ value, label }) => ({ value, label }))}
                value={difusion}
                onSelect={(v) => setDifusion(v as Difusion)}
                fillWidth
              />
              <Text variant="body-default-xs" onBackground="neutral-weak">
                {DIFUSIONES.find((d) => d.value === difusion)?.detalle}
              </Text>
            </Column>

            <Line background="neutral-alpha-weak" />

            <Column gap="16">
              <SectionLabel
                texto="Detalles adicionales"
                tooltip="Ajustes que modifican la cotización: volumen, urgencia y entrega de archivos fuente."
              />
              <Input
                id="cantidad"
                label="Cantidad de piezas"
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
              />
              <Row gap="12" vertical="center" horizontal="between">
                <Column gap="2">
                  <Text variant="label-default-s">Entrega urgente</Text>
                  <Text variant="body-default-xs" onBackground="neutral-weak">
                    Prioridad sobre otros proyectos (+50%)
                  </Text>
                </Column>
                <Switch
                  isChecked={urgente}
                  onToggle={() => setUrgente((v) => !v)}
                  ariaLabel="Entrega urgente"
                />
              </Row>
              <Row gap="12" vertical="center" horizontal="between">
                <Column gap="2">
                  <Text variant="label-default-s">Archivos editables</Text>
                  <Text variant="body-default-xs" onBackground="neutral-weak">
                    Entrega de archivos fuente (AI, PSD, AE) con derechos ampliados
                  </Text>
                </Column>
                <Switch
                  isChecked={editables}
                  onToggle={() => setEditables((v) => !v)}
                  ariaLabel="Archivos editables"
                />
              </Row>
            </Column>
          </Column>
        </Card>
      </Column>

      {/* ── Estimación ────────────────────────────────────────────────────── */}
      <Column flex={5} fillWidth position="sticky" top="104">
        <Card fillWidth padding="32">
          <Column fillWidth gap="24">
            <Column gap="4">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                Estimación de tu proyecto
              </Text>
              <Heading variant="display-strong-xs">
                {mxn.format(resultado.min)} – {mxn.format(resultado.max)}
              </Heading>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                Pesos mexicanos · IVA no incluido
              </Text>
            </Column>

            <Line background="neutral-alpha-weak" />

            <Column gap="12">
              {desglose.map(({ label, valor }) => (
                <Row key={label} fillWidth horizontal="between" vertical="center">
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    {label}
                  </Text>
                  <Text variant="label-strong-s">{valor}</Text>
                </Row>
              ))}
            </Column>

            <Line background="neutral-alpha-weak" />

            <Column gap="16">
              <Column gap="12" fillWidth>
                <Input
                  id="lead-marca"
                  label="Marca o proyecto"
                  type="text"
                  placeholder="Nombre de tu marca, empresa o proyecto"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                />
                <Input
                  id="lead-nombre"
                  label="Nombre"
                  type="text"
                  placeholder="¿Cómo te llamas?"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  error={intentado && !nombreValido}
                  errorMessage={intentado && !nombreValido ? "Escribe tu nombre" : undefined}
                />
                <Input
                  id="lead-whatsapp"
                  label="WhatsApp"
                  type="tel"
                  placeholder="+52 000 000 0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  error={intentado && !whatsappValido}
                  errorMessage={
                    intentado && !whatsappValido ? "Escribe un número válido" : undefined
                  }
                />
                <Input
                  id="lead-correo"
                  label="Correo electrónico"
                  type="email"
                  placeholder="tu@correo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  error={intentado && !correoValido}
                  errorMessage={
                    intentado && !correoValido ? "Escribe un correo válido" : undefined
                  }
                />
                <Textarea
                  id="lead-descripcion"
                  label="Cuéntame más de tu proyecto"
                  placeholder="Describe qué necesitas, para qué lo usarás, referencias, fechas…"
                  lines={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </Column>

              {enviado && (
                <Feedback
                  variant="success"
                  title="Solicitud enviada"
                  description="Recibí tu cotización y te contactaré muy pronto por WhatsApp o correo."
                  showCloseButton
                  onClose={() => setEnviado(false)}
                />
              )}
              {errorEnvio && (
                <Feedback
                  variant="danger"
                  title="No se pudo enviar"
                  description={errorEnvio}
                  showCloseButton
                  onClose={() => setErrorEnvio(null)}
                />
              )}

              <Button
                fillWidth
                variant="primary"
                size="m"
                arrowIcon
                loading={enviando}
                disabled={enviando}
                onClick={solicitar}
              >
                Solicitar cotización formal
              </Button>
              <Row gap="12" vertical="start" padding="16" radius="l" background="neutral-alpha-weak">
                <Icon name="infoCircle" size="s" onBackground="neutral-weak" />
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  Esta calculadora genera una aproximación de costos con fines orientativos,
                  basada en tarifas promedio del mercado actual para diseño estratégico,
                  desarrollo Next.js y motion graphics. El costo final se pacta directamente
                  contigo, según los requerimientos y el alcance específico de cada proyecto.
                </Text>
              </Row>
            </Column>
          </Column>
        </Card>
      </Column>
    </Row>
  );
}

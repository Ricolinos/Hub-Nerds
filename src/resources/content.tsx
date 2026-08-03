import { About, Blog, Gallery, Home, Newsletter, Person, Social, Work, Cv } from "@/types";
import { Line, Row, Text } from "@once-ui-system/core";

const person: Person = {
  firstName: "Ricardo",
  lastName: "Gómez",
  name: `Ricardo Gómez`,
  role: "Diseñador Gráfico",
  avatar: "/images/avatar.jpg",
  email: "ricardo@ricolinos.com",
  location: "America/Mexico_City", // Expecting the IANA time zone identifier, e.g., 'Europe/Vienna'
  languages: ["Español", "English"], // optional: Leave the array empty if you don't want to display languages
};

const newsletter: Newsletter = {
  display: true,
  title: <>Suscríbete al Blog de {person.firstName}</>,
  description: (
    <>
      Ilustrador ocasional y Animador Motion a tiempo completo. Aquí relato mi experiencia
      en el mundo del diseño y les hago un registro de las herramientas 
      de diseño que me han funcionado.
    </>
  ),
};

const social: Social = [
  // Links are automatically displayed.
  // Import new icons in /once-ui/icons.ts
  // Set essentials: true for links you want to show on the about page
  {
    name: "GitHub",
    icon: "github",
    link: "https://github.com/Ricolinos",
    essential: true,
  },
  {
    name: "LinkedIn",
    icon: "linkedin",
    link: "https://www.linkedin.com/in/ricardo-g%C3%B3mez-ruiz-velasco-448b50aa/",
    essential: true,
  },
  {
    name: "Instagram",
    icon: "instagram",
    link: "https://www.instagram.com/rick.olinos/",
    essential: true,
  },
  {
    name: "Threads",
    icon: "threads",
    link: "https://www.threads.com/@rick.olinos",
    essential: false,
  },
  {
    name: "Email",
    icon: "email",
    link: `mailto:${person.email}`,
    essential: true,
  },
];

const home: Home = {
  path: "/",
  image: "/images/og/home.jpg",
  label: "Home",
  // Marca del sitio (no "Portafolios de..."): el layout raíz usa este valor
  // como default del <title> y como og:title/twitter:title de fallback.
  title: "Hub-Nerds",
  description:
    "Plataforma hecha por un grupo de creativos: diseñadores, realizadores y nerds construyendo el lugar donde el trabajo creativo se encuentra con quien lo necesita.",
  headline: <>Visuales que conectan </>,
  featured: {
    display: true,
    title: (
      <Row gap="12" vertical="center">
        <strong className="ml-4">NBA Emirates 2025</strong>{" "}
        <Line background="brand-alpha-strong" vert height="20" />
        <Text marginRight="4" onBackground="brand-medium">
          Último proyecto
        </Text>
      </Row>
    ),
    href: "/work/Animated-NBA-Cup-2025",
  },
  subline: (
    <>
    Soy Ricardo, <Text as="span" size="xl" weight="strong">Diseñador Gráfico</Text>, <br /> Animador Motion e ilustrador ocasional.
</>
  ),
};

const about: About = {
  path: "/about",
  label: "Sobre mí",
  title: `Sobre ${person.name}`,
  description: `Conoce a ${person.name}, ${person.role} de ${person.location}`,
  tableOfContent: {
    display: true,
    subItems: false,
  },
  avatar: {
    display: true,
  },
  calendar: {
    display: true,
    link: "https://calendar.app.google/uzjKpMvDLW51CwDV8",
  },
  intro: {
    display: true,
    title: "Introducción",
    description: (
      <>
        Ricardo Gómez, Diseñador gráfico apasionado de la ilustración, la animación y la tecnología.
        Originario de la vibrante CDMX. Con estudios en Diseño Gráfico 
        y un diplomado en Creatividad Digital, ha explorado el fascinante mundo del motion graphics,
         la tecnología y un poco de programación web. Para Ricardo, cada desafío es una oportunidad para crear 
         algo único y significativo. 
      </>
    ),
  },
  work: {
    display: true, // set to false to hide this section
    title: "Experiencia Laboral",
    experiences: [
      {
        company: "NBA Mexico (independiente)",
        timeframe: "2021 - A la actualidad",
        role: "Animador Motion",
        achievements: [
          <>
            Diseño y creación de paquetes gráficos, desarrollando contenidos visuales 
            innovadores y atractivos para captar la atención de la audiencia.
          </>,
          <>
            Optimización de proyectos en After Effects, implementando técnicas y flujos de 
            trabajo que redujeron tiempos de entrega y mejoraron la eficiencia del equipo.
          </>,
          <>
            Desarrollo de presentaciones visuales impactantes para la NBA, contribuyendo a 
            fortalecer relaciones con partners comerciales y destacando la marca con un enfoque creativo y profesional.
          </>,
        ],

        images: [
          // optional: leave the array empty if you don't want to display images
          {
            src: "/images/projects/project-NBA/cover-01.png",
            alt: "NBA Projects",
            width: 16,
            height: 9,
          },
        ],
      },
      {
        company: "Helvex",
        timeframe: "2020 - 2021",
        role: "Diseñador Senior",
        achievements: [
          <>
            Desarrollo de la línea gráfica para los contenidos en redes sociales de la "Proyecta", 
            creando una identidad visual coherente y moderna que reforzó la imagen corporativa.
          </>,
          <>
            Seguimiento editorial de catálogos de productos, asegurando la consistencia en el diseño, 
            la calidad visual y el cumplimiento de los plazos de entrega.
          </>,
          <>
          Colaboración con equipos multidisciplinarios para alinear los diseños con las estrategias 
          de marketing y las necesidades del negocio.
        </>,
        <>
          Creación de materiales gráficos para campañas publicitarias, eventos y promociones, 
          logrando una comunicación visual efectiva y atractiva.
        </>,
        ],
        images: [
          // optional: leave the array empty if you don't want to display images
          {
            src: "/images/projects/project-Helvex/img-01.jpg",
            alt: "Once UI Project",
            width: 9,
            height: 9,
          },
        ],
      },
    ],
  },
  studies: {
    display: true, // set to false to hide this section
    title: "Estudios",
    institutions: [
      {
        name: "Universidad Autónoma Metropolitana",
        description: <>Diseño de la comunicación Gráfica</>,
      },
      {
        name: "Invaders Institute",
        description: <>Diplomado en creatividad Digital</>,
      },
    ],
  },
  technical: {
    display: false, // set to false to hide this section
    title: "Habilidades",
    skills: [
      {
        title: "Figma",
        description: <>Able to prototype in Figma with Once UI with unnatural speed.</>,
        // optional: leave the array empty if you don't want to display images
        images: [
          {
            src: "/images/projects/project-01/cover-02.jpg",
            alt: "Project image",
            width: 16,
            height: 9,
          },
          {
            src: "/images/projects/project-01/cover-03.jpg",
            alt: "Project image",
            width: 16,
            height: 9,
          },
        ],
      },
      {
        title: "Next.js",
        description: <>Building next gen apps with Next.js + Once UI + Supabase.</>,
        // optional: leave the array empty if you don't want to display images
        images: [
          {
            src: "/images/projects/project-01/cover-04.jpg",
            alt: "Project image",
            width: 16,
            height: 9,
          },
        ],
      },
      {
        title: "Next.js",
        description: (
          <>Building next gen apps with Next.js + Once UI + Supabase.</>
        ),
        tags: [
          {
            name: "JavaScript",
            icon: "javascript",
          },
          {
            name: "Next.js",
            icon: "nextjs",
          },
          {
            name: "Supabase",
            icon: "supabase",
          },
        ],
        // optional: leave the array empty if you don't want to display images
        images: [
          {
            src: "/images/projects/project-01/cover-04.jpg",
            alt: "Project image",
            width: 16,
            height: 9,
          },
        ],
      },
    ],
  },
};

const blog: Blog = {
  path: "/blog",
  label: "Blog",
  title: "Escribiendo sobre ilustración, tecnología y diseño...",
  description: `Lee las últimas entradas y actualizaciones de ${person.name}`,
  // Create new blog posts by adding a new .mdx file to app/blog/posts
  // All posts will be listed on the /blog route
};

const cv: Cv = {
  path: "/cv",
  label: "CV",
  title: `CV de ${person.name}`,
  description: `Curriculum vitae de ${person.name}`,
};

const work: Work = {
  path: "/work",
  label: "Trabajo",
  title: `Proyectos de ${person.name}`,
  description: `Design and dev projects by ${person.name}`,
  // Create new project pages by adding a new .mdx file to app/blog/posts
  // All projects will be listed on the /home and /work routes
};

const gallery: Gallery = {
  path: "/gallery",
  label: "Galería",
  title: `Galería de ${person.name}`,
  description: `Una muestra visual de los proyectos ejecutados por ${person.name}`,
  // Images by https://lorant.one
  // These are placeholder images, replace with your own
  images: [
    {
      src: "/images/gallery/img-21.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-20.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-19.jpg",
      alt: "image",
      orientation: "square",
    },
    {
      src: "/images/gallery/img-18.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-17.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-16.jpg",
      alt: "image",
      orientation: "square",
    },
    {
      src: "/images/gallery/img-01.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-02.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-03.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-04.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-05.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-06.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-07.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-08.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-09.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-10.jpg",
      alt: "image",
      orientation: "vertical",
    },
    {
      src: "/images/gallery/img-11.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-12.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-13.jpg",
      alt: "image",
      orientation: "horizontal",
    },
    {
      src: "/images/gallery/img-14.jpg",
      alt: "image",
      orientation: "square",
    },
    {
      src: "/images/gallery/img-15.jpg",
      alt: "image",
      orientation: "square",
    },
  ],
};

export { person, social, newsletter, home, about, blog, work, gallery, cv };

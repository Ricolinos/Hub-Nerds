import { Home, Person } from "@/types";
import { Text } from "@once-ui-system/core";

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

const home: Home = {
  path: "/",
  image: "/api/og/generate?title=Hub-Nerds",
  label: "Home",
  // Marca del sitio (no "Portafolios de..."): el layout raíz usa este valor
  // como default del <title> y como og:title/twitter:title de fallback.
  title: "Hub-Nerds",
  description:
    "Plataforma hecha por un grupo de creativos: diseñadores, realizadores y nerds construyendo el lugar donde el trabajo creativo se encuentra con quien lo necesita.",
  headline: <>Visuales que conectan </>,
  subline: (
    <>
    Soy Ricardo, <Text as="span" size="xl" weight="strong">Diseñador Gráfico</Text>, <br /> Animador Motion e ilustrador ocasional.
</>
  ),
};

export { person, home };

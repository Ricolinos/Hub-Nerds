# Hub-Nerds

Hub-Nerds es una plataforma de portafolios y colaboración para diseñadores gráficos y motion animators freelance ("Partners"/Designerds) y sus clientes. Combina portafolio público, cotizador con leads, mensajería, gestión de proyectos conjuntos y una sección de concursos (Brief-hub) para conectar talento con clientes.

En producción: [hub-nerds.com](https://hub-nerds.com)

## Stack

- [Next.js](https://nextjs.org) (App Router) + [Once UI](https://once-ui.com) para UI/tokens
- [Clerk](https://clerk.com) para autenticación
- [Prisma](https://www.prisma.io) + [Supabase](https://supabase.com) (Postgres) como capa de datos
- [Resend](https://resend.com) para envío de correo (leads del cotizador, notificaciones)
- Deploy en [Vercel](https://vercel.com)

## Getting started

**1. Clonar el repositorio**
```
git clone https://github.com/Ricolinos/Hub-Nerds.git
```

**2. Instalar dependencias**
```
npm install
```

**3. Variables de entorno**

Copia `.env.example` a `.env.local` y completa las claves necesarias (Clerk, Supabase/Prisma, Resend, webhook de Clerk, etc.).
```
cp .env.example .env.local
```

**4. Generar el cliente de Prisma**
```
npx prisma generate
```

**5. (Opcional) Sembrar usuarios demo**
```
npm run seed:demo
```
Crea `cliente_demo` / `partner_demo` (código de acceso `424242`) para probar los roles client/collaborator.

**6. Correr el servidor de desarrollo**
```
npm run dev
```

Requiere Node.js v18.17+.

## Funcionalidades principales

- **Portafolio de Partners**: tarjetas Designerd, perfil editable, casos de estudio en MDX con editor de bloques propio.
- **Explorar**: descubrimiento de Partners con scroll infinito.
- **Cotizador**: formulario de cotización que envía leads por correo vía Resend.
- **Mensajería** (`/mensajes`): centro de mensajes cliente↔partner con burbuja flotante, y pipeline de mensaje a tarea.
- **Colaboración**: `Connection` / `CollabProject` entre cliente y partner, con tareas y recursos compartidos.
- **Convocatorias (Brief-hub)**: concursos en dos fases (portafolio + terna pagada) para asignar proyectos sin spec-work.
- **Roles y privacidad**: perfiles de cliente privados a terceros; datos de contacto (WhatsApp) visibles solo con opt-in.

## Estructura relevante

```
src/app/           rutas (App Router)
src/resources/     config de Once UI y contenido
src/lib/           lógica de dominio (portfolio, etc.)
prisma/            schema y migraciones
scripts/           seed de usuarios demo, Agent Studio
.claude/roles/     roles de Agent Studio (supervisor/ui/data)
```

## Scripts útiles

```
npm run dev          servidor de desarrollo
npm run build         build de producción (incluye prisma generate)
npm run lint          lint
npm run seed:demo     siembra usuarios demo
npm run agents         Agent Studio (agentic loop multi-rol)
```

## Flujo de ramas

- `dev` es la rama de staging: PRs de features/fixes van primero a `dev`.
- `main` está protegida y refleja producción; se promueve con un PR `dev` → `main`.

## Licencia

Ver `LICENSE`.

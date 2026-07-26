import mdx from "@next/mdx";

const withMDX = mdx({
  extension: /\.mdx?$/,
  options: {},
});

// Media subida al bucket `portfolio-media` de Supabase Storage (portada +
// bloques del Canvas, ver src/lib/storageUpload.ts) sirve URLs públicas
// bajo este host — sin esto, next/image (Media/Image de Once UI) tira el
// render completo de cualquier página con una de estas URLs. Se deriva de
// NEXT_PUBLIC_SUPABASE_URL (misma instancia dev/prod); en este proyecto
// resuelve a "wlvisgdcoiidlygobepk.supabase.co".
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  transpilePackages: ["next-mdx-remote"],
  experimental: {
    serverActions: {
      // Media NUEVA del editor (portada + bloques) ya sube directo a
      // Supabase Storage (lib/storageUpload.ts) y NO pasa por el body de
      // ninguna server action — el archivo nunca toca este límite. Se
      // mantiene alto (NO bajarlo) por las piezas VIEJAS con data URLs
      // (antes de esta migración, ver lib/coverMedia.ts/lib/files.ts): al
      // reabrirlas para editar, `handleSave` reenvía su `coverUrl`/
      // `contentBlocks`/`gallery` COMPLETOS —con la data URL legacy
      // adentro— aunque el usuario no toque la portada ni los bloques
      // viejos. 15mb cubre un GIF/video legacy grande con margen (base64
      // infla el tamaño real ~4/3, ~33%).
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "**",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
        pathname: "**",
      },
      ...(supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              pathname: "**",
            },
          ]
        : []),
    ],
  },
  sassOptions: {
    compiler: "modern",
    silenceDeprecations: ["legacy-js-api"],
  },
  // "Designerds" se renombró a "Freelancers": el sitio ya está en producción
  // y puede haber enlaces/marcadores viejos apuntando a la ruta anterior.
  async redirects() {
    return [
      {
        source: "/explorar/designerds",
        destination: "/explorar/freelancers",
        permanent: true,
      },
    ];
  },
};

export default withMDX(nextConfig);

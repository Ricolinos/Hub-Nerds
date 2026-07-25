// La plataforma no almacena archivos pesados: todo asset/adjunto de un
// proyecto colaborativo o recurso de client vive como link a un servicio de
// nube externo (Drive, Dropbox, WeTransfer, etc.). Este helper detecta el
// proveedor a partir del hostname y valida que la URL sea http(s) real y no
// apunte de vuelta a la propia plataforma (evita loops/self-referencia).

export type ExternalLinkProvider = "drive" | "dropbox" | "onedrive" | "wetransfer" | "other";

// Dominio propio de la plataforma (ver src/resources/once-ui.config.ts).
// Cualquier URL que resuelva a este host se rechaza en validateExternalUrl.
const PLATFORM_HOSTNAMES = new Set(["hub-nerds.com", "www.hub-nerds.com"]);

function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Mapea el hostname de una URL externa al proveedor de nube que representa.
export function detectProvider(url: string): ExternalLinkProvider {
  const hostname = getHostname(url);
  if (!hostname) return "other";

  if (hostname.endsWith("drive.google.com") || hostname.endsWith("docs.google.com")) return "drive";
  if (hostname.endsWith("dropbox.com")) return "dropbox";
  if (
    hostname.endsWith("onedrive.live.com") ||
    hostname === "1drv.ms" ||
    hostname.endsWith("sharepoint.com")
  ) {
    return "onedrive";
  }
  if (hostname.endsWith("wetransfer.com") || hostname === "we.tl") return "wetransfer";

  return "other";
}

// Devuelve la URL normalizada (trim) si es http(s) válida y no apunta a la
// propia plataforma; null si la URL es inválida o es una auto-referencia.
export function validateExternalUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (PLATFORM_HOSTNAMES.has(parsed.hostname.toLowerCase())) return null;

  return parsed.toString();
}

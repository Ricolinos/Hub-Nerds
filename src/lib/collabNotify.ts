import { Resend } from "resend";

/* ══ Notificación de colaboración client ↔ freelancer: correo best-effort ══
   ══ (solicitudes de contacto, respuestas, proyectos conjuntos). Nunca ══
   ══ debe tumbar el flujo principal si Resend falla — solo se loggea. ══ */

const REMITENTE = "Colaboración Ricolinos <onboarding@resend.dev>";

export interface CollabNotificationInput {
  to: string;
  recipientName?: string | null;
  subject: string;
  heading: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Las rutas del CTA se pasan relativas (ej. "/username"); se resuelven contra
// el dominio de producción salvo que se configure NEXT_PUBLIC_APP_URL.
function absoluteUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hub-nerds.com";
  return `${base.replace(/\/$/, "")}${url.startsWith("/") ? url : `/${url}`}`;
}

function plantilla({ recipientName, heading, body, ctaUrl, ctaLabel }: CollabNotificationInput): string {
  const saludo = recipientName ? `Hola ${esc(recipientName)},` : "Hola,";
  const boton =
    ctaUrl && ctaLabel
      ? `<p style="margin:24px 0 0;">
          <a href="${esc(absoluteUrl(ctaUrl))}" style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">${esc(ctaLabel)}</a>
        </p>`
      : "";

  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
    <h2 style="margin:0 0 4px;font-size:20px;">${esc(heading)}</h2>
    <p style="margin:0 0 16px;color:#666;font-size:14px;">${saludo}</p>
    <p style="margin:0 0 8px;font-size:14px;color:#333;white-space:pre-wrap;">${esc(body)}</p>
    ${boton}
    <p style="margin:24px 0 0;color:#999;font-size:12px;">Enviado desde hub-nerds.com</p>
  </div>`;
}

// Best-effort: nunca lanza, solo loggea si Resend no está configurado o falla.
export async function sendCollabNotification(input: CollabNotificationInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error("sendCollabNotification: RESEND_API_KEY no configurado, se omite el envío.");
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: input.to,
      subject: input.subject,
      html: plantilla(input),
    });
    if (error) console.error("sendCollabNotification: error de Resend", error);
  } catch (error) {
    console.error("sendCollabNotification: excepción al enviar", error);
  }
}

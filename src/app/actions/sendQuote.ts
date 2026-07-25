"use server";

import { Resend } from "resend";

/* ══ Solicitud de cotización formal: envía los datos del lead por correo ═════ */

const DESTINATARIO = process.env.QUOTE_TO_EMAIL ?? "ricardo@ricolinos.com";
const REMITENTE = "Cotizador Ricolinos <onboarding@resend.dev>";

export interface QuoteLead {
  nombre: string;
  whatsapp: string;
  correo: string;
  marca: string; // nombre de la marca o proyecto (opcional)
  descripcion: string; // detalle libre del proyecto (opcional)
  proyecto: string; // ej. "Motion / Animación · Logo animado"
  complejidad: string; // ej. "Medio — Conceptualización, varias propuestas y rondas de ajustes"
  alcance: string; // ej. "Empresa nacional · Difusión estatal"
  estimacion: string; // ej. "$5,000 – $10,000 MXN"
  desglose: { label: string; valor: string }[];
}

export interface QuoteResult {
  ok: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_REGEX = /^[+\d][\d\s\-()]{6,19}$/;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function plantilla(lead: QuoteLead): string {
  const filas = lead.desglose
    .map(
      ({ label, valor }) => `
        <tr>
          <td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">${esc(label)}</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #eee;">${esc(valor)}</td>
        </tr>`,
    )
    .join("");

  return `
  <div style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
    <h2 style="margin:0 0 4px;font-size:20px;">Nueva solicitud de cotización</h2>
    <p style="margin:0 0 24px;color:#666;font-size:14px;">Enviada desde el cotizador de hub-nerds.com</p>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#999;">Datos del lead</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#666;">Nombre</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(lead.nombre)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">WhatsApp</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(lead.whatsapp)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Correo</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(lead.correo)}</td></tr>
    </table>

    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#999;">Proyecto</h3>
    ${lead.marca ? `<p style="margin:0 0 4px;font-size:16px;font-weight:700;">${esc(lead.marca)}</p>` : ""}
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;">${esc(lead.proyecto)}</p>
    <p style="margin:0 0 16px;font-size:22px;font-weight:700;">${esc(lead.estimacion)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Complejidad</td><td style="padding:6px 0 6px 16px;text-align:right;font-weight:600;">${esc(lead.complejidad)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Alcance</td><td style="padding:6px 0 6px 16px;text-align:right;font-weight:600;">${esc(lead.alcance)}</td></tr>
    </table>
    ${
      lead.descripcion
        ? `<h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#999;">Descripción del proyecto</h3>
    <p style="margin:0 0 24px;font-size:14px;color:#333;white-space:pre-wrap;">${esc(lead.descripcion)}</p>`
        : ""
    }
    <h3 style="margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#999;">Desglose</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${filas}</table>

    <p style="margin:24px 0 0;color:#999;font-size:12px;">Estimación orientativa · IVA no incluido · El costo final se pacta directamente con el client.</p>
  </div>`;
}

export async function sendQuote(lead: QuoteLead): Promise<QuoteResult> {
  const nombre = lead.nombre?.trim() ?? "";
  const whatsapp = lead.whatsapp?.trim() ?? "";
  const correo = lead.correo?.trim() ?? "";
  const marca = lead.marca?.trim() ?? "";
  const descripcion = lead.descripcion?.trim() ?? "";

  if (!nombre || !EMAIL_REGEX.test(correo) || !TEL_REGEX.test(whatsapp)) {
    return { ok: false, error: "Datos de contacto incompletos o inválidos." };
  }
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "El servicio de correo no está configurado." };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: REMITENTE,
      to: DESTINATARIO,
      replyTo: correo,
      subject: `Cotización solicitada: ${marca || lead.proyecto} — ${nombre}`,
      html: plantilla({ ...lead, nombre, whatsapp, correo, marca, descripcion }),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudo enviar la solicitud. Intenta de nuevo." };
  }
}

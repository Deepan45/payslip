import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { buildPayslipPublicUrl } from "../utils/signedLink";

export function isEmailConfigured(): boolean {
  return Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.pass && env.smtp.from);
}

export function isWhatsappConfigured(): boolean {
  return Boolean(env.twilio.accountSid && env.twilio.authToken && env.twilio.whatsappFrom);
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

export interface SendResult {
  ok: boolean;
  reason?: string;
}

export async function sendPayslipEmail(
  to: string,
  employeeName: string,
  periodLabel: string,
  pdfPath: string
): Promise<SendResult> {
  if (!isEmailConfigured()) return { ok: false, reason: "Email delivery is not configured (SMTP_* env vars missing)" };
  try {
    await getTransporter().sendMail({
      from: env.smtp.from,
      to,
      subject: `Payslip for ${periodLabel}`,
      text: `Hi ${employeeName},\n\nYour payslip for ${periodLabel} is attached.\n\nThis is an automated message.`,
      attachments: [{ filename: `Payslip-${periodLabel}.pdf`, path: pdfPath }],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Failed to send email" };
  }
}

export async function sendPayslipWhatsApp(
  toPhone: string,
  employeeName: string,
  periodLabel: string,
  payslipId: string
): Promise<SendResult> {
  if (!isWhatsappConfigured()) {
    return { ok: false, reason: "WhatsApp delivery is not configured (TWILIO_* env vars missing)" };
  }
  const link = buildPayslipPublicUrl(payslipId);
  const body = `Hi ${employeeName}, your payslip for ${periodLabel} is ready. Download it here: ${link}`;

  try {
    const auth = Buffer.from(`${env.twilio.accountSid}:${env.twilio.authToken}`).toString("base64");
    const params = new URLSearchParams({
      To: `whatsapp:${toPhone}`,
      From: env.twilio.whatsappFrom!,
      Body: body,
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.twilio.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, reason: `Twilio error (${res.status}): ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Failed to send WhatsApp message" };
  }
}

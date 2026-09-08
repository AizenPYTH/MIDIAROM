import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";

/** Resend transactional e-mail provider (REST API, no SDK needed). */
export class ResendEmailProvider implements EmailProvider {
  readonly code = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend error ${response.status}: ${body}`);
    }
    const data = (await response.json()) as { id?: string };
    return { providerMessageId: data.id ?? null };
  }
}

import type { EmailMessage, EmailProvider, EmailSendResult } from "@/lib/email/types";

/** DEVELOPMENT ONLY: prints e-mails to the server console. */
export class ConsoleEmailProvider implements EmailProvider {
  readonly code = "console";
  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info(`\n[email:console] → ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`);
    return { providerMessageId: `console_${Date.now()}` };
  }
}

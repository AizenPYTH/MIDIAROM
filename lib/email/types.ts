export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  providerMessageId: string | null;
}

export interface EmailProvider {
  readonly code: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

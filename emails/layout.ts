/**
 * Minimal, table-free HTML e-mail layout that renders well in every client.
 * Templates return { subject, html, text }. No brand name is hard-coded.
 */
export interface EmailBrand {
  name: string;
  siteUrl: string;
  email: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escape(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#334155">${escape(text)}</p>`;
}

export function button(label: string, href: string): string {
  return `<p style="margin:22px 0"><a href="${escape(href)}" style="display:inline-block;background:#1d5fd1;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;font-size:15px">${escape(label)}</a></p>`;
}

export function keyValueTable(rows: [string, string][]): string {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;font-size:14px;vertical-align:top">${escape(k)}</td><td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:500">${escape(v)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" style="border-collapse:collapse;margin:8px 0 16px">${body}</table>`;
}

export function renderEmail(brand: EmailBrand, subject: string, bodyHtml: string, bodyText: string): RenderedEmail {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f6f7f9;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="font-weight:700;font-size:18px;color:#0b2545;margin-bottom:16px">${escape(brand.name)}</div>
  <div style="background:#ffffff;border:1px solid #dfe3ea;border-radius:12px;padding:24px">
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${escape(subject)}</h1>
    ${bodyHtml}
  </div>
  <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">
    Cet e-mail vous est envoyé par ${escape(brand.name)} à propos d'un dossier de réparation.
    ${brand.email ? `Une question ? Écrivez à <a href="mailto:${escape(brand.email)}" style="color:#64748b">${escape(brand.email)}</a>.` : ""}
  </p>
</div></body></html>`;
  const text = `${subject}\n\n${bodyText}\n\n— ${brand.name}\n${brand.siteUrl}`;
  return { subject, html, text };
}

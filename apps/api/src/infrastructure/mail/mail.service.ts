import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface AbsenceEmailInput {
  to: string[];
  studentName: string;
  courseName: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface EmailSendResult {
  sentTo: string[];
  detail: string;
}

export type AbsenceEmailResult = EmailSendResult;

export interface PaymentEmailInput {
  to: string[];
  studentName: string;
  invoiceNumber: string;
  billingPeriod: string;
  amount: string;
  paidAt: string;
}

export interface InvoicePdfEmailInput {
  to: string;
  studentName: string;
  invoiceNumber: string;
  date: string;
  amount: string;
  paid: boolean;
  pdf: Buffer;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendAbsenceNotice(input: AbsenceEmailInput): Promise<AbsenceEmailResult> {
    const recipients = [...new Set(input.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0) {
      return { sentTo: [], detail: 'No email address on the student or a guardian.' };
    }

    return this.deliver(
      recipients,
      `${input.studentName} mungoi në ${input.courseName}`,
      [
        'Përshëndetje,',
        '',
        `${input.studentName} mungoi në mësimin ${input.courseName} (${input.groupName}) më ${input.sessionDate}, ora ${input.startTime}–${input.endTime}.`,
        `Arsyeja: ${input.reason}`,
        '',
        'Unity Tech Hub',
      ].join('\n'),
      `Absence email failed for ${input.studentName}`,
      'The absence was saved, but the email could not be sent.',
    );
  }

  async sendPaymentReceipt(input: PaymentEmailInput): Promise<EmailSendResult> {
    const recipients = [...new Set(input.to.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    if (recipients.length === 0) {
      return { sentTo: [], detail: 'No email address on the student or a guardian.' };
    }

    return this.deliver(
      recipients,
      `Pagesa u krye — ${input.studentName}`,
      [
        'Përshëndetje,',
        '',
        `Pagesa për ${input.studentName} është përfunduar.`,
        `Fatura: ${input.invoiceNumber}`,
        `Periudha: ${input.billingPeriod}`,
        `Shuma: EUR ${input.amount}`,
        `Data: ${input.paidAt}`,
        '',
        'Unity Tech Hub',
      ].join('\n'),
      `Payment email failed for ${input.studentName}`,
      'The payment was saved, but the email could not be sent.',
    );
  }

  async sendInvoicePdf(input: InvoicePdfEmailInput): Promise<EmailSendResult> {
    const recipient = input.to.trim().toLowerCase();
    if (!recipient) {
      return { sentTo: [], detail: 'Enter an email address.' };
    }

    const subject = input.paid
      ? `Pagesa u krye — ${input.studentName}`
      : `Faturë për pagesë — ${input.studentName}`;
    const lines = input.paid
      ? [
          'Përshëndetje,',
          '',
          `${input.studentName} ka paguar kursin.`,
          'Bashkëngjitur është vërtetimi i pagesës.',
          '',
          `Nr.: ${input.invoiceNumber}`,
          `Data e pagesës: ${input.date}`,
          `Shuma e paguar: ${input.amount} €`,
          '',
          'Faleminderit që zgjodhët Unity Tech Hub.',
        ]
      : [
          'Përshëndetje,',
          '',
          `Ju dërgojmë faturën për pagesën e kursit për ${input.studentName}.`,
          'Ju lutemi ta kryeni pagesën. Fatura është bashkëngjitur në këtë email.',
          '',
          `Nr.: ${input.invoiceNumber}`,
          `Data: ${input.date}`,
          `Shuma për pagesë: ${input.amount} €`,
          '',
          'Unity Tech Hub',
        ];

    return this.deliver(
      [recipient],
      subject,
      lines.join('\n'),
      `Invoice email failed for ${input.invoiceNumber}`,
      'The invoice was saved, but the email could not be sent.',
      [
        {
          filename: `${input.invoiceNumber}.pdf`,
          content: input.pdf,
          contentType: 'application/pdf',
        },
      ],
    );
  }

  private async deliver(
    recipients: string[],
    subject: string,
    text: string,
    logLabel: string,
    failureDetail: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType: string }>,
  ): Promise<EmailSendResult> {
    const host = process.env.SMTP_HOST?.trim();
    const from = process.env.MAIL_FROM?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !from || !user || !pass) {
      return {
        sentTo: [],
        detail: 'Email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM.',
      };
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({ from, to: recipients, subject, text, attachments });
      return { sentTo: recipients, detail: `Sent to ${recipients.join(', ')}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : failureDetail;
      this.logger.warn(`${logLabel}: ${message}`);
      return { sentTo: [], detail: failureDetail };
    }
  }
}

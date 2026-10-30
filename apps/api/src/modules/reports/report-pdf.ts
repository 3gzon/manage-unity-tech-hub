import { existsSync } from 'fs';
import { join } from 'path';
import type { FinancialReportResponse } from '@unity/types';
import PDFDocument from 'pdfkit';

export function renderFinancialReportPdf(report: FinancialReportResponse, schoolName: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = 545;
    const width = right - left;
    const logo = reportAsset('invoice-logo.png');

    if (logo) doc.image(logo, left, 40, { width: 190 });

    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(16).text('RAPORT FINANCIAR', 280, 46, {
      width: 265,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(`Periudha: ${report.fromDate} — ${report.toDate}`, 280, 72, { width: 265, align: 'right' });

    let y = 112;
    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(12).text('Metrikat kryesore', left, y);
    y += 22;

    const metrics: Array<[string, string]> = [
      ['Të ardhurat', `EUR ${report.metrics.revenue}`],
      ['Të ardhurat e pritura', `EUR ${report.metrics.expectedRevenue}`],
      ['Bilanci i papaguar', `EUR ${report.metrics.outstandingBalance}`],
      ['Faturat e paguara', String(report.metrics.paidInvoices)],
      ['Faturat e papaguara', String(report.metrics.unpaidInvoices)],
      ['Shpenzimet', `EUR ${report.metrics.expenses}`],
      ['Kompensimi i instruktorëve', `EUR ${report.metrics.instructorCompensation}`],
      ['Rezultati neto', `EUR ${report.metrics.netResult}`],
    ];

    const colWidth = width / 2;
    for (let i = 0; i < metrics.length; i += 2) {
      const [labelA, valueA] = metrics[i]!;
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(labelA, left, y, { width: colWidth - 10 });
      doc.font('Helvetica-Bold').fillColor('#020D23').text(valueA, left, y + 14, { width: colWidth - 10 });

      if (metrics[i + 1]) {
        const [labelB, valueB] = metrics[i + 1]!;
        doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(labelB, left + colWidth, y, { width: colWidth - 10 });
        doc.font('Helvetica-Bold').fillColor('#020D23').text(valueB, left + colWidth, y + 14, { width: colWidth - 10 });
      }
      y += 36;
    }

    y += 8;
    doc.strokeColor('#cbd5e1').moveTo(left, y).lineTo(right, y).stroke();
    y += 16;

    if (report.tables.topOutstandingBalances.length > 0) {
      doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(11).text('Bilancet e papaguara më të larta', left, y);
      y += 18;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b');
      doc.text('Studenti', left, y, { width: 220 });
      doc.text('Fatura', 280, y, { width: 60, align: 'right' });
      doc.text('Mbetur', 360, y, { width: 185, align: 'right' });
      y += 14;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 8;

      doc.font('Helvetica').fontSize(10).fillColor('#020D23');
      for (const row of report.tables.topOutstandingBalances) {
        doc.text(row.studentName, left, y, { width: 220 });
        doc.text(String(row.invoiceCount), 280, y, { width: 60, align: 'right' });
        doc.text(`EUR ${row.remainingAmount}`, 360, y, { width: 185, align: 'right' });
        y += 16;
      }
      y += 12;
    }

    if (y > 620) {
      doc.addPage();
      y = 50;
    }

    if (report.tables.latestPayments.length > 0) {
      doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(11).text('Pagesat e fundit', left, y);
      y += 18;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b');
      doc.text('Data', left, y, { width: 80 });
      doc.text('Studenti', 140, y, { width: 200 });
      doc.text('Shuma', 360, y, { width: 185, align: 'right' });
      y += 14;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 8;

      doc.font('Helvetica').fontSize(10).fillColor('#020D23');
      for (const row of report.tables.latestPayments) {
        doc.text(row.date, left, y, { width: 80 });
        doc.text(`${row.studentName} · ${row.method}`, 140, y, { width: 200 });
        doc.text(`EUR ${row.amount}`, 360, y, { width: 185, align: 'right' });
        y += 16;
      }
      y += 12;
    }

    if (y > 620) {
      doc.addPage();
      y = 50;
    }

    if (report.tables.overdueInvoices.length > 0) {
      doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(11).text('Faturat e vonuara', left, y);
      y += 18;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b');
      doc.text('Fatura', left, y, { width: 200 });
      doc.text('Afati', 260, y, { width: 90, align: 'right' });
      doc.text('Mbetur', 360, y, { width: 185, align: 'right' });
      y += 14;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 8;

      doc.font('Helvetica').fontSize(10).fillColor('#020D23');
      for (const row of report.tables.overdueInvoices) {
        doc.text(`${row.invoiceNumber} · ${row.studentName}`, left, y, { width: 200 });
        doc.text(row.dueDate, 260, y, { width: 90, align: 'right' });
        doc.text(`EUR ${row.remainingAmount}`, 360, y, { width: 185, align: 'right' });
        y += 16;
      }
    }

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(schoolName, left, 760, {
      width,
      align: 'center',
    });

    doc.end();
  });
}

function reportAsset(fileName: string) {
  const candidates = [
    join(process.cwd(), 'assets', fileName),
    join(process.cwd(), 'apps/api/assets', fileName),
    join(__dirname, '..', '..', '..', 'assets', fileName),
    join(__dirname, '..', '..', 'assets', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

import { existsSync } from 'fs';
import { join } from 'path';
import type { InstructorMonthlyReport } from './instructor-report.service';
import PDFDocument from 'pdfkit';

export function renderInstructorReportPdf(report: InstructorMonthlyReport, schoolName: string): Promise<Buffer> {
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

    if (logo) doc.image(logo, left, 40, { width: 160 });

    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(15).text('RAPORT MUJOR I INSTRUKTORIT', 230, 46, {
      width: 315,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(report.instructorName, 230, 68, { width: 315, align: 'right' });
    doc.text(`Periudha: ${report.period}`, 230, 82, { width: 315, align: 'right' });

    let y = 110;

    // Summary metrics
    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(12).text('Përmbledhje', left, y);
    y += 20;

    const summaryItems: Array<[string, string]> = [
      ['Grupet aktive', String(report.summary.totalGroups)],
      ['Studentët', String(report.summary.totalStudents)],
      ['Sesionet e mbajtura', String(report.summary.totalSessions)],
      ['Orët totale', report.summary.totalHours],
      ['Vlerësimet e dhëna', String(report.feedbackCount)],
      ['Kompensimi total', `EUR ${report.summary.totalCompensation}`],
    ];

    const colW = width / 3;
    for (let i = 0; i < summaryItems.length; i += 3) {
      for (let j = 0; j < 3 && i + j < summaryItems.length; j++) {
        const [label, value] = summaryItems[i + j]!;
        const x = left + j * colW;
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(label, x, y, { width: colW - 10 });
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#020D23').text(value, x, y + 12, { width: colW - 10 });
      }
      y += 34;
    }

    y += 6;
    doc.strokeColor('#cbd5e1').moveTo(left, y).lineTo(right, y).stroke();
    y += 14;

    // Groups table
    if (report.groups.length > 0) {
      doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(11).text('Grupet', left, y);
      y += 16;

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b');
      doc.text('Grupi / Kursi', left, y, { width: 170 });
      doc.text('Studentë', 225, y, { width: 50, align: 'right' });
      doc.text('Sesione', 280, y, { width: 50, align: 'right' });
      doc.text('Orë', 335, y, { width: 40, align: 'right' });
      doc.text('Prezent', 380, y, { width: 45, align: 'right' });
      doc.text('Mungesë', 430, y, { width: 50, align: 'right' });
      doc.text('Vonesa', 485, y, { width: 60, align: 'right' });
      y += 12;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 6;

      doc.font('Helvetica').fontSize(9).fillColor('#020D23');
      for (const group of report.groups) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.text(`${group.groupName}`, left, y, { width: 170 });
        doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(group.courseName, left, y + 11, { width: 170 });
        doc.font('Helvetica').fontSize(9).fillColor('#020D23');
        doc.text(String(group.activeStudents), 225, y, { width: 50, align: 'right' });
        doc.text(String(group.sessionCount), 280, y, { width: 50, align: 'right' });
        doc.text(group.totalHours, 335, y, { width: 40, align: 'right' });
        doc.text(String(group.presentCount), 380, y, { width: 45, align: 'right' });
        doc.text(String(group.absentCount), 430, y, { width: 50, align: 'right' });
        doc.text(String(group.lateCount), 485, y, { width: 60, align: 'right' });
        y += 24;
      }
      y += 8;
    }

    if (y > 620) { doc.addPage(); y = 50; }

    // Compensation table
    if (report.compensation.items.length > 0) {
      doc.strokeColor('#cbd5e1').moveTo(left, y).lineTo(right, y).stroke();
      y += 14;
      doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(11).text('Kompensimi', left, y);
      y += 16;

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#64748b');
      doc.text('Grupi / Kursi', left, y, { width: 180 });
      doc.text('Orë', 235, y, { width: 45, align: 'right' });
      doc.text('Studentë', 285, y, { width: 55, align: 'right' });
      doc.text('Shuma', 350, y, { width: 80, align: 'right' });
      doc.text('Statusi', 440, y, { width: 105, align: 'right' });
      y += 12;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 6;

      doc.font('Helvetica').fontSize(9).fillColor('#020D23');
      for (const item of report.compensation.items) {
        if (y > 700) { doc.addPage(); y = 50; }
        doc.text(`${item.groupName}`, left, y, { width: 180 });
        doc.font('Helvetica').fontSize(8).fillColor('#64748b').text(item.courseName, left, y + 11, { width: 180 });
        doc.font('Helvetica').fontSize(9).fillColor('#020D23');
        doc.text(item.hoursTaught, 235, y, { width: 45, align: 'right' });
        doc.text(String(item.studentCount), 285, y, { width: 55, align: 'right' });
        doc.text(`EUR ${item.amount}`, 350, y, { width: 80, align: 'right' });
        doc.text(item.status, 440, y, { width: 105, align: 'right' });
        y += 24;
      }

      y += 4;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#020D23');
      doc.text('Totali:', left, y, { width: 330 });
      doc.text(`EUR ${report.compensation.total}`, 350, y, { width: 80, align: 'right' });
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

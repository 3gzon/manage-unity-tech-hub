import { existsSync } from 'fs';
import { join } from 'path';
import type { FeedbackRating } from '@unity/types';
import PDFDocument from 'pdfkit';

export interface FeedbackPdfInput {
  schoolName: string;
  date: string;
  instructorName: string;
  studentName: string;
  courseName: string;
  groupName: string;
  period: string;
  overall: FeedbackRating;
  participation: FeedbackRating;
  understanding: FeedbackRating;
  practice: FeedbackRating;
  attendance: FeedbackRating;
  strengths: string;
  improvements: string;
  nextSteps: string;
}

const RATING_LABELS: Record<FeedbackRating, string> = {
  EXCELLENT: 'Shkëlqyeshëm',
  GOOD: 'Mirë',
  SATISFACTORY: 'Mjaftueshëm',
  NEEDS_SUPPORT: 'Ka nevojë për mbështetje',
};

export function renderFeedbackPdf(input: FeedbackPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = 50;
    const right = 545;
    const width = right - left;
    const logo = feedbackAsset('invoice-logo.png');

    if (logo) doc.image(logo, left, 40, { width: 190 });

    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(16).text('VLERËSIM', 280, 46, {
      width: 265,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text(`Data: ${input.date}`, 280, 72, { width: 265, align: 'right' });
    doc.text(`Instruktori: ${input.instructorName}`, 280, 88, { width: 265, align: 'right' });

    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(18).text(input.studentName, left, 132, { width });
    doc.font('Helvetica').fontSize(11).fillColor('#334155').text(
      `${input.courseName}  ·  ${input.groupName}`,
      left,
      158,
      { width },
    );
    doc.text(`Periudha: ${input.period}`, left, 176, { width });

    doc.roundedRect(left, 206, width, 52, 6).fill('#e7f1ff');
    doc.fillColor('#046bd2').font('Helvetica').fontSize(9).text('REZULTATI I PËRGJITHSHËM', left + 14, 216, {
      width: width - 28,
    });
    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(14).text(RATING_LABELS[input.overall], left + 14, 232, {
      width: width - 28,
    });

    let y = 278;
    doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(12).text('Vlerësimi sipas fushave', left, y);
    y += 20;

    const areas: Array<[string, FeedbackRating]> = [
      ['Pjesëmarrja në klasë', input.participation],
      ['Kuptimi i lëndës', input.understanding],
      ['Ushtrimet dhe praktika', input.practice],
      ['Vijueshmëria dhe përpikëria', input.attendance],
    ];

    for (const [label, rating] of areas) {
      doc.font('Helvetica').fontSize(11).fillColor('#020D23').text(label, left, y, { width: 280 });
      doc.font('Helvetica-Bold').text(RATING_LABELS[rating], 340, y, { width: 205, align: 'right' });
      y += 18;
      doc.strokeColor('#e2e8f0').moveTo(left, y).lineTo(right, y).stroke();
      y += 12;
    }

    y += 8;
    y = writeBlock(doc, left, y, width, 'Pikat e forta', input.strengths);
    y = writeBlock(doc, left, y, width, 'Çfarë duhet të përmirësohet', input.improvements);
    y = writeBlock(doc, left, y, width, 'Hapat e ardhshëm', input.nextSteps);

    y += 16;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.strokeColor('#cbd5e1').moveTo(left, y).lineTo(left + 220, y).stroke();
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(input.instructorName, left, y + 6, { width: 220 });
    doc.fontSize(9).fillColor('#64748b').text('Instruktori', left, y + 22, { width: 220 });

    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text(input.schoolName, left, doc.y + 28, {
      width,
      align: 'center',
    });

    doc.end();
  });
}

function writeBlock(
  doc: InstanceType<typeof PDFDocument>,
  left: number,
  y: number,
  width: number,
  title: string,
  body: string,
) {
  if (y > 680) {
    doc.addPage();
    y = 50;
  }
  doc.fillColor('#020D23').font('Helvetica-Bold').fontSize(12).text(title, left, y, { width });
  y = doc.y + 6;
  doc.font('Helvetica').fontSize(11).fillColor('#334155').text(body, left, y, { width });
  return doc.y + 16;
}

function feedbackAsset(fileName: string) {
  const candidates = [
    join(process.cwd(), 'assets', fileName),
    join(process.cwd(), 'apps/api/assets', fileName),
    join(__dirname, '..', '..', '..', 'assets', fileName),
    join(__dirname, '..', '..', 'assets', fileName),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

import type { Question } from '../../../shared/types.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Export questions as a formatted PDF document.
 */
export async function exportToPDF(
  examName: string,
  setName: string,
  questions: Question[],
  includeAnswers: boolean = false
): Promise<Buffer> {
  // Build document definition
  const content: any[] = [
    { text: examName, style: 'header', alignment: 'center' },
    { text: setName, style: 'subheader', alignment: 'center' },
    { text: `Total Questions: ${questions.length}`, style: 'info', alignment: 'center', margin: [0, 5, 0, 20] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#444444' }] },
    { text: '', margin: [0, 10] },
  ];

  // Add questions
  for (const q of questions) {
    content.push(
      { text: `Q${q.questionNumber}. ${q.questionText}`, style: 'question', margin: [0, 10, 0, 5] },
      {
        type: 'none',
        ul: [
          { text: `(A) ${q.optionA}`, style: 'option' },
          { text: `(B) ${q.optionB}`, style: 'option' },
          { text: `(C) ${q.optionC}`, style: 'option' },
          { text: `(D) ${q.optionD}`, style: 'option' },
        ],
        margin: [15, 0, 0, 5],
      }
    );
  }

  // Add answer key if requested
  if (includeAnswers) {
    content.push(
      { text: '', pageBreak: 'before' },
      { text: 'ANSWER KEY', style: 'header', alignment: 'center', margin: [0, 0, 0, 20] },
    );

    const tableBody = [
      [
        { text: 'Q.No', style: 'tableHeader' },
        { text: 'Answer', style: 'tableHeader' },
        { text: 'Topic', style: 'tableHeader' },
        { text: 'Difficulty', style: 'tableHeader' },
      ],
    ];

    for (const q of questions) {
      tableBody.push([
        { text: String(q.questionNumber), style: 'tableCell' } as any,
        { text: q.correctAnswer, style: 'tableCell' } as any,
        { text: q.topic, style: 'tableCell' } as any,
        { text: q.difficulty, style: 'tableCell' } as any,
      ]);
    }

    content.push({
      table: {
        headerRows: 1,
        widths: [40, 50, '*', 80],
        body: tableBody,
      },
      layout: 'lightHorizontalLines',
    });
  }

  const docDefinition = {
    content,
    styles: {
      header: { fontSize: 18, bold: true, color: '#1a1a2e' },
      subheader: { fontSize: 14, bold: true, color: '#16213e', margin: [0, 5, 0, 0] as any },
      info: { fontSize: 11, color: '#666666' },
      question: { fontSize: 11, bold: true, color: '#1a1a2e' },
      option: { fontSize: 10, color: '#333333', margin: [0, 2] as any },
      tableHeader: { bold: true, fontSize: 10, color: '#ffffff', fillColor: '#1a1a2e' },
      tableCell: { fontSize: 9, color: '#333333' },
    },
    defaultStyle: { font: 'Roboto' },
    pageSize: 'A4' as const,
    pageMargins: [40, 60, 40, 60] as [number, number, number, number],
  };

  // Generate PDF buffer
  return new Promise((resolve, reject) => {
    try {
      const pdfmake = require('pdfmake/build/pdfmake');
      const vfsFonts = require('pdfmake/build/vfs_fonts');
      pdfmake.vfs = vfsFonts.pdfMake?.vfs || vfsFonts.vfs;

      const pdfDoc = pdfmake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Export questions as a DOCX document.
 */
export async function exportToDOCX(
  examName: string,
  setName: string,
  questions: Question[],
  includeAnswers: boolean = false
): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle,
  } = await import('docx');

  const children: any[] = [
    new Paragraph({
      text: examName,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: setName,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Total Questions: ${questions.length}`, italics: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  // Add questions
  for (const q of questions) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Q${q.questionNumber}. ${q.questionText}`, bold: true, size: 22 })],
        spacing: { before: 300, after: 100 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `   (A) ${q.optionA}`, size: 20 })],
        spacing: { after: 50 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `   (B) ${q.optionB}`, size: 20 })],
        spacing: { after: 50 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `   (C) ${q.optionC}`, size: 20 })],
        spacing: { after: 50 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `   (D) ${q.optionD}`, size: 20 })],
        spacing: { after: 100 },
      }),
    );
  }

  // Add answer key page
  if (includeAnswers) {
    children.push(
      new Paragraph({
        text: 'ANSWER KEY',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
      }),
    );

    const headerRow = new TableRow({
      children: ['Q.No', 'Answer', 'Topic', 'Difficulty'].map(text =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })] })],
          width: { size: 25, type: WidthType.PERCENTAGE },
        })
      ),
      tableHeader: true,
    });

    const dataRows = questions.map(q =>
      new TableRow({
        children: [
          String(q.questionNumber),
          q.correctAnswer,
          q.topic,
          q.difficulty,
        ].map(text =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, size: 18 })] })],
            width: { size: 25, type: WidthType.PERCENTAGE },
          })
        ),
      })
    );

    children.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  const doc = new Document({
    sections: [{ children }],
    creator: 'KKE Question Paper Generator',
    title: `${examName} - ${setName}`,
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

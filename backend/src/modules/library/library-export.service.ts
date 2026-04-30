import path from 'node:path';

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

const sanitizeFileName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

const markdownToPlainText = (value: string): string => {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^>\s?/gm, '')
    .replace(/^#+\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

type ExportDocumentInput = {
  title: string;
  contentMarkdown?: string | null;
  contentText?: string | null;
  metadata: {
    tipo: string;
    origem: string;
    status: string;
    atualizadoEm: string;
  };
};

export class LibraryExportService {
  async exportMarkdown(input: ExportDocumentInput): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const markdown = [
      `# ${input.title}`,
      '',
      `- Tipo: ${input.metadata.tipo}`,
      `- Origem: ${input.metadata.origem}`,
      `- Status: ${input.metadata.status}`,
      `- Atualizado em: ${input.metadata.atualizadoEm}`,
      '',
      input.contentMarkdown?.trim() || input.contentText?.trim() || 'Sem conteúdo.'
    ].join('\n');

    return {
      buffer: Buffer.from(markdown, 'utf-8'),
      fileName: `${sanitizeFileName(input.title) || 'documento'}.md`,
      mimeType: 'text/markdown; charset=utf-8'
    };
  }

  async exportDocx(input: ExportDocumentInput): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const baseText = input.contentMarkdown?.trim() || input.contentText?.trim() || 'Sem conteúdo.';
    const plainText = markdownToPlainText(baseText);
    const lines = plainText.split(/\n+/).map((line) => line.trim()).filter(Boolean);

    const paragraphs: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: input.title, bold: true })]
      }),
      new Paragraph({ children: [new TextRun({ text: `Tipo: ${input.metadata.tipo}` })] }),
      new Paragraph({ children: [new TextRun({ text: `Origem: ${input.metadata.origem}` })] }),
      new Paragraph({ children: [new TextRun({ text: `Status: ${input.metadata.status}` })] }),
      new Paragraph({ children: [new TextRun({ text: `Atualizado em: ${input.metadata.atualizadoEm}` })] }),
      new Paragraph({ text: '' })
    ];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: line.replace(/^##\s+/, ''), bold: true })]
          })
        );
        continue;
      }

      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: line.replace(/^#\s+/, ''), bold: true })]
          })
        );
        continue;
      }

      paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs
        }
      ]
    });

    const buffer = await Packer.toBuffer(doc);

    return {
      buffer,
      fileName: `${sanitizeFileName(input.title) || 'documento'}.docx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }

  extensionToContentDisposition(fileName: string): string {
    return `attachment; filename="${path.basename(fileName)}"`;
  }
}

export const libraryExportService = new LibraryExportService();

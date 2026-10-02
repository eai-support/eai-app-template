import JSZip from 'jszip';

/** Blanks typed into the resume fixture, in document order. */
export const RESUME_TEMPLATE_BLANKS = [
  'fullName',
  'email',
  'professionalSummary',
  'workHistory',
  'skills',
] as const;

const WORDPROCESSING_NS =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragraph(text: string, style?: string): string {
  const properties = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  return `<w:p>${properties}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

/** Builds a minimal but valid Word resume template with one `{blank}` per field. */
export async function buildResumeTemplateDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  const body = [
    paragraph('Resume', 'Heading1'),
    paragraph('{fullName}'),
    paragraph('Email: {email}'),
    paragraph('Professional summary', 'Heading2'),
    paragraph('{professionalSummary}'),
    paragraph('Work history', 'Heading2'),
    paragraph('{workHistory}'),
    paragraph('Skills', 'Heading2'),
    paragraph('{skills}'),
  ].join('');
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:document xmlns:w="${WORDPROCESSING_NS}"><w:body>${body}<w:sectPr/></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

/** Reads the rendered text of a filled .docx, one line per paragraph. */
export async function readDocxText(document: ArrayBuffer | Buffer): Promise<{
  xml: string;
  text: string;
}> {
  const zip = await JSZip.loadAsync(document);
  const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  const text = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [])
    .map((paragraphXml) =>
      (paragraphXml.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:br\/>/g) ?? [])
        .map((run) =>
          run === '<w:br/>'
            ? '\n'
            : run
                .replace(/<[^>]+>/g, '')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&'),
        )
        .join(''),
    )
    .join('\n');
  return { xml, text };
}

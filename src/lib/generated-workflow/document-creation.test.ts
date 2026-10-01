import {
  boundedDocumentAnswers,
  documentCreationAnswers,
  findDocumentCreationField,
  isDocumentCreationField,
  plainTextToRichTextHtml,
  richTextHtmlToPlainText,
} from './document-creation';

const documentField = {
  id: 'resumeDocument',
  label: 'Your resume',
  type: 'smart_block',
  blockType: 'document-creation',
  templateId: 'resume-template',
};

describe('document creation field contract', () => {
  it.each([
    ['the exported shape', documentField, true],
    ['a non smart_block field', { ...documentField, type: 'text' }, false],
    ['another block type', { ...documentField, blockType: 'ai-chat' }, false],
    ['a blank template id', { ...documentField, templateId: '  ' }, false],
    [
      'a missing template id',
      { ...documentField, templateId: undefined },
      false,
    ],
    [
      'an oversized template id',
      { ...documentField, templateId: 'x'.repeat(201) },
      false,
    ],
    ['no field', undefined, false],
  ])('classifies %s', (_label, field, expected) => {
    expect(isDocumentCreationField(field)).toBe(expected);
  });

  it('finds only the snapshot field bound to the exact template id', () => {
    const snapshot = {
      steps: [
        { id: 'about', fields: [{ id: 'fullName', type: 'text' }] },
        { id: 'document', fields: [documentField] },
      ],
    };
    expect(findDocumentCreationField(snapshot, 'resume-template')).toBe(
      documentField,
    );
    expect(
      findDocumentCreationField(snapshot, 'RESUME-TEMPLATE'),
    ).toBeUndefined();
    expect(findDocumentCreationField(snapshot, '')).toBeUndefined();
    expect(findDocumentCreationField(snapshot, 42)).toBeUndefined();
  });
});

describe('document answers', () => {
  it('keys typed answers by field id and leaves out files, block outputs and blanks', () => {
    expect(
      documentCreationAnswers({
        about: {
          id: 'record-1',
          fullName: 'Alex Respondent',
          yearsExperience: 7,
          openToRelocate: false,
          nickname: '  ',
          photo: { fileId: 'file-1', fileName: 'me.png' },
          __blocks: { 'approval-1.decision': 'approved' },
        },
        skills: { skills: 'TypeScript' },
      }),
    ).toEqual({
      fullName: 'Alex Respondent',
      yearsExperience: '7',
      openToRelocate: 'false',
      skills: 'TypeScript',
    });
  });

  it('bounds untrusted answers to 64 non-empty strings of 4000 characters', () => {
    const many = Object.fromEntries(
      Array.from({ length: 70 }, (_, index) => [`answer${index}`, 'value']),
    );
    expect(Object.keys(boundedDocumentAnswers(many))).toHaveLength(64);
    expect(
      boundedDocumentAnswers({
        id: 'record-1',
        long: 'x'.repeat(4500),
        number: 7,
        blank: ' ',
        nested: { value: 'x' },
      }),
    ).toEqual({ long: 'x'.repeat(4000) });
    expect(boundedDocumentAnswers(['a'])).toEqual({});
    expect(boundedDocumentAnswers(null)).toEqual({});
  });
});

describe('rich-text display conversion', () => {
  it('shows AI HTML as plain-text paragraphs', () => {
    expect(
      richTextHtmlToPlainText(
        '<h2>Summary</h2><p class="lead">Payments engineer &amp; mentor.<br/>Sydney</p>' +
          '<ul><li>TypeScript</li><li>Python &lt;3.12&gt;</li></ul><p>&quot;Ships&quot;&nbsp;fast &#8212; &#x2713;</p>',
      ),
    ).toBe(
      'Summary\n\nPayments engineer & mentor.\nSydney\n\n• TypeScript\n• Python <3.12>\n\n"Ships" fast — ✓',
    );
  });

  it('leaves text that is not HTML untouched', () => {
    expect(richTextHtmlToPlainText('5 < 6 & 7 > 3\nnext line')).toBe(
      '5 < 6 & 7 > 3\nnext line',
    );
  });

  it('turns textarea paragraphs into escaped paragraph HTML for the fill', () => {
    expect(
      plainTextToRichTextHtml(
        '  Payments engineer & mentor.\r\nSydney <AU>\n\n\n"Ships" fast  ',
      ),
    ).toBe(
      '<p>Payments engineer &amp; mentor.<br>Sydney &lt;AU&gt;</p><p>&quot;Ships&quot; fast</p>',
    );
    expect(plainTextToRichTextHtml('   ')).toBe('');
  });

  it('round-trips AI paragraphs through the textarea', () => {
    const html = '<p>First &amp; best.</p><p>Second<br>line.</p>';
    expect(plainTextToRichTextHtml(richTextHtmlToPlainText(html))).toBe(html);
  });
});

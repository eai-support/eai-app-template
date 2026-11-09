import {
  submissionFileAccept,
  submissionFileAcceptedExtensions,
  type SubmissionFileRef,
  validateSubmissionFile,
  validateSubmissionFileCollection,
} from './submission-files';

function fileRef(
  fieldId: string,
  fileSize = 1024,
  stepId = 'documents',
): SubmissionFileRef {
  return {
    submissionFileId: `file-${fieldId}`,
    fileName: `${fieldId}.pdf`,
    fileSize,
    contentType: 'application/pdf',
    uploadedAt: '2026-09-21T00:00:00Z',
    stepId,
    fieldId,
  };
}

describe('submission file policy', () => {
  it('uses the configured suffixes for both the browser hint and validation', () => {
    expect(submissionFileAcceptedExtensions(['pdf', 'txt'])).toEqual([
      'pdf',
      'txt',
    ]);
    expect(submissionFileAccept(['pdf', 'txt'])).toBe('.pdf,.txt');
    expect(
      validateSubmissionFile(
        { name: 'evidence.csv', size: 10, type: 'text/csv' },
        ['pdf', 'txt'],
      ),
    ).toBe('Unsupported file type.');
  });

  it('fails closed for invalid configured suffixes and extensionless names', () => {
    expect(submissionFileAcceptedExtensions(['pdf', 'exe'])).toEqual([]);
    expect(submissionFileAcceptedExtensions([])).toEqual([]);
    expect(submissionFileAccept([])).toBe('');
    expect(
      validateSubmissionFile(
        { name: 'evidence.pdf', size: 10, type: 'application/pdf' },
        [],
      ),
    ).toBe('Unsupported file type.');
    expect(
      validateSubmissionFile(
        { name: 'pdf', size: 10, type: 'application/pdf' },
        ['pdf'],
      ),
    ).toBe('Unsupported file type.');
  });

  it('enforces five files and 25MB while allowing a field replacement', () => {
    const fiveFiles = ['a', 'b', 'c', 'd', 'e'].map((id) => fileRef(id));
    expect(
      validateSubmissionFileCollection(fiveFiles, {
        stepId: 'documents',
        fieldId: 'f',
        fileSize: 1,
      }),
    ).toBe('A submission can contain up to 5 files.');
    expect(
      validateSubmissionFileCollection(fiveFiles, {
        stepId: 'documents',
        fieldId: 'e',
        fileSize: 2,
      }),
    ).toBeNull();

    const nearLimit = [
      fileRef('a', 10 * 1024 * 1024),
      fileRef('b', 10 * 1024 * 1024),
    ];
    expect(
      validateSubmissionFileCollection(nearLimit, {
        stepId: 'documents',
        fieldId: 'c',
        fileSize: 5 * 1024 * 1024 + 1,
      }),
    ).toBe('Submission files can total up to 25MB.');
  });
});

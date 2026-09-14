import { DocumentsModule } from '../src/modules/documents';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DocumentsModule', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('HP001 uploads documents through the Curate v4 document lifecycle', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.upload(new File(['hello'], 'test.pdf'), {
      source: 'smoke',
      verticalKey: 'document-app',
      workflowKey: 'intake',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    const body = mockFetch.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('files')).toBeInstanceOf(File);
    expect(body.get('tenant_id')).toBe('tenant-a');
    expect(body.get('storage_target')).toBe('resourceapi');
    expect(body.get('processing_mode')).toBe('full');
    expect(body.get('verticalKey')).toBe('document-app');
    expect(body.get('workflowKey')).toBe('intake');
    expect(body.get('source')).toBe('smoke');
  });

  it('HP001b classifies documents through upload with Curate and workflow metadata', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.classify([new File(['hello'], 'test.pdf')], {
      verticalKey: 'document-app',
      workflowKey: 'intake',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
    const body = mockFetch.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('files')).toBeInstanceOf(File);
    expect(body.get('tenant_id')).toBe('tenant-a');
    expect(body.get('storage_target')).toBe('resourceapi');
    expect(body.get('processing_mode')).toBe('classification');
    expect(body.get('verticalKey')).toBe('document-app');
    expect(body.get('workflowKey')).toBe('intake');
  });

  it.each([
    undefined,
    { verticalKey: 'document-app' },
    { workflowKey: 'intake' },
    { verticalKey: ' ', workflowKey: 'intake' },
  ])('HP001c rejects an incomplete document workflow before upload: %j', async (options) => {
    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await expect(documents.classify([new File(['hello'], 'test.pdf')], options))
      .rejects.toThrow('both verticalKey and workflowKey');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('HP002 requests checklists through the v4 data documents endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.getChecklist({
      tenant_id: 'tenant-a',
      development_type: 'residential',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/checklist',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'tenant-a',
          development_type: 'residential',
        }),
      },
    );
  });

  it('HP003 sends the v4 RAG indexing payload with the SDK tenant fallback', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.ragIndex({
      documentId: 'DOC-123',
      storagePath: 'tenant-a/uploads/document.pdf',
      businessRequestId: 'br-123',
      enrichmentLevel: 'full',
      storageTarget: 'resourceapi',
      resourceObjectType: 'PlanningDocument',
      resourceId: 'resource-123',
      resourceFileProperty: 'file',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/rag-index',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: 'DOC-123',
          storagePath: 'tenant-a/uploads/document.pdf',
          businessRequestId: 'br-123',
          enrichmentLevel: 'full',
          storageTarget: 'resourceapi',
          resourceObjectType: 'PlanningDocument',
          resourceId: 'resource-123',
          resourceFileProperty: 'file',
          tenantId: 'tenant-a',
        }),
      },
    );
  });

  it('HP004 reads document job status through the v4 data documents endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.getJobStatus('job/123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/jobs/job%2F123',
      undefined,
    );
  });

  it('HP005 sends the deployed classify-by-url document and tenant fields', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.classifyByUrl('https://example.com/document.pdf');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/classify-by-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: 'https://example.com/document.pdf',
          tenantId: 'tenant-a',
        }),
      },
    );
  });

  it('HP006 selects a tenant workflow classifier without accepting tenant overrides', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    const options = {
      verticalKey: ' business-docs ',
      workflowKey: ' classify ',
      tenantId: 'tenant-b',
    };
    await documents.classifyByUrl('https://example.com/document.pdf', options);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      documentUrl: 'https://example.com/document.pdf',
      tenantId: 'tenant-a',
      verticalKey: 'business-docs',
      workflowKey: 'classify',
    });
  });

  it.each([
    { verticalKey: 'business-docs' },
    { workflowKey: 'classify' },
    { verticalKey: ' ', workflowKey: 'classify' },
    { verticalKey: 'business-docs', workflowKey: ' ' },
  ])('HP007 rejects an incomplete classifier selection before sending: %j', async (options) => {
    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await expect(documents.classifyByUrl('https://example.com/document.pdf', options))
      .rejects.toThrow('both verticalKey and workflowKey');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

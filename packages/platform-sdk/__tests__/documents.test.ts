import { DocumentsModule } from '../src/modules/documents';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DocumentsModule', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('HP001 uploads documents through the v4 data documents endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const documents = new DocumentsModule('/api/eai', 'tenant-a');
    await documents.upload(new File(['hello'], 'test.txt'));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
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
});

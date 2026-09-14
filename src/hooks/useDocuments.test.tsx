import { renderHook } from '@testing-library/react';

import { useDocuments } from './useDocuments';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useDocuments', () => {
  const originalTenantId = process.env.NEXT_PUBLIC_EAI_TENANT_ID;

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    if (originalTenantId === undefined) {
      delete process.env.NEXT_PUBLIC_EAI_TENANT_ID;
    } else {
      process.env.NEXT_PUBLIC_EAI_TENANT_ID = originalTenantId;
    }
  });

  it('uses NEXT_PUBLIC_EAI_TENANT_ID for RAG indexing when no tenant override is passed', async () => {
    process.env.NEXT_PUBLIC_EAI_TENANT_ID = 'env-tenant';

    const { result } = renderHook(() => useDocuments());
    await result.current.ragIndex({
      documentId: 'DOC-123',
      storagePath: 'env-tenant/uploads/document.pdf',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/rag-index',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: 'DOC-123',
          storagePath: 'env-tenant/uploads/document.pdf',
          tenantId: 'env-tenant',
        }),
      },
    );
  });

  it('prefers an explicit tenant override over NEXT_PUBLIC_EAI_TENANT_ID', async () => {
    process.env.NEXT_PUBLIC_EAI_TENANT_ID = 'env-tenant';

    const { result } = renderHook(() => useDocuments('explicit-tenant'));
    await result.current.ragIndex({
      documentId: 'DOC-123',
      storagePath: 'explicit-tenant/uploads/document.pdf',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/rag-index',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: 'DOC-123',
          storagePath: 'explicit-tenant/uploads/document.pdf',
          tenantId: 'explicit-tenant',
        }),
      },
    );
  });

  it('forwards workflow context when uploading through the Curate lifecycle', async () => {
    process.env.NEXT_PUBLIC_EAI_TENANT_ID = 'env-tenant';

    const { result } = renderHook(() => useDocuments());
    await result.current.upload(new File(['document'], 'trust-deed.pdf'), {
      verticalKey: 'business-documents',
      workflowKey: 'classify',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    const body = mockFetch.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('tenant_id')).toBe('env-tenant');
    expect(body.get('storage_target')).toBe('resourceapi');
    expect(body.get('verticalKey')).toBe('business-documents');
    expect(body.get('workflowKey')).toBe('classify');
  });

  it('forwards workflow context to tenant-bound URL classification', async () => {
    process.env.NEXT_PUBLIC_EAI_TENANT_ID = 'env-tenant';

    const { result } = renderHook(() => useDocuments());
    await result.current.classifyByUrl('https://example.com/trust-deed.pdf', {
      verticalKey: 'business-documents',
      workflowKey: 'classify',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/eai/v4/data/documents/classify-by-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: 'https://example.com/trust-deed.pdf',
          tenantId: 'env-tenant',
          verticalKey: 'business-documents',
          workflowKey: 'classify',
        }),
      },
    );
  });
});

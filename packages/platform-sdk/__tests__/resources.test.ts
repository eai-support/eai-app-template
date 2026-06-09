import { ResourcesModule } from '../src/modules/resources';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ResourcesModule', () => {
  const baseUrl = '/api/eai';
  const tenantId = 'test-tenant';
  let resources: ResourcesModule;

  beforeEach(() => {
    resources = new ResourcesModule(baseUrl, tenantId);
    mockFetch.mockReset();
  });

  function mockOkResponse(data: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    });
  }

  describe('create', () => {
    it('sends POST to correct URL with data wrapper', async () => {
      const resourceData = { applicantName: 'Jane', status: 'draft' };
      mockOkResponse({ id: '123', data: resourceData });

      await resources.create('Application', resourceData);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: resourceData }),
        },
      );
    });
  });

  describe('get', () => {
    it('sends GET to correct URL with ID', async () => {
      mockOkResponse({ id: '123', data: {} });

      await resources.get('Application', '123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123',
        undefined,
      );
    });
  });

  describe('list', () => {
    it('includes cursor when provided', async () => {
      mockOkResponse({ docs: [], totalDocs: 0, page: 1, totalPages: 1, nextCursor: null });

      await resources.list('Application', { limit: 5, cursor: 'cursor-1' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application?limit=5&cursor=cursor-1',
        undefined,
      );
    });
  });

  describe('update', () => {
    it('sends PUT with data AND version (required for optimistic locking)', async () => {
      const data = { status: 'submitted' };
      mockOkResponse({ id: '123', data, version: 2 });

      await resources.update('Application', '123', data, 1);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, version: 1 }),
        },
      );
    });

    it('retries conflicts using the latest resource version', async () => {
      const data = { status: 'submitted' };
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          statusText: 'Conflict',
          json: () => Promise.resolve({ message: 'Version conflict' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: '123', data: { status: 'draft' }, version: 2 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: '123', data, version: 3 }),
        });

      const updated = await resources.update('Application', '123', data, 1, {
        maxRetries: 2,
        baseDelayMs: 0,
      });

      expect(updated.version).toBe(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        '/api/eai/v3/resources/test-tenant/application/123',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, version: 1 }),
        },
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/eai/v3/resources/test-tenant/application/123',
        undefined,
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        '/api/eai/v3/resources/test-tenant/application/123',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, version: 2 }),
        },
      );
    });
  });

  describe('delete', () => {
    it('sends DELETE to correct URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await resources.delete('Application', '123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123',
        { method: 'DELETE' },
      );
    });
  });

  describe('executeAction', () => {
    it('sends POST to action endpoint with params wrapper', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await resources.executeAction('Application', '123', 'submit', { note: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/actions/submit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: { note: 'test' } }),
        },
      );
    });

    it('sends empty params when none provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await resources.executeAction('Application', '123', 'submit');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/actions/submit',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        },
      );
    });
  });

  describe('getLinks', () => {
    it('sends GET to links endpoint', async () => {
      mockOkResponse([]);

      await resources.getLinks('Application', '123', 'documents');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/links/documents',
        undefined,
      );
    });
  });

  describe('createLink', () => {
    it('sends POST with target_id and target_type', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });

      await resources.createLink('Application', '123', 'documents', '456', 'Document');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/links/documents',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: '456', target_type: 'Document' }),
        },
      );
    });
  });

  describe('deleteLink', () => {
    it('sends DELETE to link target endpoint', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await resources.deleteLink('Application', '123', 'documents', '456');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/links/documents/456',
        { method: 'DELETE' },
      );
    });
  });

  describe('query', () => {
    it('sends POST to query endpoint with object_types and where', async () => {
      mockOkResponse({ results: [], totalResults: 0 });

      await resources.query({
        object_types: ['Application'],
        where: { Application: { status: { equals: 'draft' } } },
        limit: 50,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/query',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            object_types: ['Application'],
            where: { Application: { status: { equals: 'draft' } } },
            limit: 50,
          }),
        },
      );
    });
  });

  describe('batchCreate', () => {
    it('sends batch create payload to the batch endpoint', async () => {
      mockOkResponse({ succeeded: 1, failed: 0, results: [{ index: 0, id: '123', success: true, version: 1 }] });

      await resources.batchCreate('Application', [{ data: { applicantName: 'Jane' } }]);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/batch/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ data: { applicantName: 'Jane' } }] }),
        },
      );
    });
  });

  describe('batchUpdate', () => {
    it('sends batch update payload to the batch endpoint', async () => {
      mockOkResponse({ succeeded: 1, failed: 0, results: [{ index: 0, id: '123', success: true, version: 2 }] });

      await resources.batchUpdate('Application', [{ id: '123', data: { status: 'submitted' }, version: 1 }]);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/batch/update',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ id: '123', data: { status: 'submitted' }, version: 1 }] }),
        },
      );
    });
  });

  describe('batchDelete', () => {
    it('sends batch delete ids to the batch endpoint', async () => {
      mockOkResponse({ succeeded: 1, failed: 0, results: [{ index: 0, id: '123', success: true }] });

      await resources.batchDelete('Application', ['123']);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/batch/delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ['123'] }),
        },
      );
    });
  });

  describe('aggregate', () => {
    it('sends aggregate requests to the aggregate endpoint', async () => {
      mockOkResponse({ rows: [{ status: 'draft', count: 3 }], totalRows: 1 });

      await resources.aggregate('Application', {
        groupBy: ['status'],
        metrics: { count: { function: 'count' } },
        limit: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/aggregate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBy: ['status'],
            metrics: { count: { function: 'count' } },
            limit: 10,
          }),
        },
      );
    });
  });

  describe('getSchema', () => {
    it('sends GET to schema endpoint', async () => {
      mockOkResponse({});

      await resources.getSchema();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/schema/test-tenant',
        undefined,
      );
    });
  });

  describe('getHistory', () => {
    it('sends GET to history endpoint', async () => {
      mockOkResponse([]);

      await resources.getHistory('Application', '123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/application/123/history',
        undefined,
      );
    });
  });

  describe('error handling', () => {
    it('throws PlatformError on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Resource not found', code: 'NOT_FOUND' }),
      });

      await expect(resources.get('Application', 'missing')).rejects.toThrow();
    });
  });

  describe('object type slug conversion', () => {
    it('converts PascalCase object types to kebab-case in the URL', async () => {
      mockOkResponse({ id: '1', data: {}, version: 1 });

      await resources.get('TrendDigest', '1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/trend-digest/1',
        undefined,
      );
    });

    it('handles consecutive capitals in object type names', async () => {
      mockOkResponse({ id: '1', data: {}, version: 1 });

      await resources.get('APIKey', '1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/resources/test-tenant/api-key/1',
        undefined,
      );
    });
  });
});

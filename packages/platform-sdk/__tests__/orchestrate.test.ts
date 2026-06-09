import { OrchestrateModule } from '../src/modules/orchestrate';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OrchestrateModule', () => {
  const baseUrl = '/api/eai';
  let orchestrate: OrchestrateModule;

  beforeEach(() => {
    orchestrate = new OrchestrateModule(baseUrl);
    mockFetch.mockReset();
  });

  describe('send', () => {
    it('sends POST to /v3/orchestrate', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await orchestrate.send({
        target_backend: 'payload',
        endpoint: '/object-types',
        method: 'GET',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/eai/v3/orchestrate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_backend: 'payload',
            endpoint: '/object-types',
            method: 'GET',
          }),
        },
      );
    });

    it('includes body for payload backend', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const objectType = { name: 'Application', properties: [] };
      await orchestrate.send({
        target_backend: 'payload',
        endpoint: '/object-types',
        method: 'POST',
        body: objectType,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.target_backend).toBe('payload');
      expect(body.endpoint).toBe('/object-types');
      expect(body.method).toBe('POST');
      expect(body.body).toEqual(objectType);
    });

    it('does NOT prefix endpoint with /api for payload backend', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await orchestrate.send({
        target_backend: 'payload',
        endpoint: '/object-types',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Endpoint should be /object-types, NOT /api/object-types
      expect(body.endpoint).toBe('/object-types');
      expect(body.endpoint).not.toStartWith('/api');
    });

    it('supports multipart field for file uploads', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await orchestrate.send({
        target_backend: 'payload',
        endpoint: '/documents',
        method: 'POST',
        multipart: {
          filename: 'test.pdf',
          content_base64: 'dGVzdA==',
          content_type: 'application/pdf',
        },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.multipart).toEqual({
        filename: 'test.pdf',
        content_base64: 'dGVzdA==',
        content_type: 'application/pdf',
      });
    });

    it('supports all target_backend values', async () => {
      for (const backend of ['payload', 'mid', 'resources'] as const) {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

        await orchestrate.send({
          target_backend: backend,
          endpoint: '/test',
        });

        const body = JSON.parse(mockFetch.mock.calls[mockFetch.mock.calls.length - 1][1].body);
        expect(body.target_backend).toBe(backend);
      }
    });

    it('throws on non-2xx response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ message: 'Orchestration failed' }),
      });

      await expect(
        orchestrate.send({ target_backend: 'payload', endpoint: '/test' }),
      ).rejects.toThrow();
    });
  });
});

// Custom matcher
expect.extend({
  toStartWith(received: string, expected: string) {
    const pass = received.startsWith(expected);
    return {
      pass,
      message: () => `expected "${received}" to start with "${expected}"`,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toStartWith(expected: string): R;
    }
  }
}

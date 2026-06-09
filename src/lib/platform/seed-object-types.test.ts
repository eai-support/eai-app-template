import { seedObjectTypes } from '@/lib/platform/seed-object-types';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const originalEnv = process.env;

describe('seedObjectTypes', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_BASE_PATH: '/my-template/',
    };
    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('?')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ docs: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'created' }),
      });
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('HP001 seeds object types through basePath-aware PublicAPI v4 URLs', async () => {
    const results = await seedObjectTypes('template', 'tenant-a');

    expect(results.every((result) => result.status === 'created')).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/my-template\/api\/eai\/v4\/data\/resources\/object-types\?/,
      ),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      '/my-template/api/eai/v4/data/resources/object-types',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('BP001 reports an unknown tenant key without calling PublicAPI', async () => {
    const results = await seedObjectTypes('unknown', 'tenant-a');

    expect(results).toEqual([
      {
        name: 'unknown',
        status: 'failed',
        message: 'No object types found for key "unknown"',
      },
    ]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

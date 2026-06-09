import {
  buildPublicApiUrl,
  normalizePublicApiBaseUrl,
} from '@/lib/platform/publicapi-url';

describe('publicApi URL helper', () => {
  it('HP001 strips legacy version suffixes before appending v4 paths', () => {
    expect(normalizePublicApiBaseUrl('/my-template/api/eai/v3')).toBe(
      '/my-template/api/eai',
    );
    expect(normalizePublicApiBaseUrl('/my-template/api/eai/v4/')).toBe(
      '/my-template/api/eai',
    );
  });

  it('HP002 preserves relative app base paths when building URLs', () => {
    expect(
      buildPublicApiUrl(
        '/my-template/api/eai/v3',
        '/v4/data/resources/object-types',
        {
          limit: 1,
        },
      ),
    ).toBe('/my-template/api/eai/v4/data/resources/object-types?limit=1');
  });

  it('HP003 preserves absolute PublicAPI origins when building URLs', () => {
    expect(
      buildPublicApiUrl('https://api.example.com/public/', 'v4/identity/me'),
    ).toBe('https://api.example.com/public/v4/identity/me');
  });
});

import { isOpaqueDemoNavigation } from './frame-boundary';

function headers(site?: string, mode?: string, dest?: string): Headers {
  const value = new Headers();
  if (site) value.set('sec-fetch-site', site);
  if (mode) value.set('sec-fetch-mode', mode);
  if (dest) value.set('sec-fetch-dest', dest);
  return value;
}

describe('opaque demo API boundary', () => {
  it('recognizes iframe and direct-tab navigations from opaque origins', () => {
    expect(
      isOpaqueDemoNavigation(headers('cross-site', 'navigate', 'iframe')),
    ).toBe(true);
    expect(
      isOpaqueDemoNavigation(headers('cross-site', 'navigate', 'document')),
    ).toBe(true);
  });

  it('leaves ordinary app fetches and non-browser service calls outside the guard', () => {
    expect(
      isOpaqueDemoNavigation(headers('same-origin', 'cors', 'empty')),
    ).toBe(false);
    expect(
      isOpaqueDemoNavigation(headers('same-origin', 'navigate', 'document')),
    ).toBe(false);
    expect(isOpaqueDemoNavigation(headers())).toBe(false);
    expect(isOpaqueDemoNavigation(headers('cross-site', 'cors', 'empty'))).toBe(
      false,
    );
  });
});

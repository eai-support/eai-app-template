/** Recognize opaque-origin navigation metadata; the caller binds it to v2 app API paths. */
export function isOpaqueDemoNavigation(headers: Pick<Headers, 'get'>): boolean {
  return (
    headers.get('sec-fetch-site') === 'cross-site' &&
    headers.get('sec-fetch-mode') === 'navigate' &&
    ['iframe', 'document'].includes(headers.get('sec-fetch-dest') ?? '')
  );
}

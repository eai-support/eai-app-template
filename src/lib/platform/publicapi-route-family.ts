export type PublicApiRouteFamily =
  | 'identity'
  | 'platform'
  | 'workflows'
  | 'ai'
  | 'data-resources'
  | 'data-documents'
  | 'geo'
  | 'realtime'
  | 'integrations'
  | 'vertical-daisy';

const ROUTE_FAMILY_FLAGS: Record<PublicApiRouteFamily, string> = {
  identity: 'PUBLICAPI_V4_IDENTITY_ENABLED',
  platform: 'PUBLICAPI_V4_PLATFORM_ENABLED',
  workflows: 'PUBLICAPI_V4_WORKFLOWS_ENABLED',
  ai: 'PUBLICAPI_V4_AI_ENABLED',
  'data-resources': 'PUBLICAPI_V4_DATA_RESOURCES_ENABLED',
  'data-documents': 'PUBLICAPI_V4_DATA_DOCUMENTS_ENABLED',
  geo: 'PUBLICAPI_V4_GEO_ENABLED',
  realtime: 'PUBLICAPI_V4_REALTIME_ENABLED',
  integrations: 'PUBLICAPI_V4_INTEGRATIONS_ENABLED',
  'vertical-daisy': 'PUBLICAPI_V4_DAISY_ENABLED',
};

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function withQuery(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}

function splitPathAndQuery(path: string): { routePath: string; query: string } {
  const [routePath, query = ''] = stripLeadingSlash(path).split('?', 2);
  return { routePath, query };
}

function isFlagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (value ?? '').trim().toLowerCase(),
  );
}

export function isPublicApiV4RouteFamilyEnabled(
  family: PublicApiRouteFamily,
): boolean {
  return isFlagEnabled(process.env[ROUTE_FAMILY_FLAGS[family]]);
}

export function publicApiRouteFamilyForPath(
  path: string,
): PublicApiRouteFamily | null {
  const { routePath } = splitPathAndQuery(path);

  if (
    routePath === 'v3/auth/me' ||
    routePath === 'v3/session/resolve' ||
    routePath === 'v3/users/me/tenants' ||
    routePath === 'v3/users/provisionme' ||
    routePath === 'v3/users/me/profile' ||
    /^v3\/users\/me\/tenants\/[^/]+$/.test(routePath)
  ) {
    return 'identity';
  }
  if (
    routePath === 'v3/capabilities/evaluate' ||
    routePath === 'v3/support/contact' ||
    /^v3\/tenants\/[^/]+\/usage$/.test(routePath)
  ) {
    return 'platform';
  }
  if (
    routePath.startsWith('v3/workflows/') ||
    routePath.startsWith('v3/business-requests/')
  ) {
    return 'workflows';
  }
  if (
    routePath.startsWith('v3/chat/') ||
    routePath.startsWith('v3/chat-history') ||
    routePath.startsWith('v3/context/')
  ) {
    return 'ai';
  }
  if (routePath.startsWith('v3/resources/')) return 'data-resources';
  if (
    routePath.startsWith('v3/documents/') ||
    routePath.startsWith('v3/document-templates')
  ) {
    return 'data-documents';
  }
  if (
    routePath === 'v3/geo' ||
    routePath.startsWith('v3/geo/') ||
    /^v3\/tenants\/[^/]+\/geo\//.test(routePath)
  ) {
    return 'geo';
  }
  if (routePath === 'v3/alerts' || routePath.startsWith('v3/websocket/')) {
    return 'realtime';
  }
  if (routePath.startsWith('v3/nsw/') || routePath.startsWith('v3/builder/')) {
    return 'integrations';
  }
  if (routePath.startsWith('v3/daisy/')) return 'vertical-daisy';

  return null;
}

export function resolvePublicApiRoutePath(path: string): string {
  const { routePath, query } = splitPathAndQuery(path);
  const family = publicApiRouteFamilyForPath(routePath);
  if (!family || !isPublicApiV4RouteFamilyEnabled(family)) {
    return withQuery(routePath, query);
  }

  if (family === 'identity') {
    if (routePath === 'v3/auth/me') return withQuery('v4/identity/me', query);
    if (routePath === 'v3/session/resolve') {
      return withQuery('v4/identity/session/resolve', query);
    }
    if (routePath === 'v3/users/me/tenants') {
      return withQuery('v4/identity/tenants', query);
    }
    if (routePath === 'v3/users/provisionme') {
      return withQuery('v4/identity/me/provision', query);
    }
    if (routePath === 'v3/users/me/profile') {
      return withQuery('v4/identity/me/profile', query);
    }
    if (/^v3\/users\/me\/tenants\/[^/]+$/.test(routePath)) {
      return withQuery(
        routePath.replace(
          /^v3\/users\/me\/tenants\/([^/]+)$/,
          'v4/identity/tenants/$1/membership',
        ),
        query,
      );
    }
  }

  if (family === 'platform') {
    return withQuery(routePath.replace(/^v3\//, 'v4/platform/'), query);
  }
  if (family === 'workflows') {
    if (routePath.startsWith('v3/business-requests/')) {
      return withQuery(
        routePath.replace(
          /^v3\/business-requests/,
          'v4/workflows/business-requests',
        ),
        query,
      );
    }
    return withQuery(
      routePath.replace(/^v3\/workflows/, 'v4/workflows'),
      query,
    );
  }
  if (family === 'ai') {
    return withQuery(routePath.replace(/^v3\//, 'v4/ai/'), query);
  }
  if (family === 'data-resources') {
    return withQuery(
      routePath.replace(/^v3\/resources/, 'v4/data/resources'),
      query,
    );
  }
  if (family === 'data-documents') {
    return withQuery(
      routePath
        .replace(/^v3\/documents/, 'v4/data/documents')
        .replace(/^v3\/document-templates/, 'v4/data/documents/templates'),
      query,
    );
  }
  if (family === 'geo') {
    if (routePath === 'v3/geo') return withQuery('v4/geo', query);
    if (routePath.startsWith('v3/geo/')) {
      return withQuery(routePath.replace(/^v3\/geo/, 'v4/geo'), query);
    }
    return withQuery(
      routePath.replace(/^v3\/tenants\/([^/]+)\/geo\//, 'v4/geo/tenants/$1/'),
      query,
    );
  }
  if (family === 'realtime') {
    if (routePath === 'v3/alerts') {
      return withQuery('v4/realtime/alerts', query);
    }
    return withQuery(routePath.replace(/^v3\/websocket/, 'v4/realtime'), query);
  }
  if (family === 'integrations') {
    return withQuery(
      routePath
        .replace(/^v3\/nsw/, 'v4/integrations/nsw')
        .replace(/^v3\/builder/, 'v4/integrations/builder'),
      query,
    );
  }
  if (family === 'vertical-daisy') {
    return withQuery(
      routePath.replace(/^v3\/daisy/, 'v4/verticals/daisy'),
      query,
    );
  }

  return withQuery(routePath, query);
}

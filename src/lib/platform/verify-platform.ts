import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';

export interface PlatformStatus {
  configurator: boolean;
  resourceApi: boolean;
  crud: boolean;
  aggregate: boolean;
  cursor: boolean;
}

/**
 * Verifies platform connectivity by checking:
 * 1. Configurator responds (object types exist)
 * 2. ResourceAPI responds (schema query)
 * 3. CRUD works for at least one object type
 *
 * @param tenantId - Configurator tenant ID (from TENANT_*_ID env var)
 */
export async function verifyPlatform(tenantId: string): Promise<PlatformStatus> {
  const client = new EAIPlatformClient({ tenantId });
  const status: PlatformStatus = {
    configurator: false,
    resourceApi: false,
    crud: false,
    aggregate: false,
    cursor: false,
  };

  // Check 1: Configurator responds (object types exist)
  try {
    const response = await client.orchestrate.send({
      target_backend: 'payload',
      endpoint: '/object-types',
      method: 'GET',
      params: { limit: 1 },
    });
    status.configurator = response.ok;
  } catch {
    status.configurator = false;
  }

  // Check 2: ResourceAPI responds (schema query)
  try {
    const schema = await client.resources.getSchema();
    status.resourceApi = Array.isArray((schema as { objectTypes?: unknown[] }).objectTypes)
      || Array.isArray((schema as { object_types?: unknown[] }).object_types);
  } catch {
    status.resourceApi = false;
  }

  // Check 3: list/aggregate/cursor work for at least one published type
  try {
    const schema = await client.resources.getSchema() as {
      objectTypes?: Array<{ name?: string; slug?: string }>;
      object_types?: Array<{ name?: string; slug?: string }>;
    };
    const firstType = schema.objectTypes?.[0] || schema.object_types?.[0];
    const firstSlug = firstType?.slug || firstType?.name;
    if (firstSlug) {
      const listResponse = await client.resources.list(firstSlug, { limit: 1 });
      status.crud = Array.isArray(listResponse.docs);

      const aggregateResponse = await client.resources.aggregate(firstSlug, {
        groupBy: ['id'],
        metrics: { count: { function: 'count' } },
        limit: 1,
      });
      status.aggregate = Array.isArray(aggregateResponse.rows);

      status.cursor = listResponse.nextCursor === null
        || typeof listResponse.nextCursor === 'string'
        || listResponse.nextCursor === undefined;
    }
  } catch {
    status.crud = false;
    status.aggregate = false;
    status.cursor = false;
  }

  return status;
}

import { objectTypes } from '@/eai.config/object-types';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';
import { buildPublicApiUrl } from '@/lib/platform/publicapi-url';

export interface SeedResult {
  name: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message?: string;
}

function objectTypesUrl(
  client: EAIPlatformClient,
  params?: Record<string, unknown>,
): string {
  return buildPublicApiUrl(
    client.baseUrl,
    '/v4/data/resources/object-types',
    params,
  );
}

function objectTypeRecordUrl(client: EAIPlatformClient, id: string): string {
  return buildPublicApiUrl(
    client.baseUrl,
    `/v4/data/resources/object-types/${encodeURIComponent(id)}`,
  );
}

/**
 * Seeds object types from eai.config to Configurator via PublicAPI v4.
 *
 * Idempotent: checks if each type exists before creating.
 *
 * @param tenantKey - Key in objectTypes map (e.g., 'template')
 * @param tenantId - Configurator tenant record ID (from TENANT_*_ID env var)
 */
export async function seedObjectTypes(
  tenantKey: string,
  tenantId: string,
): Promise<SeedResult[]> {
  const client = new EAIPlatformClient({ tenantId });
  const types = objectTypes[tenantKey as keyof typeof objectTypes];

  if (!types || types.length === 0) {
    return [
      {
        name: tenantKey,
        status: 'failed',
        message: `No object types found for key "${tenantKey}"`,
      },
    ];
  }

  const results: SeedResult[] = [];

  for (const type of types) {
    try {
      // Check if type already exists
      const checkResponse = await fetch(
        objectTypesUrl(client, {
          where: { name: { equals: type.name }, tenant: { equals: tenantId } },
        }),
      );

      const checkData = await checkResponse.json();
      const existing = checkData?.docs?.[0];

      if (existing) {
        // Update existing type
        const updateResponse = await fetch(
          objectTypeRecordUrl(client, existing.id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName: type.displayName,
              description: type.description,
              properties: type.properties,
              linkTypes: type.linkTypes,
              actions: type.actions,
              storageBackend: type.storageBackend,
              status: type.status,
            }),
          },
        );

        if (updateResponse.ok) {
          results.push({ name: type.name, status: 'updated' });
        } else {
          results.push({
            name: type.name,
            status: 'failed',
            message: `Update failed: ${updateResponse.status}`,
          });
        }
      } else {
        // Create new type
        const createResponse = await fetch(objectTypesUrl(client), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: type.name,
            displayName: type.displayName,
            description: type.description,
            properties: type.properties,
            linkTypes: type.linkTypes,
            actions: type.actions,
            storageBackend: type.storageBackend,
            status: type.status,
            tenant: tenantId,
          }),
        });

        if (createResponse.ok) {
          results.push({ name: type.name, status: 'created' });
        } else {
          results.push({
            name: type.name,
            status: 'failed',
            message: `Create failed: ${createResponse.status}`,
          });
        }
      }
    } catch (error) {
      results.push({
        name: type.name,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

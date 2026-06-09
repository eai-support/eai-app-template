import { objectTypes } from '@/eai.config/object-types';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';

export interface SeedResult {
  name: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  message?: string;
}

/**
 * Seeds object types from eai.config to Configurator via PublicAPI orchestrate.
 *
 * Idempotent: checks if each type exists before creating.
 * Uses orchestrate endpoint targeting Configurator's `object-types` collection.
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
    return [{ name: tenantKey, status: 'failed', message: `No object types found for key "${tenantKey}"` }];
  }

  const results: SeedResult[] = [];

  for (const type of types) {
    try {
      // Check if type already exists
      const checkResponse = await client.orchestrate.send({
        target_backend: 'payload',
        endpoint: '/object-types',
        method: 'GET',
        params: {
          where: { name: { equals: type.name }, tenant: { equals: tenantId } },
        },
      });

      const checkData = await checkResponse.json();
      const existing = checkData?.docs?.[0];

      if (existing) {
        // Update existing type
        const updateResponse = await client.orchestrate.send({
          target_backend: 'payload',
          endpoint: `/object-types/${existing.id}`,
          method: 'PATCH',
          body: {
            displayName: type.displayName,
            description: type.description,
            properties: type.properties,
            linkTypes: type.linkTypes,
            actions: type.actions,
            storageBackend: type.storageBackend,
            status: type.status,
          },
        });

        if (updateResponse.ok) {
          results.push({ name: type.name, status: 'updated' });
        } else {
          results.push({ name: type.name, status: 'failed', message: `Update failed: ${updateResponse.status}` });
        }
      } else {
        // Create new type
        const createResponse = await client.orchestrate.send({
          target_backend: 'payload',
          endpoint: '/object-types',
          method: 'POST',
          body: {
            name: type.name,
            displayName: type.displayName,
            description: type.description,
            properties: type.properties,
            linkTypes: type.linkTypes,
            actions: type.actions,
            storageBackend: type.storageBackend,
            status: type.status,
            tenant: tenantId,
          },
        });

        if (createResponse.ok) {
          results.push({ name: type.name, status: 'created' });
        } else {
          results.push({ name: type.name, status: 'failed', message: `Create failed: ${createResponse.status}` });
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

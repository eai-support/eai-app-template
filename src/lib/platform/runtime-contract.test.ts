import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { APPROVED_SCHEMA_PROVENANCE } from './schema-provenance';
import { validateSecretRefDeclarations } from '../../eai.config/deployment-contract';

describe('eai.runtime.json', () => {
  it('declares the provider-neutral runtime contract expected by the CLI', async () => {
    const contract = JSON.parse(
      await readFile(join(process.cwd(), 'eai.runtime.json'), 'utf8'),
    );

    expect(contract.schemaVersion).toBe(1);
    expect(contract.capabilities).toMatchObject({
      authjsEntraSignIn: true,
      publicApiBffAccess: true,
      tenantWorkflowConfiguration: true,
    });
    expect(contract.environment.required).toEqual(
      expect.arrayContaining([
        'BASE_URL_PUBLIC_API',
        'TENANT_KEYS',
        'ENTRA_CLIENT_ID',
        'AUTH_URL',
      ]),
    );
    expect(contract.secrets.required).toEqual(
      expect.arrayContaining(['AUTH_SECRET', 'ENTRA_CLIENT_SECRET']),
    );
    expect(contract.secrets.declarations.required).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'AUTH_SECRET',
          required: true,
          secretRef: {
            kind: 'tenant-infra-envelope',
            name: 'AUTH_SECRET',
          },
        }),
        expect.objectContaining({
          name: 'ENTRA_CLIENT_SECRET',
          required: true,
          secretRef: {
            kind: 'tenant-infra-envelope',
            name: 'ENTRA_CLIENT_SECRET',
          },
        }),
      ]),
    );
    expect(
      validateSecretRefDeclarations(
        contract.secrets.declarations,
        'secrets.declarations',
      ),
    ).toEqual({
      valid: true,
      errors: [],
    });
    expect(contract.endpoints).toMatchObject({
      health: '/health',
      authProviders: '/api/auth/providers',
      runtimeConfig: '/api/eai/config',
      bffBasePath: '/api/eai',
    });
    expect(contract.serviceIdentity.preferred).toMatchObject({
      clientId: 'EAI_SERVICE_CLIENT_ID',
      clientSecret: 'EAI_SERVICE_CLIENT_SECRET',
      targetScope: 'EAI_SERVICE_TARGET_SCOPE',
      tenantName: 'EAI_SERVICE_TENANT_NAME',
    });
    expect(contract.schemaProvenance).toEqual(APPROVED_SCHEMA_PROVENANCE);
  });
});

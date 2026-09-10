import { templateCapabilityRequirements } from '@/eai.config/capabilities';

import {
  capabilityRequestContext,
  UnknownCapabilityAliasError,
} from './capability-bindings';

describe('capabilityRequestContext', () => {
  it('returns app and logical binding context only', () => {
    expect(
      capabilityRequestContext(
        templateCapabilityRequirements,
        'primary-workflow',
      ),
    ).toEqual({
      appKey: 'eai-app-template',
      logicalAlias: 'primary-workflow',
    });
  });

  it('rejects undeclared aliases before a platform call is made', () => {
    expect(() =>
      capabilityRequestContext(templateCapabilityRequirements, 'raw-record-id'),
    ).toThrow(UnknownCapabilityAliasError);
  });
});

/**
 * Tenant Configuration Registry
 *
 * Maps tenant slugs to their configuration objects.
 * When cloning this template for a new vertical, add your tenant configs here.
 *
 * @example
 * import myTenantConfig from './my-tenant';
 *
 * export const tenantConfigs = {
 *   default: myTenantConfig,
 *   'my-tenant': myTenantConfig,
 * };
 */

import templateConfig from './default';

export const tenantConfigs: Record<string, typeof templateConfig> = {
  default: templateConfig,
  template: templateConfig,
};

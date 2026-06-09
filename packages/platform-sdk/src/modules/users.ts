/**
 * Users Module
 *
 * User provisioning and profile management via /v4/identity/*.
 */

import { platformFetch } from '../client';

export class UsersModule {
  constructor(private baseUrl: string) {}

  /**
   * Self-provision the current user to a tenant.
   * tenant_id is REQUIRED.
   */
  async provisionMe(tenantId: string): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v4/identity/me/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  }

  /** Update the current user's profile. */
  async updateProfile(data: Record<string, unknown>): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v4/identity/me/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  /** Remove the current user's membership from a tenant. */
  async deprovision(tenantId: string): Promise<Response> {
    return platformFetch(
      `${this.baseUrl}/v4/identity/tenants/${encodeURIComponent(tenantId)}/membership`,
      {
        method: 'DELETE',
      },
    );
  }
}

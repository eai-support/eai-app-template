/**
 * Users Module
 *
 * User provisioning and profile management via /v3/users/*.
 */

import { platformFetch } from '../client';

export class UsersModule {
  constructor(private baseUrl: string) {}

  /**
   * Self-provision the current user to a tenant.
   * tenant_id is REQUIRED.
   */
  async provisionMe(tenantId: string): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v3/users/provisionme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
  }

  /** Update the current user's profile. */
  async updateProfile(data: Record<string, unknown>): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v3/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  /** Deprovision the current user. */
  async deprovision(): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v3/users/deprovision`, {
      method: 'DELETE',
    });
  }
}

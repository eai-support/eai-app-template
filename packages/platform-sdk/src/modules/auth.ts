/**
 * Auth Module
 *
 * Authentication information via /v3/auth/*.
 */

import type { EntraUser } from '../types';
import { platformFetch } from '../client';

export class AuthModule {
  constructor(private baseUrl: string) {}

  /** Get the current authenticated user's information. */
  async me(): Promise<EntraUser> {
    const response = await platformFetch(`${this.baseUrl}/v3/auth/me`);
    return response.json();
  }
}

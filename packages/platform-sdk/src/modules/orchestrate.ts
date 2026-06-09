/**
 * Orchestrate Module
 *
 * Wraps POST /v3/orchestrate — the generic proxy to any platform backend.
 *
 * CRITICAL: For target_backend "payload", the orchestrator_service prepends
 * /api to the endpoint. Do NOT include /api in your endpoint string.
 * Use "/object-types" not "/api/object-types".
 */

import type { OrchestrationRequest } from '../types';
import { platformFetch } from '../client';

export class OrchestrateModule {
  constructor(private baseUrl: string) {}

  /**
   * Send an orchestration request to any platform backend.
   *
   * @example
   * // Get object types from Configurator
   * await orchestrate.send({
   *   target_backend: 'payload',
   *   endpoint: '/object-types',  // NOT /api/object-types
   *   method: 'GET',
   * });
   *
   * @example
   * // Create an object type in Configurator
   * await orchestrate.send({
   *   target_backend: 'payload',
   *   endpoint: '/object-types',
   *   method: 'POST',
   *   body: { name: 'Application', ... },
   * });
   */
  async send(request: OrchestrationRequest): Promise<Response> {
    return platformFetch(`${this.baseUrl}/v3/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }
}

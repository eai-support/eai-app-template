/**
 * Documents Module
 *
 * Document upload, classification, and indexing via /v3/documents/*.
 */

import type { ChecklistRequest } from '../types';
import { platformFetch } from '../client';

export class DocumentsModule {
  constructor(
    private baseUrl: string,
    private tenantId: string,
  ) {}

  private docsUrl(path: string): string {
    return `${this.baseUrl}/v3/documents${path}`;
  }

  /** Upload a document (multipart/form-data). */
  async upload(file: File, metadata?: Record<string, string>): Promise<Response> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        formData.append(key, value);
      }
    }

    return platformFetch(this.docsUrl('/upload'), {
      method: 'POST',
      body: formData,
    });
  }

  /** Classify a batch of files. */
  async classify(files: File[]): Promise<Response> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    return platformFetch(this.docsUrl('/classify'), {
      method: 'POST',
      body: formData,
    });
  }

  /** Classify a single document by URL. */
  async classifyByUrl(url: string): Promise<Response> {
    return platformFetch(this.docsUrl('/classify-by-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  }

  /** Index a document for RAG (retrieval-augmented generation). */
  async ragIndex(documentId: string): Promise<Response> {
    return platformFetch(this.docsUrl('/rag-index'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  /** Index a document (general indexing). */
  async index(documentId: string): Promise<Response> {
    return platformFetch(this.docsUrl('/index'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: documentId }),
    });
  }

  /**
   * Get a development checklist.
   * development_type is REQUIRED.
   */
  async getChecklist(request: ChecklistRequest): Promise<Response> {
    return platformFetch(this.docsUrl('/checklist'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }
}

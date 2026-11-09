/**
 * Documents Module
 *
 * Document upload, classification, and indexing via /v4/data/documents/*.
 */

import type { ChecklistRequest } from '../types';
import { platformFetch } from '../client';

export interface DocumentWorkflowOptions {
  verticalKey?: string;
  workflowKey?: string;
  [metadataKey: string]: string | undefined;
}

export interface ClassifyByUrlOptions {
  verticalKey?: string;
  workflowKey?: string;
}

export interface RagIndexRequest {
  documentId: string;
  storagePath: string;
  tenantId?: string;
  businessRequestId?: string;
  title?: string;
  enrichmentLevel?: 'basic' | 'contextual' | 'full';
  userId?: string;
  parentTenantId?: string;
  ultimateParentId?: string;
  spaceId?: string;
  documentScope?: 'kb' | 'br';
  visibleToChildren?: boolean;
  storageTarget?: string;
  resourceObjectType?: string;
  resourceId?: string;
  resourceFileProperty?: string;
  integrationId?: string;
  canonicalDocumentId?: string;
  documentType?: string;
  sourceAuthority?: string;
  tags?: string[];
  flags?: string[];
  effectiveDate?: string;
  expiryDate?: string;
  extractionTemplate?: string;
  contentClassification?: string;
  classificationConfidence?: number;
  documentStatus?: string;
  scopeTypes?: string[];
  jurisdictions?: string[];
  localities?: string[];
  entityRefs?: string[];
  conditions?: string[];
  themes?: string[];
  applicabilityPriority?: number;
  jobId?: string;
  recordId?: string;
}

export interface RagIndexResponse {
  success: boolean;
  documentId: string;
  status: 'indexed' | 'failed' | 'skipped' | string;
  chunkCount: number;
  pageCount: number;
  error?: string | null;
}

export interface BatchJobStatusResponse {
  jobId: string;
  tenantId: string;
  status: string;
  phase: string;
  processingMode: string;
  totalFiles: number;
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  documents: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** One entry of `machineAnalysis.extractedFields`, which is a list, not a map. */
export interface DocumentExtractedField {
  name: string;
  value: unknown;
  confidence: number | null;
  status?: 'found' | 'not_found' | 'unclear';
  sourcePage?: number;
  /** Where the analyser found the value in the document text, when it reports it. */
  sourceSpan?: { offset: number; length: number };
}

export interface DocumentStageResult {
  /** queued, processing, completed, failed, skipped, review_needed, or pending. */
  status: string;
}

/** Content Understanding results saved on a business-document record. */
export interface DocumentMachineAnalysis {
  processingStatus: string;
  /** `Unknown` when no published document type matched. */
  detectedDocumentTypeCode: string;
  classificationConfidence: number | null;
  extractedFields: DocumentExtractedField[];
  stageResults: {
    classification: DocumentStageResult;
    customExtraction: DocumentStageResult;
  };
}

export interface DocumentRecordResponse {
  documentId: string;
  resourceId: string;
  fileName: string;
  documentType: string;
  status: string;
  /** Present on records created by an app workflow (business documents). */
  machineAnalysis?: DocumentMachineAnalysis;
  [key: string]: unknown;
}

export class DocumentsModule {
  constructor(
    private baseUrl: string,
    private tenantId: string,
  ) {}

  private docsUrl(path: string): string {
    return `${this.baseUrl}/v4/data/documents${path}`;
  }

  private uploadForm(
    files: File[],
    processingMode: 'full' | 'classification',
    options: DocumentWorkflowOptions = {},
  ): FormData {
    const verticalKey = options.verticalKey?.trim();
    const workflowKey = options.workflowKey?.trim();
    if (!verticalKey || !workflowKey) {
      throw new Error('Document processing requires both verticalKey and workflowKey.');
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    formData.append('tenant_id', this.tenantId);
    formData.append('storage_target', 'resourceapi');
    formData.append('processing_mode', processingMode);
    formData.append('verticalKey', verticalKey);
    formData.append('workflowKey', workflowKey);

    for (const [key, value] of Object.entries(options)) {
      if (
        value === undefined ||
        key === 'verticalKey' ||
        key === 'workflowKey' ||
        key === 'tenant_id' ||
        key === 'storage_target' ||
        key === 'processing_mode'
      ) {
        continue;
      }
      formData.append(key, value);
    }
    return formData;
  }

  /** Upload a document (multipart/form-data). */
  async upload(
    file: File,
    options?: DocumentWorkflowOptions,
  ): Promise<Response> {
    return platformFetch(this.docsUrl('/upload'), {
      method: 'POST',
      body: this.uploadForm([file], 'full', options),
    });
  }

  /** Classify files through the supported Curate document lifecycle. */
  async classify(
    files: File[],
    options?: DocumentWorkflowOptions,
  ): Promise<Response> {
    return platformFetch(this.docsUrl('/upload'), {
      method: 'POST',
      body: this.uploadForm(files, 'classification', options),
    });
  }

  /** Classify a single document by URL. */
  async classifyByUrl(
    url: string,
    options: ClassifyByUrlOptions = {},
  ): Promise<Response> {
    // PublicAPI reads this route's tenant from the body, not the BFF header.
    if (!this.tenantId) {
      throw new Error(
        'classifyByUrl requires a tenantId (EAI workspace ID). Set NEXT_PUBLIC_EAI_TENANT_ID or pass tenantId to the client.',
      );
    }
    const verticalKey = options.verticalKey?.trim();
    const workflowKey = options.workflowKey?.trim();
    if (Boolean(verticalKey) !== Boolean(workflowKey)) {
      throw new Error('Classifier selection requires both verticalKey and workflowKey.');
    }
    return platformFetch(this.docsUrl('/classify-by-url'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentUrl: url,
        tenantId: this.tenantId,
        ...(verticalKey && workflowKey ? { verticalKey, workflowKey } : {}),
      }),
    });
  }

  /** Index a document for RAG (retrieval-augmented generation). */
  async ragIndex(request: string | RagIndexRequest): Promise<Response> {
    const body =
      typeof request === 'string'
        ? { documentId: request, tenantId: this.tenantId }
        : { ...request, tenantId: request.tenantId || this.tenantId };

    return platformFetch(this.docsUrl('/rag-index'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  /** Get status for a document upload/indexing job. */
  async getJobStatus(jobId: string): Promise<Response> {
    return platformFetch(this.docsUrl(`/jobs/${encodeURIComponent(jobId)}`));
  }

  /**
   * Read a saved document record, including `machineAnalysis` (classification
   * and extracted fields) once its job has finished.
   *
   * An app-workflow (business) document needs the upload `jobId`. Only the
   * uploading user can read it, and only while PublicAPI keeps the job: about
   * 24 hours after the job's last update. Save the `machineAnalysis` values you
   * need right after the read, for example into your own resource.
   *
   * Without `jobId`, the read finds planning-application documents only. For a
   * business document it then returns 404; in a workspace without planning
   * documents the code is `PASSIVE_SCHEMA_OBJECT_TYPE_NOT_PROVISIONED`, which
   * does not mean the schema is wrong. An expired job gives the same 404.
   */
  async getRecord(documentId: string, jobId?: string): Promise<Response> {
    const params = new URLSearchParams({ storage_target: 'resourceapi' });
    if (jobId) params.set('job_id', jobId);
    return platformFetch(
      this.docsUrl(`/records/${encodeURIComponent(documentId)}?${params}`),
    );
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

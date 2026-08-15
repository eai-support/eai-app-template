/**
 * Object Types Schema Definitions
 *
 * This file defines the domain Object Types for this app.
 * Object Types are seeded to Configurator via the seed-configurator skill or
 * the `/api/eai/seed` endpoint, and serve as the schema for runtime data
 * validation via ResourceAPI.
 *
 * Structure:
 * - For single-tenant apps: Use 'template' as the tenant key
 * - For multi-tenant apps: Use tenant slugs as keys (e.g., 'example-tenant')
 *
 * @see https://github.com/enterpriseaigroup/Configurator for Object Types collection schema
 */

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

/** Supported field types for object type properties */
export type FieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'json'
  | 'file'
  | 'relationship';

/** A select option for fields of type 'select' */
export interface SelectOption {
  label: string;
  value: string;
}

/** A property (field) definition within an object type */
export interface PropertyDefinition {
  /** camelCase field name */
  name: string;
  /** Field data type — determines validation and storage */
  type: FieldType;
  /** Whether the field is required on create/update */
  required: boolean;
  /** Whether to create a database index (improves query performance) */
  indexed?: boolean;
  /** Default value when not provided */
  defaultValue?: string | number | boolean;
  /** Required when type is 'select' — list of allowed values */
  options?: SelectOption[];
  /** Human-readable description / help text */
  description?: string;
}

/** Cardinality for relationships between object types */
export type Cardinality =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many';

/** A relationship link between two object types */
export interface LinkTypeDefinition {
  /** Plural lowercase name (e.g., 'documents') */
  name: string;
  /** PascalCase target object type name */
  targetObjectType: string;
  /** Relationship cardinality */
  cardinality: Cardinality;
  /** Whether deleting the source cascades to linked targets */
  cascadeDelete?: boolean;
}

/** Side effect types for actions */
export type SideEffectType = 'set_field' | 'set_timestamp' | 'set_user';

/** A side effect that occurs when an action is executed */
export interface ActionSideEffect {
  type: SideEffectType;
  field: string;
  value?: string | number | boolean;
}

/** Validation rules for an action */
export interface ActionValidationRules {
  /** Fields that must be non-empty before action can execute */
  requiredFields?: string[];
  /** Required status value before action can execute */
  requiredStatus?: string;
}

/** A named operation that can be executed on a resource */
export interface ActionDefinition {
  /** Lowercase action name (e.g., 'submit', 'approve') */
  name: string;
  /** Human-readable action label */
  displayName: string;
  /** Minimum OPA role required: tenant-viewer | tenant-builder | tenant-admin */
  requiredRole: 'tenant-viewer' | 'tenant-builder' | 'tenant-admin';
  /** Pre-conditions that must be met */
  validationRules: ActionValidationRules;
  /** State changes applied on execution */
  sideEffects: ActionSideEffect[];
}

/** Logical storage backend for resource data routed by ResourceAPI */
export type StorageBackend = 'postgresql' | 'documentdb' | 'blob' | 'search';

/** Lifecycle status of an object type */
export type ObjectTypeStatus = 'draft' | 'published' | 'deprecated';

/** A complete object type definition */
export interface ObjectTypeDefinition {
  /** PascalCase name (Configurator auto-generates kebab-case slug) */
  name: string;
  /** Checked-in v1 transport identifier derived exactly from name. */
  slug: string;
  /** Human-friendly display label */
  displayName: string;
  /** Optional description */
  description?: string;
  /** ResourceAPI record-level authorization policy. */
  authorization?: { privacyClass: 'owner_private' | 'shared_private' };
  /** Field definitions */
  properties: PropertyDefinition[];
  /** Relationship definitions */
  linkTypes: LinkTypeDefinition[];
  /** Named operations with validation and side effects */
  actions: ActionDefinition[];
  /** Logical data storage backend; tenant connections resolve the physical store */
  storageBackend: StorageBackend;
  /** Schema version understood by the platform Object Type publisher */
  schemaVersion?: number;
  /** Whether storage binding metadata is ready for ResourceAPI schema publish */
  storageMetadataStatus?: 'draft' | 'ready';
  /** App-owned storage binding metadata. Do not use shared ResourceAPI aliases. */
  storageBinding?: {
    sql?: {
      databaseAlias: 'tenant-postgres';
      tenantSchemaStrategy: 'per-tenant-schema';
      tableName: string;
    };
  };
  /** Lifecycle status — only 'published' types are available via ResourceAPI */
  status: ObjectTypeStatus;
}

// ---------------------------------------------------------------------------
// Object Type Definitions
// ---------------------------------------------------------------------------

function tenantStorageScope(tenantId: string): string {
  const scope =
    tenantId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(-12) || 'tenant';
  return /^[a-z]/.test(scope) ? scope : `t${scope}`;
}

function storageNamePrefix(parts: string[], separator = '_'): string {
  const replacement = separator === '-' ? '-' : '_';
  return parts
    .map((part) =>
      String(part || '')
        .toLowerCase()
        .replace(/-/g, separator),
    )
    .join(separator)
    .replace(/[^a-z0-9_-]+/g, replacement)
    .replace(/^[_-]+|[_-]+$/g, '');
}

function appSqlStorage(logicalTableName: string) {
  const tenantId =
    process.env.EAI_TENANT_ID ||
    process.env.NEXT_PUBLIC_EAI_TENANT_ID ||
    'tenant';
  const appKey =
    process.env.EAI_APP_KEY ||
    process.env.NEXT_PUBLIC_EAI_APP_KEY ||
    process.env.NEXT_PUBLIC_APP_NAME ||
    'template';
  const tablePrefix =
    process.env.EAI_STORAGE_TABLE_PREFIX ||
    `${storageNamePrefix([tenantStorageScope(tenantId), appKey], '_')}_`;

  return {
    schemaVersion: 1,
    storageBackend: 'postgresql' as const,
    storageMetadataStatus: 'ready' as const,
    storageBinding: {
      sql: {
        databaseAlias: 'tenant-postgres' as const,
        tenantSchemaStrategy: 'per-tenant-schema' as const,
        tableName: `${tablePrefix}${logicalTableName}`,
      },
    },
  };
}

export const objectTypes: Record<string, ObjectTypeDefinition[]> = {
  template: [
    {
      name: 'Application',
      slug: 'application',
      displayName: 'Application',
      description: 'A generic application or request submitted by a user',
      ...appSqlStorage('applications'),
      properties: [
        {
          name: 'applicantName',
          type: 'text',
          required: true,
          indexed: true,
          description: 'Full name of the applicant',
        },
        {
          name: 'applicantEmail',
          type: 'text',
          required: true,
          indexed: true,
          description: 'Email address of the applicant',
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          indexed: true,
          defaultValue: 'draft',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Submitted', value: 'submitted' },
            { label: 'Under Review', value: 'under_review' },
            { label: 'Approved', value: 'approved' },
            { label: 'Rejected', value: 'rejected' },
          ],
          description: 'Current status of the application',
        },
        {
          name: 'submittedAt',
          type: 'date',
          required: false,
          indexed: true,
          description: 'Date when the application was submitted',
        },
        {
          name: 'reviewedAt',
          type: 'date',
          required: false,
          description: 'Date when the application was reviewed',
        },
        {
          name: 'reviewedBy',
          type: 'text',
          required: false,
          description: 'User ID of the reviewer',
        },
        {
          name: 'notes',
          type: 'json',
          required: false,
          description: 'Additional notes or metadata as JSON',
        },
      ],
      linkTypes: [
        {
          name: 'documents',
          targetObjectType: 'document',
          cardinality: 'one-to-many',
          cascadeDelete: true,
        },
      ],
      actions: [
        {
          name: 'submit',
          displayName: 'Submit Application',
          requiredRole: 'tenant-viewer',
          validationRules: {
            requiredFields: ['applicantName', 'applicantEmail'],
            requiredStatus: 'draft',
          },
          sideEffects: [
            { type: 'set_field', field: 'status', value: 'submitted' },
            { type: 'set_timestamp', field: 'submittedAt' },
          ],
        },
        {
          name: 'approve',
          displayName: 'Approve Application',
          requiredRole: 'tenant-builder',
          validationRules: {
            requiredStatus: 'under_review',
          },
          sideEffects: [
            { type: 'set_field', field: 'status', value: 'approved' },
            { type: 'set_timestamp', field: 'reviewedAt' },
            { type: 'set_user', field: 'reviewedBy' },
          ],
        },
        {
          name: 'reject',
          displayName: 'Reject Application',
          requiredRole: 'tenant-builder',
          validationRules: {
            requiredStatus: 'under_review',
          },
          sideEffects: [
            { type: 'set_field', field: 'status', value: 'rejected' },
            { type: 'set_timestamp', field: 'reviewedAt' },
            { type: 'set_user', field: 'reviewedBy' },
          ],
        },
      ],
      status: 'published',
    },
    {
      name: 'Document',
      slug: 'document',
      displayName: 'Document',
      description: 'A file or document attached to an application',
      ...appSqlStorage('documents'),
      properties: [
        {
          name: 'fileName',
          type: 'text',
          required: true,
          indexed: true,
          description: 'Original filename',
        },
        {
          name: 'fileType',
          type: 'text',
          required: true,
          description: 'MIME type of the file (e.g., application/pdf)',
        },
        {
          name: 'fileSize',
          type: 'number',
          required: true,
          description: 'File size in bytes',
        },
        {
          name: 'storageUrl',
          type: 'text',
          required: true,
          description: 'URL or path to the stored file',
        },
        {
          name: 'uploadedAt',
          type: 'date',
          required: true,
          indexed: true,
          description: 'Date when the document was uploaded',
        },
        {
          name: 'uploadedBy',
          type: 'text',
          required: true,
          description: 'User ID who uploaded the document',
        },
        {
          name: 'isVerified',
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: 'Whether the document has been verified by staff',
        },
      ],
      linkTypes: [],
      actions: [
        {
          name: 'verify',
          displayName: 'Verify Document',
          requiredRole: 'tenant-builder',
          validationRules: {},
          sideEffects: [
            { type: 'set_field', field: 'isVerified', value: true },
          ],
        },
      ],
      status: 'published',
    },
    {
      name: 'Notification',
      slug: 'notification',
      displayName: 'Notification',
      description:
        'A notification sent to users about application status changes',
      ...appSqlStorage('notifications'),
      properties: [
        {
          name: 'recipientEmail',
          type: 'text',
          required: true,
          indexed: true,
          description: 'Email address of the notification recipient',
        },
        {
          name: 'subject',
          type: 'text',
          required: true,
          description: 'Email subject line',
        },
        {
          name: 'body',
          type: 'text',
          required: true,
          description: 'Email body content',
        },
        {
          name: 'sentAt',
          type: 'date',
          required: false,
          indexed: true,
          description: 'Date when the notification was sent',
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Sent', value: 'sent' },
            { label: 'Failed', value: 'failed' },
          ],
          description: 'Delivery status of the notification',
        },
        {
          name: 'relatedApplicationId',
          type: 'text',
          required: false,
          indexed: true,
          description: 'ID of the related application (if applicable)',
        },
      ],
      linkTypes: [],
      actions: [],
      status: 'published',
    },
  ],
};

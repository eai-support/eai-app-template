# V4 Documents And Files

This guide explains how an app should handle uploaded files, documents, and AI
workflows on the PublicAPI v4 surface.

`tenantId` and `--tenant-id` are stable platform contract names; their values identify the EAI workspace for these app operations.

## Choose The Right Model

| User goal                                                                   | Use this model                        | App API                                         | CLI                                                      |
| --------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------- | -------------------------------------------------------- |
| Upload a document so the platform can process, classify, or index it for AI | Document workflow                     | `useDocuments().upload`, `classify`, `ragIndex` | `eai docs upload`, `eai docs classify`, `eai docs index` |
| Attach a file to an existing business record                                | Resource file property                | `useResources(type).uploadFile`                 | `eai resources file upload`                              |
| Store an arbitrary blob without a document or resource owner                | Do not use as a public v4 app pattern | No public app-template helper                   | No named command                                         |

V4 does not treat file upload as a free-form blob write. A file belongs to one
of two public app concepts:

- a document workflow when the file itself is the thing to process, classify, or
  make available to AI;
- a ResourceAPI file property when the file is an attachment on an existing
  typed resource.

## Document Workflow

Use document workflow routes when the user thinks of the file as a document:
contracts, policies, evidence packs, supporting documents, reports, PDFs, Word
files, and knowledge sources.

Step goals:

1. Upload the file with the app and workflow that own its published classifier.
2. Capture the returned job or document ID.
3. Call `upload` or `classify` once per file, never both: each call stores a new
   document. `upload` runs classification as part of full processing;
   `classify` runs classification only.
4. Index the document for RAG when chat or workflow stages need to answer from
   the content.
5. Pass the document ID, business object ID, or workflow context to the AI
   workflow instead of giving the browser direct blob access.

App code:

```tsx
const { upload, ragIndex, getJobStatus } = useDocuments(tenantId);

const workflow = {
  verticalKey: 'my-document-app',
  workflowKey: 'document-intake',
};

const uploadResponse = await upload(file, {
  ...workflow,
  category: 'supporting-document',
  application_id: applicationId,
});
const uploadPayload = await uploadResponse.json();
const documentId =
  uploadPayload.documentId ||
  uploadPayload.documents?.[0]?.documentId ||
  uploadPayload.documents?.[0]?.document_id;

await ragIndex({
  documentId,
  businessRequestId: applicationId,
  documentScope: 'br',
});

if (uploadPayload.jobId) {
  await getJobStatus(uploadPayload.jobId);
}
```

CLI equivalent:

```bash
eai docs upload ./supporting-document.pdf
eai docs index <document-id>
```

`eai docs classify <file>` also uploads the file. Run it instead of
`eai docs upload` when you want classification only, not after it.

The PublicAPI route behind this workflow is:

```text
POST /v4/data/documents/upload
```

The SDK always sends `storage_target=resourceapi`. It sends `processing_mode=full`
for `upload` and `processing_mode=classification` for `classify`. The app and
workflow keys are required so PublicAPI can resolve the workspace's published
classifier.

Use `eai publicapi get /v4/data/documents/jobs/<job-id>` for job status until a
named CLI job command exists.

### Show Content Understanding Results

`classify` returns `202 Accepted` when the upload is queued. Content
Understanding finishes later. To show its results:

1. Call `classify([file], workflow)` once. It uploads the file, so do not also
   call `upload` for the same file: each call creates a new document.
2. Read `jobId` and `documents[0].document_id` from the `202` response.
3. Poll `getJobStatus(jobId)` until `status` is `completed`,
   `completed_with_errors`, or `failed`.
4. Read the saved record with `getRecord(documentId, jobId)`. The job ID makes
   the read resolve the document that this job created.
5. Show `record.machineAnalysis`.

| `machineAnalysis` field    | Meaning                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detectedDocumentTypeCode` | The matched document type, or `Unknown` when no published type matched. Custom extraction is then skipped.                                                                                                        |
| `classificationConfidence` | Classifier confidence from 0 to 1, or `null`.                                                                                                                                                                     |
| `stageResults`             | An object with `classification.status` and `customExtraction.status`.                                                                                                                                             |
| `extractedFields`          | A list, not a map. Each entry has `name`, `value`, and `confidence`, an optional `status` (`found`, `not_found`, or `unclear`), and an optional `sourceSpan` (`{ offset, length }`) when the analyser reports it. |

App code for a page such as `src/app/documents/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import type {
  BatchJobStatusResponse,
  DocumentRecordResponse,
} from '@enterpriseaigroup/platform-sdk';
import { useDocuments } from '@/hooks/useDocuments';

const workflow = {
  verticalKey: 'my-document-app',
  workflowKey: 'document-intake',
};
const FINISHED = ['completed', 'completed_with_errors', 'failed'];

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export default function DocumentReviewPage() {
  const { status } = useSession();
  const { classify, getJobStatus, getRecord } = useDocuments();
  const [message, setMessage] = useState('');
  const [record, setRecord] = useState<DocumentRecordResponse | null>(null);

  async function review(file: File) {
    setRecord(null);
    setMessage('Uploading…');
    const accepted = await classify([file], workflow);
    const upload = await accepted.json();
    if (!accepted.ok) {
      setMessage(`Upload refused (HTTP ${accepted.status}): ${show(upload)}`);
      return;
    }
    const jobId: string = upload.jobId;
    const documentId: string = upload.documents[0].document_id;

    // 202 Accepted is not completion: poll the job before reading results.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const job: BatchJobStatusResponse = await (
        await getJobStatus(jobId)
      ).json();
      setMessage(`Job ${job.status}`);
      if (FINISHED.includes(job.status)) break;
    }

    const saved = await getRecord(documentId, jobId);
    if (!saved.ok) {
      setMessage(`Record read failed (HTTP ${saved.status})`);
      return;
    }
    setRecord(await saved.json());
  }

  if (status === 'unauthenticated') {
    // src/auth.ts adds APP_BASE_PATH to relative callback paths. Pass an
    // absolute URL, or a path without the base path, so it is not doubled.
    return (
      <button
        type='button'
        onClick={() =>
          void signIn('microsoft-entra-id', {
            callbackUrl: window.location.href,
          })
        }
      >
        Sign in
      </button>
    );
  }

  const analysis = record?.machineAnalysis;
  return (
    <main>
      <input
        type='file'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            review(file).catch((error) => setMessage(String(error)));
          }
        }}
      />
      {message && <p>{message}</p>}
      {analysis && (
        <section>
          <p>
            {analysis.detectedDocumentTypeCode} (confidence{' '}
            {show(analysis.classificationConfidence)}). Classification{' '}
            {analysis.stageResults.classification.status}, extraction{' '}
            {analysis.stageResults.customExtraction.status}.
          </p>
          <ul>
            {analysis.extractedFields.map((field) => (
              <li key={field.name}>
                {field.name}: {show(field.value)} ({show(field.status)},
                confidence {show(field.confidence)})
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
```

### Workspace ID In The Browser

The BFF adds the workspace header from the server-side workspace ID
(`EAI_TENANT_ID`) to each call. So `upload`, `classify`, `getJobStatus`, and
`getRecord` work without `NEXT_PUBLIC_EAI_TENANT_ID`. `classifyByUrl` is the
exception: PublicAPI reads its workspace ID from the request body. The SDK
throws before it sends that request when neither `NEXT_PUBLIC_EAI_TENANT_ID`
nor a `useDocuments(tenantId)` argument gives a workspace ID.

## Resource File Property Workflow

Use resource file properties when the file is an attachment to business data:
inspection photos on an inspection record, signed PDFs on a contract record,
CSV evidence on an audit record, or files that should follow a resource's
permissions and lifecycle.

Step goals:

1. Define an Object Type with a `file` property.
2. Seed the Object Type.
3. Create or find the resource row.
4. Upload the file to that resource's file property.
5. Read, delete, or request a short-lived read URL through the same resource
   route when the user has access.

App code:

```tsx
const resources = useResources('ApplicationDocument', tenantId);

const document = await resources.create({
  title: file.name,
  applicationId,
  status: 'uploaded',
});

await resources.uploadFile(document.id, 'file', file, {
  filename: file.name,
  contentType: file.type || 'application/octet-stream',
});

const fileStatus = await resources.getFileIndexStatus(document.id, 'file');
```

CLI equivalent:

```bash
eai resources create ApplicationDocument \
  --tenant-id <workspace-id> \
  --data '{"title":"supporting-document.pdf","applicationId":"app-123"}'

eai resources file upload ApplicationDocument <resource-id> file ./supporting-document.pdf \
  --tenant-id <workspace-id>
```

The PublicAPI route behind this workflow is:

```text
POST /v4/data/resources/{tenantId}/{objectType}/{resourceId}/files/{propertyName}
```

## AI Workflow Access To Documents

AI workflows should not fetch raw blob storage directly from browser code. The
app should give the workflow stable platform context:

- `tenantId`
- `workflowId`
- `stage`
- `documentId` or `documentIds`
- related resource IDs such as `applicationId`, `caseId`, or `businessRequestId`
- user intent in the `message`
- structured values in `params` or `runtime_context`

Example:

```tsx
await client.chat.send({
  workflowId: 'application-advisor',
  stage: 'review',
  message:
    'Summarise the uploaded supporting documents and list missing evidence.',
  conversationId,
  params: {
    applicationId,
    documentIds: [documentId],
  },
  runtime_context: {
    applicationId,
    documentIds: [documentId],
  },
});
```

The workflow then uses the platform document/RAG context that has already been
indexed or attached to the resource. The prompt should ask for an outcome, not
for a storage URL.

## Prompt Templates For AI Agents

When an AI agent is building an app feature, it should ask the user these
questions before choosing an API:

```text
1. Is the uploaded file a document to process with AI, or an attachment to a business record?
2. Should AI answer from the file content, classify it, or just keep it as evidence?
3. Which workspace, workflow, and workflow stage should use the document?
4. If this is an attachment, which Object Type, resource ID, and file property owns it?
5. What should happen when the user deletes the resource or document?
```

When the file is a document:

```text
Use the EAI document workflow. Add upload, optional classify, optional RAG index,
and pass document IDs into the chat/workflow runtime context. Do not create a
standalone blob upload path.
```

When the file is a resource attachment:

```text
Use a ResourceAPI file property. Ensure the Object Type has a file property,
create or locate the resource, upload through the resource file route, and rely
on resource permissions for access.
```

When the request asks for standalone blob storage:

```text
There is no public v4 app-template pattern for arbitrary blob writes. Ask
whether this should be a document workflow or a resource file property, then
implement that public v4 model.
```

## Verification

Use these checks while developing:

```bash
eai whoami
eai resources schema --tenant-id <workspace-id> --format json
eai docs upload ./sample.pdf
eai docs index <document-id>
eai resources file upload <ObjectType> <resource-id> <property> ./sample.pdf --tenant-id <workspace-id>
```

Use named commands first. Use `eai publicapi <method> /v4/...` only when an
authorized v4 route has no named SDK or CLI command yet.

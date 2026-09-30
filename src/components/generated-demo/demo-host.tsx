'use client';

import { useEffect, useState } from 'react';
import { isOperationalRowsResponse } from '@/lib/generated-demo/operational-bridge';
import type { GeneratedOperationalRows } from '@/lib/generated-demo/operational-read';

interface DemoIdentity {
  sourceDigest: string;
  fixtureDigest: string;
}

export interface DemoOperationalIdentity {
  acceptedArtifactDigest: string;
  fixtureCollection: string;
  maxRows: number;
  projectedFields: string[];
}

function displayCell(value: string | number | boolean | null): string {
  return value === null ? '—' : String(value);
}

function TrustedOperationalRows({
  rows, fields,
}: {
  rows: GeneratedOperationalRows['rows'];
  fields: string[];
}) {
  return (
    <section className='mx-auto max-w-7xl p-5' aria-label='Live read-only data' data-eai-operational-read='true'>
      <h2 className='text-lg font-semibold text-slate-950'>Live read-only data</h2>
      <p className='mt-1 text-sm text-slate-600'>This trusted view shows authorized records. The app preview below still uses sample data and simulated actions.</p>
      {rows.length === 0 ? (
        <p className='mt-4 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600'>No records are available.</p>
      ) : (
        <div className='mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white'>
          <table className='min-w-full divide-y divide-slate-200 text-left text-sm'>
            <thead className='bg-slate-50'>
              <tr>
                {['id', ...fields].map((field) => <th key={field} scope='col' className='px-4 py-3 font-medium text-slate-700'>{field}</th>)}
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-100'>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope='row' className='px-4 py-3 font-medium text-slate-900'>{row.id}</th>
                  {fields.map((field) => <td key={field} className='px-4 py-3 text-slate-700'>{displayCell(row[field])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Authenticated parent renders operational rows; arbitrary generated source sees samples only. */
export function GeneratedDemoHost({
  demo, operational,
}: {
  demo: DemoIdentity;
  operational?: DemoOperationalIdentity;
}) {
  const basePath = (process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '').replace(/\/+$/, '');
  const [rows, setRows] = useState<GeneratedOperationalRows | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!operational) return;
    const controller = new AbortController();
    void fetch(`${basePath}/api/eai/generated-operational`, {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error('Authorized read unavailable');
      const value: unknown = await response.json();
      if (!isOperationalRowsResponse(value, operational.acceptedArtifactDigest,
          operational.fixtureCollection, operational.maxRows, operational.projectedFields))
        throw new Error('Authorized read response invalid');
      setRows(value);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [basePath, operational]);

  if (failed) return <main role='alert'>Live data is unavailable. No sample data was substituted.</main>;
  if (operational && !rows) return <main role='status'>Loading authorized app data…</main>;
  return (
    <main
      data-eai-demo-ready='true'
      data-eai-demo-source-digest={demo.sourceDigest}
      data-eai-demo-fixture-digest={demo.fixtureDigest}
      className='min-h-svh bg-slate-50'
    >
      {operational && rows ? <TrustedOperationalRows rows={rows.rows} fields={operational.projectedFields} /> : null}
      <div className='border-b border-amber-300 bg-amber-50 px-5 py-3 text-center text-sm font-medium text-amber-950' role='status'>
        Demo app · Sample data and simulated interactions. Changes here do not affect real records or services.
      </div>
      <iframe
        title='Generated app demo'
        src={`${basePath}/eai-demo-frame`}
        sandbox='allow-scripts'
        referrerPolicy='no-referrer'
        className='min-h-[calc(100svh-3rem)] w-full border-0'
      />
    </main>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  isOperationalAckMessage,
  isOperationalReadyMessage,
  isOperationalRowsResponse,
  type OperationalDataMessage,
} from '@/lib/generated-demo/operational-bridge';
import type { GeneratedOperationalRows } from '@/lib/generated-demo/operational-read';

interface DemoIdentity {
  sourceDigest: string;
  fixtureDigest: string;
}

export interface DemoOperationalIdentity {
  acceptedArtifactDigest: string;
  fixtureCollection: string;
  maxRows: number;
}

function randomNavigationNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

/** Authenticated outer document loads rows; the opaque source frame never fetches them. */
export function GeneratedDemoHost({
  demo, operational,
}: {
  demo: DemoIdentity;
  operational?: DemoOperationalIdentity;
}) {
  const basePath = (process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '').replace(/\/+$/, '');
  const frame = useRef<HTMLIFrameElement>(null);
  const frameLoaded = useRef(false);
  const [nonce, setNonce] = useState('');
  const [rows, setRows] = useState<GeneratedOperationalRows | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (operational) setNonce(randomNavigationNonce());
  }, [operational]);

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
          operational.fixtureCollection, operational.maxRows))
        throw new Error('Authorized read response invalid');
      setRows(value);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [basePath, operational]);

  useEffect(() => {
    if (!operational || !rows || failed) return;
    const onFrameMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      if (isOperationalAckMessage(event.data, nonce, operational.acceptedArtifactDigest)) {
        setConnected(true);
        return;
      }
      if (!isOperationalReadyMessage(event.data, nonce, operational.acceptedArtifactDigest)) return;
      const message: OperationalDataMessage = {
        type: 'eai.generated.operational.data.v1',
        nonce,
        acceptedArtifactDigest: operational.acceptedArtifactDigest,
        fixtureCollection: rows.fixtureCollection,
        rows: rows.rows,
      };
      frame.current?.contentWindow?.postMessage(message, '*');
    };
    window.addEventListener('message', onFrameMessage);
    return () => window.removeEventListener('message', onFrameMessage);
  }, [failed, nonce, operational, rows]);

  useEffect(() => {
    if (!operational || !rows || !nonce || connected || failed) return;
    const timeout = window.setTimeout(() => setFailed(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [connected, failed, nonce, operational, rows]);

  if (failed) return <main role='alert'>Live data is unavailable. No sample data was substituted.</main>;
  if (operational && (!rows || !nonce)) return <main role='status'>Loading authorized app data…</main>;
  return (
    <main
      data-eai-demo-ready={!operational || connected ? 'true' : undefined}
      data-eai-demo-source-digest={demo.sourceDigest}
      data-eai-demo-fixture-digest={demo.fixtureDigest}
      className='min-h-svh bg-slate-50'
    >
      <div className='border-b border-amber-300 bg-amber-50 px-5 py-3 text-center text-sm font-medium text-amber-950' role='status'>
        {operational
          ? connected
            ? 'Authorized read-only data. All actions remain simulated; no real records are changed.'
            : 'Connecting authorized app data…'
          : 'Demo app · Sample data and simulated interactions. Changes here do not affect real records or services.'}
      </div>
      <iframe
        ref={frame}
        onLoad={() => {
          // A second navigation must get a fresh parent document and nonce.
          if (operational && frameLoaded.current) setFailed(true);
          frameLoaded.current = true;
        }}
        title='Generated app demo'
        src={`${basePath}/eai-demo-frame${operational ? `?nonce=${encodeURIComponent(nonce)}` : ''}`}
        sandbox='allow-scripts'
        referrerPolicy='no-referrer'
        className='min-h-[calc(100svh-3rem)] w-full border-0'
      />
    </main>
  );
}

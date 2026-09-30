'use client';

import dynamic from 'next/dynamic';

import { GeneratedWorkflowForm } from '@/components/generated-workflow/workflow-form';
import type { GeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime-contract';

const DemoPage = dynamic(() =>
  import('@enterpriseaigroup/demo').then((module) => module.DemoPage),
);

interface HomeClientProps {
  generatedDemo?: {
    sourceDigest: string;
    fixtureDigest: string;
  };
  generatedWorkflow?: Pick<
    GeneratedWorkflowRuntime,
    'appKey' | 'binding' | 'snapshot' | 'branding' | 'assistantEnabled'
  >;
  runtimeError?: string;
}

export function HomeClient({
  generatedDemo,
  generatedWorkflow,
  runtimeError,
}: HomeClientProps) {
  if (runtimeError) {
    const isGeneratedDemoError = runtimeError === 'DEMO_ARTIFACT_INVALID';
    return (
      <main className='flex min-h-svh items-center justify-center bg-slate-50 p-6'>
        <section className='max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm'>
          <h1 className='text-xl font-semibold text-slate-950'>
            {isGeneratedDemoError ? 'App unavailable' : 'Workflow unavailable'}
          </h1>
          <p className='mt-2 text-sm text-slate-600'>
            {isGeneratedDemoError
              ? 'The deployed app source did not pass its integrity check.'
              : 'The deployed workflow snapshot did not pass its integrity check.'}
          </p>
        </section>
      </main>
    );
  }
  if (generatedDemo) {
    const basePath = (process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '').replace(
      /\/+$/,
      '',
    );
    return (
      <main
        data-eai-demo-ready='true'
        data-eai-demo-source-digest={generatedDemo.sourceDigest}
        data-eai-demo-fixture-digest={generatedDemo.fixtureDigest}
        className='min-h-svh bg-slate-50'
      >
        <div
          className='border-b border-amber-300 bg-amber-50 px-5 py-3 text-center text-sm font-medium text-amber-950'
          role='status'
        >
          Demo app · Sample data and simulated interactions. Changes here do not
          affect real records or services.
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
  if (!generatedWorkflow) {
    return <DemoPage />;
  }
  return (
    <div
      data-eai-workflow-ready='true'
      data-eai-workflow-digest={
        generatedWorkflow.binding.workflowTemplate.digest
      }
      data-eai-workflow-title={generatedWorkflow.binding.workflowTemplate.title}
    >
      <GeneratedWorkflowForm
        appKey={generatedWorkflow.appKey}
        binding={generatedWorkflow.binding}
        branding={generatedWorkflow.branding}
        assistantEnabled={generatedWorkflow.assistantEnabled}
        snapshot={generatedWorkflow.snapshot}
      />
    </div>
  );
}

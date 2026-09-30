import 'reflect-metadata';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { headers } from 'next/headers';
import Script from 'next/script';

import './globals.css';
import { Providers } from './providers';
import { tenantConfigs } from '@/eai.config';
import { generatedWorkflowDocumentMetadata } from '@/lib/generated-workflow/document-metadata';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';

// Fonts
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

/** Bind document title and icon to the same validated generated-workflow branding. */
export function generateMetadata(): Metadata {
  return generatedWorkflowDocumentMetadata(getGeneratedWorkflowRuntime());
}

/** The middleware-selected demo document omits providers that carry tenant/session state. */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allHeaders = await headers();
  if (allHeaders.get('x-eai-isolated-demo') === '1') {
    return (
      <html lang='en'>
        <body className={`${geistSans.variable} antialiased`}>{children}</body>
      </html>
    );
  }
  const nonce = allHeaders.get('x-nonce') ?? '';

  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <Script id='init' nonce={nonce} strategy='afterInteractive'>
          {`console.log("Nonce is attached securely!")`}
        </Script>
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        <Providers tenants={tenantConfigs}>{children}</Providers>
      </body>
    </html>
  );
}

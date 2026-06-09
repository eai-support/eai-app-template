---
sidebar_position: 2
slug: /tutorials/add-ai-chat
---

# Tutorial: Add AI Chat to Your Vertical

Add a streaming AI chat interface to your vertical application using AICore. This tutorial walks you through configuring a chat workflow, building a chat UI with real-time streaming, and integrating document-based RAG.

## What You'll Build

- A streaming chat interface with SSE (Server-Sent Events)
- Context-aware AI responses using your domain documents
- Document upload and RAG indexing

## Prerequisites

- A working vertical project (see [Build a Task Tracker](/docs/tutorials/build-a-task-tracker))
- Authenticated with `eai login`
- Object Types seeded to the platform

## Step 1: Understand the AI Architecture

```
Browser → useChat hook → /api/eai/stream/v3/chat/stream/{tenant}/{workflow}/{stage}
                                    ↓
                              BFF Stream Proxy (injects Bearer token)
                                    ↓
                              PublicAPI → AICore
                                    ↓
                              SSE events stream back to browser
```

Key concepts:
- **Workflow**: A named AI pipeline configured in the Configurator
- **Stage**: A step within a workflow (e.g., `chat`, `classify`, `summarize`)
- **Conversation**: Identified by `conversation_id` for multi-turn context

## Step 2: Configure the Workflow

Your workflow needs to be registered in the Configurator. Use the CLI:

```bash
# Check if your workflow exists
eai verify
```

The workflow ID is configured in your `.env.local`:

```bash
WORKFLOW_tracker_ID=<workflow-id-from-configurator>
```

If you need to create a workflow, contact your platform admin or use the Configurator UI.

## Step 3: Build the Chat Page

Create `src/app/(presentation)/chat/page.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const { stream } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsStreaming(true);

    // Add empty assistant message for streaming
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const reader = await stream({
        message: userMessage,
        conversationId,
        params: {},
      });

      let fullContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE data lines
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    content: fullContent,
                  };
                  return updated;
                });
              }
            } catch {
              // Non-JSON SSE line, skip
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat stream error:', error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-20">
            <h2 className="text-xl font-medium mb-2">AI Assistant</h2>
            <p>Ask me anything about your domain.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-4 rounded-lg ${
              msg.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 border rounded-md px-3 py-2"
          disabled={isStreaming}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

## Step 4: Add Document Upload for RAG

Create a document upload component that feeds documents into the RAG index:

```tsx
'use client';

import { useDocuments } from '@/hooks/useDocuments';
import { useState } from 'react';

export function DocumentUploader() {
  const { upload, index } = useDocuments();
  const [status, setStatus] = useState<string>('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('Uploading...');
    const doc = await upload(file);

    setStatus('Indexing for RAG...');
    await index(doc.id);

    setStatus(`Done! Document "${file.name}" is now searchable.`);
  }

  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-medium mb-2">Upload Knowledge Document</h3>
      <input type="file" onChange={handleUpload} accept=".pdf,.docx,.txt,.md" />
      {status && <p className="text-sm text-muted-foreground mt-2">{status}</p>}
    </div>
  );
}
```

## Step 5: Wire It Up

Add the chat page to your navigation. In your tenant config:

```typescript
layout: {
  sidebar: [
    { component: 'NavLink', props: { href: '/tasks', label: 'Tasks' }, priority: 1 },
    { component: 'NavLink', props: { href: '/chat', label: 'AI Chat' }, priority: 2 },
  ],
},
```

## Step 6: Test It

```bash
eai dev
```

1. Navigate to http://localhost:3000/chat
2. Type a message and watch the response stream in
3. Upload a document and ask questions about its content

You can also test from the CLI:

```bash
# Quick test
eai chat send "What can you help me with?"

# Interactive streaming
eai chat stream "Tell me about the uploaded documents"
```

## How the SSE Proxy Works

The stream proxy at `src/app/api/eai/stream/[[...rest]]/route.ts` handles SSE differently from regular API calls:

1. Sets `Content-Type: text/event-stream` header
2. Disables response buffering (`Cache-Control: no-cache`)
3. Keeps connection alive (`Connection: keep-alive`)
4. Forwards the `ReadableStream` directly from PublicAPI to the browser

This is why chat uses `/api/eai/stream/` while all other calls use `/api/eai/`.

## What You Learned

- **SSE Streaming**: Real-time chat with Server-Sent Events through the BFF proxy
- **useChat Hook**: Abstraction over the streaming protocol
- **Conversation Management**: Multi-turn context with `conversation_id`
- **Document RAG**: Upload, index, and query documents through AICore

## Next Steps

- [Deploy to Azure](/docs/tutorials/deploy-to-azure) — Ship your AI-powered vertical
- [Architecture Overview](/docs/architecture/overview) — Understand the full platform stack
- [AI Integration Guide](/docs/extending/public-api-access) — Advanced AI patterns

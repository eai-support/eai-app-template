import { z } from 'zod';

export const workflowAssistantQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    stepId: z.string().min(1).max(100),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .strict();

export type WorkflowAssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

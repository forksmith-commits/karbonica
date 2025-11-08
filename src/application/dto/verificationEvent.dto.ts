import { z } from 'zod';

// Request DTOs
export const createVerificationEventSchema = z.object({
  body: z.object({
    eventType: z.string().min(1).max(100),
    message: z.string().min(1).max(1000),
    metadata: z.record(z.any()).optional(),
  }),
});

export type CreateVerificationEventRequest = z.infer<typeof createVerificationEventSchema>;

// Response DTOs
export interface VerificationEventResponse {
  status: string;
  data: {
    event: {
      id: string;
      verificationId: string;
      eventType: string;
      message: string;
      userId: string;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    };
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface VerificationEventListResponse {
  status: string;
  data: {
    events: Array<{
      id: string;
      verificationId: string;
      eventType: string;
      message: string;
      userId: string;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>;
    count: number;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

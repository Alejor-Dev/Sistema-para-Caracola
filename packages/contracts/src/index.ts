import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(10).max(256),
});

export const initializeAdminSchema = loginSchema.extend({
  displayName: z.string().trim().min(2).max(120),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type InitializeAdminInput = z.infer<typeof initializeAdminSchema>;

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  permissions: string[];
}

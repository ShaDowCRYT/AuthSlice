import { z } from "zod";

export const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required")
    .max(100, "Full name must be at most 100 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const signinSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const codeSchema = z
  .string()
  .length(6, "Code must be 6 digits")
  .regex(/^\d+$/, "Code must contain only digits");

export const verifySchema = z.object({
  email: z.string().email("Enter a valid email address"),
  code: codeSchema,
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  code: codeSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type VerifyInput = z.infer<typeof verifySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

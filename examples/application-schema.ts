/**
 * Proposed, minimized first-stage application DTO based on fields visible in
 * Cynbit's public Backend Developer Intern form. It is not the site's observed
 * payload or an implementation claim. Defer DOB, gender, WhatsApp, and full
 * permanent address until a documented need and purpose exist.
 */

import { z } from "zod";

const httpsUrl = z.string().trim().url().max(2_048).refine(
  (value) => new URL(value).protocol === "https:",
  "Use an HTTPS link.",
);

const Qualification = z.object({
  highestQualification: z.string().trim().min(1).max(80),
  degree: z.string().trim().min(1).max(120),
  specialization: z.string().trim().min(1).max(120),
  institution: z.string().trim().min(1).max(180),
  graduationYear: z.number().int().min(1950).max(new Date().getUTCFullYear() + 8),
  educationStatus: z.string().trim().min(1).max(60),
  scoreSystem: z.string().trim().min(1).max(40),
  // Keep as a bounded string because CGPA, percentages, and other scales differ.
  scoreValue: z.string().trim().min(1).max(32),
}).strict();

export const ApplicationSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(32),
  qualification: Qualification,
  noticePeriod: z.string().trim().min(1).max(100),
  technicalSkills: z.string().trim().min(1).max(1_000),
  currentCity: z.string().trim().min(1).max(120),
  resumeOrPortfolioUrl: httpsUrl,
  linkedInUrl: httpsUrl,
  otherProfileUrl: httpsUrl.optional(),
  applicationStatement: z.string().trim().min(20).max(5_000),
  consentToTalentReview: z.literal(true),
}).strict();

export type ApplicationRequest = z.infer<typeof ApplicationSchema>;


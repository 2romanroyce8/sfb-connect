/**
 * Contract types — mirror of the REQUIRED backend contract in README.md
 * (from sfb-hq-real-ui). They do not claim any backend already exists.
 */
export type Role = "owner" | "manager" | "staff";

export interface SessionUser {
  id: string;
  name: string;
  avatar?: string;
  email: string;
  role: Role;
  /** Businesses this staff member is assigned to. Ignored for owner+manager. */
  assignedBusinessIds: string[];
}

export interface Business {
  id: string;
  name: string;
  kind?: string;
}

export const CONTACT_STAGES = ["New", "In conversation", "Proposal", "Won", "Lost"] as const;
export type ContactStage = (typeof CONTACT_STAGES)[number];

export interface Contact {
  id: string;
  businessId: string;
  name: string;
  company?: string;
  website?: string;
  socialUrl?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  stage: ContactStage;
  notes?: string;
  revision: number;
  /** ISO timestamp from the server, if provided. Never invented client-side. */
  updatedAt?: string;
}

export interface ContactInput {
  businessId: string;
  name: string;
  company?: string;
  website?: string;
  socialUrl?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  stage: ContactStage;
  notes?: string;
  expectedRevision?: number;
}

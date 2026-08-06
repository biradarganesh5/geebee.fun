import { z } from 'zod';

/**
 * About content layer: a short first-person blurb synthesized from the resume
 * Summary in `main.md`.
 *
 * Defines the Zod schema, the inferred TypeScript type, and the validated seed
 * data parsed at module load so invalid content fails fast (build-time +
 * test-time validation), matching the sibling content modules.
 */

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

/**
 * The About content model: a single free-text blurb bounded to a couple of
 * sentences so it stays a concise intro rather than a wall of text.
 */
export const AboutSchema = z.object({
  aboutText: z.string().min(20).max(600),
});
export type About = z.infer<typeof AboutSchema>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated About content, synthesized faithfully from the `main.md` Summary
 * (AWS-certified DevOps/Cloud Engineer, 3+ years, ECS→EKS migration, $24K+/yr
 * savings, Packer AMIs 80% faster, multi-cloud, GitOps/IaC/observability,
 * FinOps + reliability + AI-driven automation). First-person and casual.
 */
export const aboutContent: About = AboutSchema.parse({
  aboutText:
    "I'm an AWS-certified DevOps and Cloud Engineer with 3+ years spent designing, automating, and scaling production workloads across AWS, AWS China, and Alibaba Cloud. I like to solve difficult problems; as well as optimize and make systems more efficient. I'm currently learning by building an on-prem multi-architecture Homelab running proxmox and Kubernetes. I'm hands-on across Kubernetes, GitOps, IaC, and observability, with a soft spot for FinOps, reliability, and AI-driven automation.",
});

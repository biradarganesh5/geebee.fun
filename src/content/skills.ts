import { z } from 'zod';

/**
 * Skills content layer: a flat list of skill labels rendered as badges, drawn
 * from the Skills section of `main.md`.
 *
 * Defines the Zod schema, the inferred TypeScript type, and the validated seed
 * data parsed at module load so invalid content fails fast (build-time +
 * test-time validation), matching the sibling content modules.
 */

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

/**
 * The Skills collection: a non-empty list of non-empty, unique skill labels.
 * Uniqueness keeps the badge cloud free of duplicates.
 */
export const Skills = z
  .array(z.string().min(1))
  .min(1)
  .refine((s) => new Set(s).size === s.length, 'skill labels must be unique');
export type Skills = z.infer<typeof Skills>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated skills, sourced from the `main.md` Skills section, validated at
 * module load so invalid content fails fast.
 */
export const skills: Skills = Skills.parse([
  'AWS',
  'AWS China',
  'Alibaba Cloud',
  'Amazon EKS',
  'Amazon ECS',
  'Kubernetes',
  'Helm',
  'Terraform',
  'Argo CD',
  'Argo Workflows',
  'GitHub Actions',
  'Jenkins',
  'Packer',
  'Git',
  'Grafana',
  'Prometheus',
  'Loki',
  'Datadog',
  'New Relic',
  'AWS CloudWatch',
  'Uptime Kuma',
  'Windows Server',
  'FinOps',
  'Spot Optimization',
  'Proxmox',
  'Networking',
]);

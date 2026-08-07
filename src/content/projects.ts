import { z } from 'zod';

/**
 * Projects content layer: featured project cards sourced from the Projects
 * section of `main.md`.
 *
 * Defines the Zod schemas, the inferred TypeScript types, and the validated
 * seed data parsed at module load so invalid content fails fast (build-time +
 * test-time validation), matching the sibling content modules.
 */

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

/** The kind of external link attached to a project. */
export const ProjectLinkType = z.enum(['github', 'website', 'demo', 'other']);
export type ProjectLinkType = z.infer<typeof ProjectLinkType>;

/** A single external link on a project card. */
export const ProjectLink = z.object({
  type: ProjectLinkType,
  href: z.string().min(1),
});
export type ProjectLink = z.infer<typeof ProjectLink>;

/**
 * A single featured project.
 *
 * - `title` and `description` are required non-empty strings; the description
 *   is bounded to keep cards readable.
 * - `dates` is a human-readable period/year.
 * - `tags` is a technology list.
 * - `links` is optional (empty/omitted when unknown).
 * - `image` is optional (a placeholder is used when absent).
 */
export const Project = z.object({
  title: z.string().min(1),
  description: z.string().min(20).max(400),
  dates: z.string().min(1),
  tags: z.array(z.string().min(1)),
  links: z.array(ProjectLink).optional(),
  image: z.string().optional(),
});
export type Project = z.infer<typeof Project>;

/** The projects collection: a non-empty list of projects. */
export const Projects = z.array(Project).min(1);
export type Projects = z.infer<typeof Projects>;

// -----------------------------------------------------------------------------
// Seed data (parsed at module load)
// -----------------------------------------------------------------------------

/**
 * Validated featured projects, sourced from `main.md`, validated at module load
 * so invalid content fails fast. Links are left empty where the source does not
 * provide a URL, and images are omitted so a placeholder can be used.
 */
export const projects: Projects = Projects.parse([
  {
    title: 'AI-Driven Pipeline Failure Notifier',
    description:
      'Event-driven notifier that watches Argo Workflows pipelines and uses an LLM to parse logs, run root-cause analysis, and post fix suggestions to Slack — cutting triage time.',
    dates: '2025',
    tags: ['Python', 'Argo Workflows', 'Kubernetes', 'LLM', 'Slack API'],
    links: [],
  },
  {
    title: 'ECS to EKS Production Migration',
    description:
      'Built a production EKS platform with Terraform and Helm, re-platforming legacy ECS workloads into hardened Kubernetes with IRSA roles and network policies.',
    dates: '2025',
    tags: [
      'Amazon EKS',
      'Terraform',
      'Helm',
      'External Secrets',
      'gp3',
      'Route53/ALB',
    ],
    links: [],
  },
]);

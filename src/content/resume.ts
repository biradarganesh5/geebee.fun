import { z } from 'zod';

/**
 * A single employment entry in the Resume_Section.
 *
 * Req 6.2: each of the three employers (AmberStudent, IAMOPS, Mactores) carries
 * a role title and a time period expressed as start and end dates (or a start
 * date and "Present").
 */
export const Employment = z.object({
  employer: z.enum(['AmberStudent', 'IAMOPS', 'Mactores']),
  role: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1), // date or "Present" (Req 6.2)
  /** Optional org logo shown beside the entry (initials fallback if absent). */
  logoUrl: z.string().optional(),
});
export type Employment = z.infer<typeof Employment>;

/**
 * A featured project in the Resume_Section.
 *
 * Req 6.4: exactly the two named projects, each with a description of 20 to 300
 * characters.
 */
export const Project = z.object({
  name: z.enum([
    'AI-Driven Pipeline Failure Notifier',
    'ECS to EKS Production Migration',
  ]),
  description: z.string().min(20).max(300),
});
export type Project = z.infer<typeof Project>;

/**
 * The full resume content model.
 *
 * Req 6.1: AWS-certified DevOps and Cloud Engineer headline with 3+ years.
 * Req 6.2: exactly three employers, each with role + start/end period.
 * Req 6.3: at least four highlighted achievements.
 * Req 6.4: exactly two projects with 20–300 char descriptions.
 * Req 6.6: a formal resume URL for the downloadable/viewable resume.
 */
export const ResumeContent = z.object({
  headline: z.string().min(1),
  yearsExperience: z.number().min(3),
  employers: z.array(Employment).length(3),
  achievements: z.array(z.string().min(1)).min(4),
  projects: z.array(Project).length(2),
  formalResumeUrl: z.string(),
});
export type ResumeContent = z.infer<typeof ResumeContent>;

/**
 * Seed resume content sourced from `main.md`, validated at module load so
 * invalid content fails fast.
 */
export const resumeContent: ResumeContent = ResumeContent.parse({
  headline:
    'AWS-certified DevOps and Cloud Engineer with 3+ years designing, automating, and scaling production workloads across AWS, AWS China, and Alibaba Cloud.',
  yearsExperience: 3,
  employers: [
    {
      employer: 'AmberStudent',
      role: 'DevOps Engineer',
      start: 'Aug 2025',
      end: 'Present',
      logoUrl: '/images/logos/amber.png',
    },
    {
      employer: 'IAMOPS',
      role: 'DevOps Engineer',
      logoUrl: '/images/logos/IAMOPS-Logo.webp',
      start: 'Jun 2024',
      end: 'Aug 2025',
    },
    {
      employer: 'Mactores',
      role: 'Cloud Engineer',
      start: 'Apr 2023',
      end: 'Jun 2024',
      logoUrl: '/images/logos/mactores.png',
    },
  ],
  achievements: [
    'Led the end-to-end migration of 25+ microservices from AWS ECS to Amazon EKS with Argo CD GitOps and Argo Workflows CI/CD for zero-downtime, self-service deployments.',
    'Captured $24K+/year in recurring cloud cost savings through right-sizing, VPA, and spot-backed workloads.',
    'Cut deployment time by up to 80% (from ~50 minutes to ~10 minutes) using HashiCorp Packer-baked AMIs.',
    'Engineered multi-cloud connectivity across AWS Global, AWS China, and Alibaba Cloud for a seamless experience in geo-restricted regions.',
  ],
  projects: [
    {
      name: 'AI-Driven Pipeline Failure Notifier',
      description:
        'Event-driven notifier that watches Argo Workflows CI/CD pipelines, detects failures in real time, and uses an LLM to parse logs, run root-cause analysis, and route contextual fix suggestions to Slack.',
    },
    {
      name: 'ECS to EKS Production Migration',
      description:
        'Provisioned an EKS platform with Terraform and Helm (External Secrets, gp3, VPA, ALB ingress, Route53) and re-platformed legacy ECS task definitions into hardened Kubernetes workloads with IRSA and network policies.',
    },
  ],
  formalResumeUrl: '/resume.pdf',
});

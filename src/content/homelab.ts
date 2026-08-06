import { z } from 'zod';

/**
 * A single piece of homelab hardware/infrastructure described in the
 * Homelab_Section.
 *
 * Req 4.1: a dedicated server running TrueNAS used for storage.
 * Req 4.2: a mini PC cluster connected through a 4-port gigabit switch.
 * Req 4.3: an i5 main master node mini PC plus additional mini PCs acting as
 *          worker nodes running k3s and Proxmox.
 */
export const HomelabComponent = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1).max(500),
});
export type HomelabComponent = z.infer<typeof HomelabComponent>;

/**
 * A single self-hosted service running in the homelab.
 *
 * Req 4.4: each service carries a text description of 1 to 280 characters
 * stating the service's purpose.
 */
export const SelfHostedService = z.object({
  name: z.enum([
    'Jellyfin',
    'Immich',
    'Seafile',
    'qBittorrent',
    'WireGuard',
    'Vaultwarden',
  ]),
  purpose: z.string().min(1).max(280),
  /**
   * A short, plain-language "it's basically X" analogy so non-technical
   * visitors instantly get what the service is (e.g. Immich → "Personal Google
   * Photos"). Optional so the schema stays backward-compatible.
   */
  analogy: z.string().min(1).max(60).optional(),
});
export type SelfHostedService = z.infer<typeof SelfHostedService>;

/**
 * The complete set of self-hosted services.
 *
 * Req 4.4: exactly the six named services Jellyfin, Immich, Seafile,
 * qBittorrent, WireGuard, and Vaultwarden, each appearing exactly once.
 */
export const Services = z
  .array(SelfHostedService)
  .length(6)
  .refine(
    (s) => new Set(s.map((x) => x.name)).size === 6,
    'exactly the six named services',
  );
export type Services = z.infer<typeof Services>;

/**
 * Seed homelab hardware components, validated at module load.
 *
 * Covers Req 4.1 (TrueNAS storage server), Req 4.2 (mini PC cluster on a
 * 4-port gigabit switch), and Req 4.3 (i5 master node + worker mini PCs
 * running k3s and Proxmox).
 */
export const homelabComponents: HomelabComponent[] = z
  .array(HomelabComponent)
  .parse([
    {
      id: 'truenas-storage',
      title: 'TrueNAS Storage Server',
      description:
        'A dedicated server running TrueNAS that serves as the central storage backbone of the homelab, pooling drives for reliable, redundant network storage of media, backups, and files.',
    },
    {
      id: 'mini-pc-cluster',
      title: 'Mini PC Cluster',
      description:
        'A cluster of mini PCs networked together through a 4-port gigabit switch, giving every node fast wired connectivity for clustered workloads and inter-node traffic.',
    },
    {
      id: 'k3s-proxmox-nodes',
      title: 'k3s + Proxmox Nodes',
      description:
        'An i5 mini PC acts as the main master k3s node, with additional mac mini joining as worker nodes. Together they run k3s for lightweight Kubernetes orchestration and Proxmox for virtualization.',
    },
  ]);

/**
 * Seed self-hosted services with concise purpose descriptions, validated at
 * module load.
 *
 * Req 4.4: exactly Jellyfin, Immich, Seafile, qBittorrent, WireGuard, and
 * Vaultwarden.
 */
export const services: Services = Services.parse([
  {
    name: 'Jellyfin',
    analogy: 'Personal Netflix',
    purpose: 'Media streaming server for movies, TV, and music across devices.',
  },
  {
    name: 'Immich',
    analogy: 'Personal Google Photos',
    purpose: 'Self-hosted photo and media backup with automatic phone syncing.',
  },
  {
    name: 'Seafile',
    analogy: 'Personal Google Drive',
    purpose: 'File sync and sharing across devices with versioned storage.',
  },
  {
    name: 'qBittorrent',
    analogy: 'Torrent client',
    purpose: 'Torrent client for downloading and seeding files.',
  },
  {
    name: 'WireGuard',
    analogy: 'Home VPN',
    purpose: 'Fast, secure VPN for accessing the homelab from anywhere.',
  },
  {
    name: 'Vaultwarden',
    analogy: 'Personal password manager',
    purpose:
      'Self-hosted Bitwarden-compatible password manager for secure, private credential storage.',
  },
]);

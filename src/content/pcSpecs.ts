import { z } from 'zod';

/**
 * The eleven PC component categories showcased in the PC_Specs_Section.
 *
 * Req 5.1: CPU, GPU, RAM, Storage, Motherboard, Cooling, PSU, Case, Monitor,
 * Mouse, and Headphones.
 */
export const PcCategory = z.enum([
  'CPU',
  'GPU',
  'RAM',
  'Storage',
  'Motherboard',
  'Cooling',
  'PSU',
  'Case',
  'Monitor',
  'Mouse',
  'Headphones',
]);
export type PcCategory = z.infer<typeof PcCategory>;

/**
 * A single PC component: its category label and its stated value.
 *
 * Req 5.1 / 5.3: each component pairs a category with a non-empty stated value.
 */
export const PcComponent = z.object({
  category: PcCategory,
  value: z.string().min(1),
});
export type PcComponent = z.infer<typeof PcComponent>;

/**
 * The complete set of PC components.
 *
 * Req 5.1 / 5.6: exactly eleven entries with unique categories (each of the
 * eleven categories appears exactly once) and non-empty values.
 */
export const PcComponents = z
  .array(PcComponent)
  .length(11)
  .refine(
    (c) => new Set(c.map((x) => x.category)).size === 11,
    'unique categories',
  );
export type PcComponents = z.infer<typeof PcComponents>;

/**
 * Seed PC components with the exact stated values from Req 5.1, validated at
 * module load so invalid content fails fast.
 */
export const pcComponents: PcComponents = PcComponents.parse([
  { category: 'CPU', value: 'AMD Ryzen 7 5800X3D' },
  { category: 'GPU', value: 'AMD Radeon RX 7800XT' },
  { category: 'RAM', value: '32 GB DDR4 3600 MHz' },
  { category: 'Storage', value: '1 TB NVMe Gen4 SSD' },
  { category: 'Motherboard', value: 'Gigabyte X570S AERO G' },
  { category: 'Cooling', value: 'Deepcool LT 360mm AIO Liquid Cooling' },
  { category: 'PSU', value: 'Corsair HX1000i' },
  { category: 'Case', value: 'Lian Li O11 Dynamic' },
  { category: 'Monitor', value: 'Alienware 25 inch 320Hz' },
  { category: 'Mouse', value: 'Logitech G Pro X Superlight' },
  { category: 'Headphones', value: 'HyperX Alpha Wireless' },
]);

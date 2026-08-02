import { z } from 'zod';

/**
 * Identifier for each of Ganesh's three hobbies.
 *
 * Req 3.1: exactly Homelabbing, PCB designing, and 3D modelling.
 */
export const HobbyId = z.enum(['homelabbing', 'pcb-designing', '3d-modelling']);

/**
 * A single hobby entry.
 *
 * Each entry carries a text label naming the hobby (Req 3.1) plus a distinct
 * visual style token and animation token used to give it a visually distinct
 * treatment (Req 3.2).
 */
export const Hobby = z.object({
  id: HobbyId,
  label: z.string().min(1),
  styleVariant: z.string(), // distinct visual style token
  animationVariant: z.string(), // distinct animation token
  /** Optional background image shown behind the card's label. */
  imageUrl: z.string().optional(),
});

/**
 * The Hobbies collection.
 *
 * Req 3.1: exactly three labeled entries.
 * Req 3.2: no two entries share the same combination of visual style and
 * animation variant.
 */
export const Hobbies = z
  .array(Hobby)
  .length(3)
  .refine(
    (hs) =>
      new Set(hs.map((h) => `${h.styleVariant}|${h.animationVariant}`)).size ===
      hs.length,
    'each entry needs a unique style+animation combination',
  );

/** Identifier for one of Ganesh's hobbies. */
export type HobbyId = z.infer<typeof HobbyId>;
/** A single hobby entry. */
export type Hobby = z.infer<typeof Hobby>;
/** The validated collection of hobby entries. */
export type Hobbies = z.infer<typeof Hobbies>;

/**
 * Seed hobby entries. Each entry has a distinct style + animation combination
 * so no two share the same visual treatment (Req 3.2). Validated at module load
 * so invalid content fails fast.
 */
export const hobbies: Hobbies = Hobbies.parse([
  {
    id: 'homelabbing',
    label: 'Homelabbing',
    styleVariant: 'card-neon',
    animationVariant: 'slide-up',
    imageUrl: '/images/hobbies/homelab.png',
  },
  {
    id: 'pcb-designing',
    label: 'PCB designing',
    styleVariant: 'card-circuit',
    animationVariant: 'fade-scale',
    imageUrl: '/images/hobbies/pcb.jpg',
  },
  {
    id: '3d-modelling',
    label: '3D modelling',
    styleVariant: 'card-glass',
    animationVariant: 'rotate-in',
    imageUrl: '/images/hobbies/3d.avif',
  },
]);

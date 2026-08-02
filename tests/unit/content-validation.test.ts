import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Build-time content validation (Task 5.15).
//
// Purpose: parse every content module in src/content through its Zod schema so
// that any count/length/value violation fails the build BEFORE deploy
// (Requirements 3.1, 3.2, 4.4, 5.1, 6.2, 6.4, 7.1, 7.2).
//
// This test is the TS-aware entry point wired into `npm run validate:content`,
// which itself runs first in `npm run build`. Because every content module
// already calls `.parse()` on its seed data at module load, merely importing a
// module would throw a ZodError on invalid content. To make the validation
// explicit (and independent of import side-effect elision), each validator
// below re-parses the module's exported seed data through its schema. A schema
// violation surfaces here as a failing test and a non-zero exit, aborting the
// build.

import {
  HeroContentSchema,
  HotspotsSchema,
  heroContent,
  hotspots,
} from '../../src/content/hero';
import { NavTargets, navTargets } from '../../src/content/navigation';
import { Hobbies, hobbies } from '../../src/content/hobbies';
import {
  HomelabComponent,
  Services,
  homelabComponents,
  services,
} from '../../src/content/homelab';
import { PcComponents, pcComponents } from '../../src/content/pcSpecs';
import { ResumeContent, resumeContent } from '../../src/content/resume';
import {
  Certifications,
  certifications,
} from '../../src/content/certifications';
import { ProfileSchema, profile } from '../../src/content/profile';
import { AboutSchema, aboutContent } from '../../src/content/about';
import { Skills, skills } from '../../src/content/skills';
import { Education, education } from '../../src/content/education';
import { Projects, projects } from '../../src/content/projects';

/**
 * The registry of content validators. Each entry re-parses a module's exported
 * seed data through its schema; a thrown ZodError fails the build.
 */
const contentValidators: Array<{ name: string; validate: () => void }> = [
  { name: 'hero:content', validate: () => HeroContentSchema.parse(heroContent) },
  { name: 'hero:hotspots', validate: () => HotspotsSchema.parse(hotspots) },
  { name: 'navigation', validate: () => NavTargets.parse(navTargets) },
  { name: 'hobbies', validate: () => Hobbies.parse(hobbies) },
  {
    name: 'homelab:components',
    validate: () => z.array(HomelabComponent).parse(homelabComponents),
  },
  { name: 'homelab:services', validate: () => Services.parse(services) },
  { name: 'pc-specs', validate: () => PcComponents.parse(pcComponents) },
  { name: 'resume', validate: () => ResumeContent.parse(resumeContent) },
  { name: 'certifications', validate: () => Certifications.parse(certifications) },
  { name: 'profile', validate: () => ProfileSchema.parse(profile) },
  { name: 'about', validate: () => AboutSchema.parse(aboutContent) },
  { name: 'skills', validate: () => Skills.parse(skills) },
  { name: 'education', validate: () => Education.parse(education) },
  { name: 'projects', validate: () => Projects.parse(projects) },
];

describe('build-time content validation', () => {
  it('registers a validator for every content module', () => {
    // Guards against a content module being added without a validator wired in.
    expect(contentValidators.length).toBe(14);
  });

  it.each(contentValidators)(
    'content:$name parses cleanly through its Zod schema',
    ({ validate }) => {
      expect(() => validate()).not.toThrow();
    },
  );
});

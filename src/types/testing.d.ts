// Registers the @testing-library/jest-dom matcher types (toBeInTheDocument,
// toHaveAttribute, toHaveTextContent, toBeVisible, …) with the TypeScript
// checker for the whole project.
//
// The matchers are wired into Vitest's `expect` at runtime by
// `vitest.setup.ts` (which imports '@testing-library/jest-dom/vitest'), but
// that setup file lives outside this tsconfig's `include`, so its module
// augmentation of `vitest`'s `Assertion` interface is invisible to
// `astro check`. Importing the same subpath here — inside `src`, which the
// tsconfig includes — makes the augmentation available to the type-checker
// without loosening any app type safety.
import '@testing-library/jest-dom/vitest';

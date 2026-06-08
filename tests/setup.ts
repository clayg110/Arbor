// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) on
// vitest's expect. Harmless under the node environment; only exercised by the
// jsdom component tests.
import "@testing-library/jest-dom/vitest";

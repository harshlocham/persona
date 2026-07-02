/**
 * Shared utility types used across layers.
 */

/** Make selected keys of T optional. */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Extract the element type from a readonly array. */
export type ArrayElement<T extends readonly unknown[]> = T[number];

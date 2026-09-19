"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Read a browser-only value without a hydration mismatch: the server (and the first
 * client render) see `serverValue`, then the real value takes over.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, read, () => serverValue);
}

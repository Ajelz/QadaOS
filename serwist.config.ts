import { serwist } from "@serwist/next/config";

/**
 * Configurator mode: `serwist build` runs after `next build`, reads the emitted
 * assets and prerendered pages, and writes public/sw.js with the precache manifest.
 */
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  globIgnores: ["public/sw.js", "public/sw.js.map"],
});

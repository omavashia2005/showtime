import type { SceneRenderer } from "./SceneRenderer";

/** Mutable holder for the single SceneRenderer instance, set once PixiStage finishes async
 * init. Chrome components that need stage<->viewport coordinate conversion (e.g. the rename
 * overlay) read this instead of prop-drilling the renderer through the whole tree. */
export const rendererCell: { current: SceneRenderer | null } = { current: null };

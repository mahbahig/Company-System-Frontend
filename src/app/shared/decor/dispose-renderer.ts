import { Mesh, type Material, type Scene, type Texture, type WebGLRenderer } from 'three';

/**
 * Tears a renderer down completely: GPU resources, the WebGL context, and
 * one thing `renderer.dispose()` misses.
 *
 * three.js keeps a single module-level lookup texture (`DFG_LUT`) for its
 * physically based materials, and every renderer that draws one hangs a
 * `dispose` listener on it that holds the renderer's WebGL context — never
 * removed by `renderer.dispose()`. So each discarded renderer would stay
 * reachable for the life of the page. Disposing the lookup runs those
 * listeners and unhooks them; a renderer still alive just re-uploads the
 * 16×16 table on its next frame.
 *
 * @param disposeContent Frees the caller's geometries, materials and
 *   textures; run after the lookup is found (a disposed material forgets it).
 */
export function disposeRenderer(
  renderer: WebGLRenderer,
  scene: Scene,
  disposeContent: () => void,
): void {
  let lookup: Texture | null | undefined;
  scene.traverse((object) => {
    if (lookup || !(object instanceof Mesh)) return;
    for (const material of [object.material].flat() as Material[]) {
      const compiled = renderer.properties.get(material) as {
        uniforms?: { dfgLUT?: { value?: Texture | null } };
      };
      lookup ??= compiled.uniforms?.dfgLUT?.value;
    }
  });
  disposeContent();
  lookup?.dispose();
  renderer.dispose();
  // Free the context now rather than whenever the canvas is garbage-collected.
  renderer.forceContextLoss();
}

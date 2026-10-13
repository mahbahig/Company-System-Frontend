/**
 * Shaders for the sky behind the sign-in page. Both draw in CSS pixels
 * through an orthographic camera, scaled to device pixels by the renderer.
 */

/** Stars hold still and twinkle — two out-of-step sines, so no rhythm shows. */
export const STAR_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aSeed;
  attribute float aTint;
  attribute float aBright;

  varying float vAlpha;
  varying float vTint;
  varying float vBright;
  varying float vCore;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    // The sprite is several times the star's core, leaving room for its halo
    // (and, on bright stars, the cross of light).
    float span = mix(4.0, 11.0, aBright);
    gl_PointSize = aSize * span * uPixelRatio;
    vCore = 1.0 / span;

    float slow = sin(uTime * (0.21 + aSeed * 0.47) + aSeed * 17.0);
    float fast = sin(uTime * (0.7 + aSeed * 1.9) + aSeed * 61.0);
    vAlpha = mix(0.8, 1.0, aBright) * (0.62 + 0.38 * slow * fast);
    vTint = aTint;
    vBright = aBright;
  }
`;

/** A crisp core in a soft halo; bright stars add a faint cross of light. */
export const STAR_FRAGMENT = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform float uOpacity;
  uniform float uSparkle;

  varying float vAlpha;
  varying float vTint;
  varying float vBright;
  varying float vCore;

  void main() {
    vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
    float d = length(p);
    float core = 1.0 - smoothstep(0.0, vCore, d);
    float halo = pow(max(1.0 - d, 0.0), 6.0) * 0.45;
    float width = vCore * 0.3;
    float rays =
      exp(-(p.y * p.y) / (width * width)) * pow(max(1.0 - p.x, 0.0), 3.0) +
      exp(-(p.x * p.x) / (width * width)) * pow(max(1.0 - p.y, 0.0), 3.0);
    float alpha = clamp(core + halo + rays * vBright * 0.6, 0.0, 1.0);

    vec3 color = mix(mix(uCool, uWarm, vTint), vec3(1.0), core * uSparkle);
    gl_FragColor = vec4(color, alpha * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

/**
 * One meteor per instance: the instance matrix places the head and turns the
 * streak along its path; `aMeteor` is (tail length, thickness, opacity, tint).
 */
export const METEOR_VERTEX = /* glsl */ `
  attribute vec4 aMeteor;

  varying vec2 vLocal;
  varying float vTail;
  varying float vScale;
  varying float vOpacity;
  varying float vTint;

  void main() {
    // The quad's corners are ±1: x = -1 is the tail's end, x = +1 sits just
    // ahead of the head, y spans the streak's glow.
    float pad = 12.0 * aMeteor.y;
    vLocal = vec2(position.x < 0.0 ? -aMeteor.x : pad, position.y * pad);
    vTail = max(aMeteor.x, 1.0);
    vScale = aMeteor.y;
    vOpacity = aMeteor.z;
    vTint = aMeteor.w;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(vLocal, 0.0, 1.0);
  }
`;

/** A hot head trailing a tail that thins and fades towards its end. */
export const METEOR_FRAGMENT = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uTailCool;
  uniform vec3 uTailWarm;

  varying vec2 vLocal;
  varying float vTail;
  varying float vScale;
  varying float vOpacity;
  varying float vTint;

  void main() {
    // 0 at the tail's end, 1 at the head.
    float along = clamp(1.0 + vLocal.x / vTail, 0.0, 1.0);
    float behind = step(vLocal.x, 0.0);
    float core = exp(-pow(vLocal.y / (0.9 * vScale * mix(0.3, 1.0, along)), 2.0));
    float glow = exp(-pow(vLocal.y / (3.6 * vScale * mix(0.4, 1.0, along)), 2.0)) * 0.3;
    float trail = (core + glow) * along * along * behind;

    float r2 = dot(vLocal, vLocal) / (vScale * vScale);
    float head = exp(-r2 / 4.0) + exp(-r2 / 40.0) * 0.4;

    vec3 tail = mix(uTailCool, uTailWarm, vTint);
    vec3 color = mix(tail, uHead, clamp(head + pow(along, 8.0), 0.0, 1.0));
    gl_FragColor = vec4(color, clamp(trail + head, 0.0, 1.0) * vOpacity);
    #include <colorspace_fragment>
  }
`;

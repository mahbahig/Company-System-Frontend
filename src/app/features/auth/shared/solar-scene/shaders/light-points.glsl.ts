/**
 * Point sprites for the scene's small lights: drifting "photon" dust around the
 * lockup and the glints that ride the energy orbits. Both are sized in pixels
 * at unit distance and attenuate with depth, so they carry real parallax.
 */

/** Dust drifts slowly round the vertical axis, bobs, and twinkles — all on the GPU. */
export const DUST_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aWarmth;

  varying float vAlpha;
  varying float vWarmth;

  void main() {
    vec3 p = position;
    float drift = uTime * (0.012 + aSeed * 0.02);
    float c = cos(drift);
    float s = sin(drift);
    p.xz = mat2(c, s, -s, c) * p.xz;
    p.y += sin(uTime * 0.22 + aSeed * 6.2831) * 0.14;

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * (0.35 + aSeed * 0.65) * uPixelRatio / -viewPosition.z;

    vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.5 + aSeed * 0.8) + aSeed * 37.0));
    vWarmth = aWarmth;
  }
`;

export const DUST_FRAGMENT = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vWarmth;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(mix(uCool, uWarm, vWarmth), glow * glow * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

export const GLINT_VERTEX = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * uPixelRatio / -viewPosition.z;
  }
`;

/** A hot pin of light (`uCore`) inside a soft coloured halo. */
export const GLINT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCore;
  uniform float uOpacity;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.2, d);
    float halo = pow(1.0 - smoothstep(0.0, 1.0, d), 3.0) * 0.55;
    gl_FragColor = vec4(mix(uColor, uCore, core * 0.7), clamp(core + halo, 0.0, 1.0) * uOpacity);
    #include <colorspace_fragment>
  }
`;

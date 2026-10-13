/** A soft, round wash of warm light — the sun the panels face; no post-processing bloom needed. */
export const SUN_GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SUN_GLOW_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    gl_FragColor = vec4(uColor, pow(max(1.0 - d, 0.0), 2.6) * uOpacity);
    #include <colorspace_fragment>
  }
`;

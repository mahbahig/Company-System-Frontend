import { SIMPLEX_NOISE_GLSL } from './simplex-noise.glsl';

/** Passes the object-space position (so the plasma turns with the sphere) and view vectors. */
export const SUN_SURFACE_VERTEX = /* glsl */ `
  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vSurface = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

/**
 * A luminous golden photosphere that is visibly alive: brand yellow warming to
 * a hot core and deepening to orange at the limb. Large convection cells
 * churn under a flowing warp and broad active regions drift through the tone,
 * all carried round as the sphere turns. Contrast stays moderate so it reads
 * as light, not lava.
 */
export const SUN_SURFACE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uDeep;
  uniform vec3 uEmber;

  varying vec3 vSurface;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  ${SIMPLEX_NOISE_GLSL}

  void main() {
    vec3 p = normalize(vSurface) * 3.2;
    float t = uTime;

    float regions = snoise(p * 0.42 + vec3(0.0, t * 0.05, 0.0));
    vec3 warp = vec3(
      snoise(p * 0.7 + vec3(t * 0.1, 0.0, 0.0)),
      snoise(p * 0.7 + vec3(0.0, t * 0.1, 4.1)),
      snoise(p * 0.7 + vec3(2.7, 0.0, t * 0.1))
    );
    float cells = fbm(p * 1.25 + warp * 0.5 + vec3(0.0, 0.0, t * 0.14));

    float facing = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);

    // Cells shift hue (hot ↔ orange) rather than brightness, so the gold never muddies.
    vec3 color = mix(uMid, uHot, pow(facing, 3.0) * 0.2);
    color = mix(color, uDeep, smoothstep(0.05, 0.85, regions) * 0.28);
    color = mix(color, uHot, smoothstep(0.0, 0.5, cells) * 0.32);
    color = mix(color, uDeep, smoothstep(0.0, 0.5, -cells) * 0.36);
    color = mix(color, uDeep, pow(1.0 - facing, 1.5) * 0.7);
    color = mix(color, uEmber, pow(1.0 - facing, 4.0) * 0.45);
    color *= 0.74 + 0.26 * pow(facing, 0.5);
    color += uMid * pow(1.0 - facing, 7.0) * 0.4;

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

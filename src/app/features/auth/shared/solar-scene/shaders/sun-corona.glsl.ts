import { SIMPLEX_NOISE_GLSL } from './simplex-noise.glsl';

export const SUN_CORONA_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Camera-facing corona, measured in sun radii from the disc centre (the disc
 * itself hides everything inside r = 1):
 *
 * - a limb glow whose flares travel round the rim,
 * - a wide warm haze with faint streamers,
 * - the crown: the eighteen tapered rays of the Ecotech sun mark, turning
 *   slowly, each ray's reach breathing on its own,
 * - a soft wave of light that leaves the limb every few seconds.
 *
 * Outputs straight (non-premultiplied) colour, so the same shader works with
 * additive blending on the night stage and normal blending over daylight.
 * Everything fades out before the billboard's edge so no seam can show.
 */
export const SUN_CORONA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uExtent;
  uniform float uRays;
  uniform float uTurn;
  uniform vec3 uInner;
  uniform vec3 uOuter;
  uniform vec3 uRayColor;
  uniform float uGlow;
  uniform float uHaze;
  uniform float uRayStrength;
  uniform float uPulse;

  varying vec2 vUv;

  ${SIMPLEX_NOISE_GLSL}

  const float TAU = 6.28318530718;
  const float PULSE_PERIOD = 4.5;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uExtent;
    float r = length(p);
    float d = max(r - 1.0, 0.0);
    float angle = atan(p.y, p.x);
    vec2 ring = vec2(cos(angle), sin(angle));

    float flare = snoise(vec3(ring * 1.6, uTime * 0.2)) * 0.5 + 0.5;
    float fine = snoise(vec3(ring * 6.0, uTime * 0.3)) * 0.5 + 0.5;
    float limb = exp(-d * (7.5 - 4.0 * flare)) * uGlow;
    float haze = exp(-d * 1.7) * uHaze;
    float streamers = pow(fine, 3.0) * exp(-d * 3.0) * 0.2 * uGlow;

    float sector = TAU / uRays;
    float turned = angle - uTurn;
    float index = floor(turned / sector + 0.5);
    float offAxis = abs(turned - index * sector) * r;
    float reach = 1.72 + 0.22 * snoise(vec3(mod(index, uRays) * 1.7, uTime * 0.45, 0.0));
    float along = clamp((r - 0.95) / (reach - 0.95), 0.0, 1.0);
    float halfWidth = sector * 0.3 * (1.0 - along);
    float softness = 0.012 + 0.03 * along;
    float rays = (1.0 - smoothstep(halfWidth - softness, halfWidth + softness, offAxis))
      * pow(1.0 - along, 1.15) * uRayStrength;

    float wave = fract(uTime / PULSE_PERIOD);
    float waveRadius = 1.0 + wave * (uExtent * 0.6 - 1.0);
    float pulse = exp(-pow((r - waveRadius) * 7.0, 2.0)) * pow(1.0 - wave, 2.0) * uPulse;

    float edgeFade = 1.0 - smoothstep(uExtent * 0.7, uExtent, r);
    float glow = (limb + haze + streamers + pulse) * edgeFade;
    rays *= edgeFade;

    vec3 glowColor = mix(uInner, uOuter, smoothstep(0.0, 1.2, d));
    float alpha = glow + rays;
    vec3 color = (glowColor * glow + uRayColor * rays) / max(alpha, 1e-4);

    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`;

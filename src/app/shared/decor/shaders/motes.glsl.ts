/**
 * Motes of light hanging in the air: each rises very slowly, sways, and
 * fades in and out on its own rhythm, wrapping from top back to bottom
 * unseen. Positions are fractions of the view; `uAspect` stretches them to
 * the canvas width so the field covers any banner.
 */
export const MOTES_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uAspect;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute float aSeed;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 p = position;
    p.x = p.x * uAspect + sin(uTime * 0.07 + aSeed * 23.0) * 0.06;
    p.y = mod(p.y + 1.0 + uTime * 0.012 * (0.4 + aSeed), 2.0) - 1.0;
    float wrap = smoothstep(-1.0, -0.75, p.y) * (1.0 - smoothstep(0.75, 1.0, p.y));

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = uSize * (0.35 + aSeed * 0.65) * uPixelRatio / -viewPosition.z;

    vAlpha = wrap * (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.25 + aSeed * 0.35) + aSeed * 51.0)));
    vSeed = aSeed;
  }
`;

export const MOTES_FRAGMENT = /* glsl */ `
  uniform vec3 uWarm;
  uniform vec3 uCool;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = pow(max(1.0 - d, 0.0), 2.0);
    gl_FragColor = vec4(mix(uWarm, uCool, step(0.72, vSeed)), glow * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

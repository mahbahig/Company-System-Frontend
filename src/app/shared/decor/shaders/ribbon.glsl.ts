/**
 * A ribbon of light: a long strip whose centre line flows in slow, unequal
 * waves and whose cross-section turns along its length like silk, so it
 * widens and brightens where it faces the viewer and thins to a thread where
 * it turns edge-on. Everything moves in the vertex shader.
 */
export const RIBBON_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  uniform float uY;
  uniform float uWidth;
  uniform float uAmplitude;
  uniform float uWave;
  uniform float uSpeed;
  uniform float uTwist;
  uniform float uDepth;
  uniform float uPhase;

  varying float vAlong;
  varying float vAcross;
  varying float vFacing;

  void main() {
    float x = position.x * uLength;
    float t = uTime * uSpeed;
    float y = uY + uAmplitude * (
      sin(x * uWave + t + uPhase) * 0.65 +
      sin(x * uWave * 0.47 - t * 1.3 + uPhase * 1.7) * 0.35
    );
    float z = uDepth * sin(x * uWave * 0.6 + t * 0.8 + uPhase);
    float turn = x * uTwist * 0.35 + t * 0.9 + uPhase;
    vec3 across = vec3(0.0, cos(turn), sin(turn)) * uWidth * position.y;

    vAlong = position.x + 0.5;
    vAcross = position.y * 2.0;
    vFacing = abs(cos(turn));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vec3(x, y, z) + across, 1.0);
  }
`;

export const RIBBON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uGlintPeriod;
  uniform vec3 uFrom;
  uniform vec3 uTo;
  uniform float uOpacity;

  varying float vAlong;
  varying float vAcross;
  varying float vFacing;

  void main() {
    float edge = 1.0 - smoothstep(0.45, 1.0, abs(vAcross));
    float ends = smoothstep(0.0, 0.2, vAlong) * (1.0 - smoothstep(0.8, 1.0, vAlong));
    float sheen = mix(0.3, 1.0, pow(vFacing, 1.5));
    float glintAt = fract(uTime / uGlintPeriod + uPhase * 0.16);
    float glint = exp(-pow((vAlong - glintAt) * 7.0, 2.0)) * vFacing;

    vec3 color = mix(uFrom, uTo, smoothstep(0.15, 0.85, vAlong));
    gl_FragColor = vec4(color * (1.0 + glint * 0.6), edge * ends * (sheen + glint * 0.5) * uOpacity);
    #include <colorspace_fragment>
  }
`;

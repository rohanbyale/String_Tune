uniform sampler2D tDiffuse;
uniform float uRippleTime;
uniform float uRippleAmplitude;
uniform float uRippleProgress;
uniform vec2 uResolution;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // Center of the screen in UV space
  vec2 center = vec2(0.5);

  // Vector from center to this fragment
  vec2 delta = uv - center;

  // Correct for aspect ratio
  float aspect = uResolution.x / uResolution.y;
  delta.x *= aspect;

  float dist = length(delta);

  // Single radiating pulse: Gaussian + Sine wave
  // radius expands from center based on uRippleProgress
  float radius = uRippleProgress;
  
  // uRippleAmplitude controls the height of the pulse
  // Gaussian envelope (exp(-pow...)) ensures we only see ONE wave ring at a time
  float pulse = exp(-pow((dist - radius) * 3.0, 2.0)); 
  float wave = pulse * sin((dist - radius) * 10.0);

  // Attenuation: fade out effect specifically near the very center to prevent artifacts
  float attenuation = smoothstep(0.0, 0.05, dist);

  // Displacement amount along the radial direction
  vec2 normalizedDelta = dist > 0.001 ? normalize(delta) : vec2(0.0);
  normalizedDelta.x /= aspect;

  vec2 displacement = normalizedDelta * wave * uRippleAmplitude * 0.04 * attenuation;

  vec2 distortedUv = uv + displacement;

  // Clamp to prevent sampling outside the texture
  distortedUv = clamp(distortedUv, 0.0, 1.0);

  vec4 color = texture2D(tDiffuse, distortedUv);

  gl_FragColor = color;
}

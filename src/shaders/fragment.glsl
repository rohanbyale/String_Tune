// This code is injected AFTER dithering, near the end of the fragment main() function.
// DO NOT DEFINE FUNCTIONS HERE as we are inside main().
vec3 baseColor = gl_FragColor.rgb;

// 1. Initial State Noise (FBM): Dark gray with white noise
vec2 noiseCoord = gl_FragCoord.xy * -4.5 + uTime * 0.1;
float f = sword_calcFBM(noiseCoord);

// 2. Clear Lighting
// 2. Clear Lighting with HEAVY Noise
float n = fract(sin(dot(gl_FragCoord.xy * .5, vec2(12.9898 + uTime, 78.233 + uTime))) * 43758.5453);
// Increased noise intensity significantly for a weathered, high-texture look
vec3 grainOverlay = baseColor * (0.65 + 0.45 * n) * (0.65 + 0.35 * f); 

vec3 swordColor = pow(max(grainOverlay * 1.9, 0.0), vec3(1.4));

// 3. Glossy Specular Highlight
vec3 myNormal = normalize(vNormal);
vec3 myViewDir = normalize(vViewPosition);

// Sharp Mirror reflection highlight for glossiness
vec3 myReflect = reflect(-myViewDir, myNormal);
float glossySpec = pow(max(dot(myReflect, vec3(0.0, 0.5, 0.5)), 0.0), 70.0);
swordColor += vec3(0.9) * glossySpec * 8.8;

// --- Final Color Mix ---
// 🔥 ONLY CHANGE: darker base
vec3 grayBase = vec3(0.1); // was 0.28

vec3 blackNoisyTexture = grayBase * (0.1 * f + 0.2 * n);
vec3 darkSwordNoisy = blackNoisyTexture;

// Transition
vec3 finalColor = mix(darkSwordNoisy, swordColor, uBlackout);

gl_FragColor = vec4(finalColor, gl_FragColor.a);
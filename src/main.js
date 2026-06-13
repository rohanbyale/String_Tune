import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js"
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js"
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js"
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js"
import gsap from "gsap"
import fragmentShader from "./shaders/fragment.glsl"
import vertexShader from "./shaders/vertex.glsl"
import rippleFragmentShader from "./shaders/rippleFragment.glsl"
import rippleVertexShader from "./shaders/rippleVertex.glsl"

let scene, camera, renderer, sword, katanaMesh, sheathMesh, composer, ripplePass, scrollMsgEl
let initialKatanaX = 0
let initialSheathX = 0
let baseScale = 1
let canMove = false
let scrollProgress = 0
let smoothTextProgress = 0
const mouse = { x: 0, y: 0 }
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
})

window.addEventListener('scroll', () => {
  scrollProgress = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
})

const shaderContext = {
  uTime: { value: 0 },
  uBlackout: { value: 0.0 },
  uRippleAmplitude: { value: 0.0 },
  uRippleFrequency: { value: 0.0 },
  uRippleProgress: { value: 0.0 }
}

init()
animate()

function init() {
  scene = new THREE.Scene()

  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, -.3, 8)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  document.body.appendChild(renderer.domElement)

  // --- Post-processing setup ---
  // Using Linear color space here (default) to keep the pipeline linear
  // and handle the final sRGB conversion in the OutputPass.
  const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth, window.innerHeight,
    {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    }
  )
  composer = new EffectComposer(renderer, renderTarget)
  composer.addPass(new RenderPass(scene, camera))

  const RippleShader = {
    uniforms: {
      tDiffuse: { value: null },
      uRippleTime: { value: 0 },
      uRippleAmplitude: shaderContext.uRippleAmplitude,
      uRippleFrequency: shaderContext.uRippleFrequency,
      uRippleProgress: shaderContext.uRippleProgress,
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: rippleVertexShader,
    fragmentShader: rippleFragmentShader
  }

  ripplePass = new ShaderPass(RippleShader)
  composer.addPass(ripplePass)

  // Final OutputPass handles tonemapping and color space conversion
  const outputPass = new OutputPass()
  composer.addPass(outputPass)

  const mainLight = new THREE.DirectionalLight(0xffffff, 4)
  mainLight.position.set(5, 10, 5)
  scene.add(mainLight)

  const checkLight = new THREE.DirectionalLight(0xffffff, 2)
  checkLight.position.set(-5, -5, -5)
  scene.add(checkLight)

  const rimLight = new THREE.DirectionalLight(0xaabbfc, 4)
  rimLight.position.set(0, 5, -10)
  scene.add(rimLight)

  const ambient = new THREE.AmbientLight(0xffffff, 1.5)
  scene.add(ambient)

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")

  const loader = new GLTFLoader()
  loader.setDRACOLoader(dracoLoader)

  const textureLoader = new THREE.TextureLoader()

  const loadTexture = (path, isColor = false) => {
    const tex = textureLoader.load(path)
    tex.flipY = true
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  const katanaColor = loadTexture('/Katana_and_sheath_M_Katana_BaseColor.1001.jpg', true)
  const katanaNormal = loadTexture('/Katana_and_sheath_M_Katana_Normal.1001.jpg')
  const katanaMetallic = loadTexture('/Katana_and_sheath_M_Katana_Metallic.1001.jpg')
  const katanaRoughness = loadTexture('/Katana_and_sheath_M_Katana_Roughness.1001.jpg')
  const katanaHeight = loadTexture('/Katana_and_sheath_M_Katana_Height.1001.jpg')

  const sheathColor = loadTexture('/Katana_and_sheath_M_Sheath_BaseColor.1001.jpg', true)
  const sheathNormal = loadTexture('/Katana_and_sheath_M_Sheath_Normal.1001.jpg')
  const sheathMetallic = loadTexture('/Katana_and_sheath_M_Sheath_Metallic.1001.jpg')
  const sheathRoughness = loadTexture('/Katana_and_sheath_M_Sheath_Roughness.1001.jpg')
  const sheathHeight = loadTexture('/Katana_and_sheath_M_Sheath_Height.1001.jpg')

  loader.load("/katana2.glb", (gltf) => {
    sword = gltf.scene

    console.log("FULL GLTF:", gltf);
    console.log("SWORD ROOT:", sword);



    sword.traverse((child) => {
      if (child.isMesh) {
        let mat = new THREE.MeshStandardMaterial()

        if (child.name === 'Katana') {
          katanaMesh = child
          mat.map = katanaColor
          mat.normalMap = katanaNormal
          mat.metalnessMap = katanaMetallic
          mat.roughnessMap = katanaRoughness
          mat.displacementMap = katanaHeight
          mat.displacementScale = 0.005
        } else if (child.name === 'Sheath') {
          sheathMesh = child
          mat.map = sheathColor
          mat.normalMap = sheathNormal
          mat.metalnessMap = sheathMetallic
          mat.roughnessMap = sheathRoughness
          mat.displacementMap = sheathHeight
          mat.displacementScale = 0.005
        }

        if (mat.map) {
          mat.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = shaderContext.uTime
            shader.uniforms.uBlackout = shaderContext.uBlackout

            const commonUniforms = `
                #include <common>
                uniform float uTime;
                uniform float uBlackout;
              `

            const fragmentFunctions = `
                float sword_rand(vec2 n) { 
                  return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
                }

                float sword_calcNoise(vec2 p){
                  vec2 ip = floor(p);
                  vec2 u = fract(p);
                  u = u * u * (3.0 - 2.0 * u);
                  
                  float res = mix(
                    mix(sword_rand(ip), sword_rand(ip + vec2(1.0, 0.0)), u.x),
                    mix(sword_rand(ip + vec2(0.0, 1.0)), sword_rand(ip + vec2(1.0, 1.0)), u.x), u.y);
                  return res * res;
                }

                float sword_calcFBM(vec2 p) {
                  float v = 0.0;
                  float a = 0.5;
                  vec2 shift = vec2(100.0);
                  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                  for (int i = 0; i < 5; ++i) {
                    v += a * sword_calcNoise(p);
                    p = rot * p * 2.0 + shift;
                    a *= 0.5;
                  }
                  return v;
                }
              `

            shader.vertexShader = shader.vertexShader.replace('#include <common>', commonUniforms)
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', commonUniforms + "\n" + fragmentFunctions)

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <dithering_fragment>',
              `#include <dithering_fragment>\n${fragmentShader}`
            )

            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>\n${vertexShader}`
            )
          }
        }

        child.material = mat

      }
    })

    const box = new THREE.Box3().setFromObject(sword)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())



    baseScale = 10 / size.length()
    sword.scale.setScalar(baseScale)
    sword.rotation.set(0, 0, 0)

    scene.add(sword)

    sword.scale.set(-baseScale, -baseScale, baseScale)
    sword.position.z -= 2

    const tl = gsap.timeline({ delay: 1.2 })

    tl.to(sword.scale, {
      x: -baseScale,
      y: -baseScale,
      z: baseScale,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.rotation, {
      x: Math.PI / 7,
      z: Math.PI / 7,
      y: Math.PI / 9,
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    tl.to(sword.position, {
      x: "-=1.5",
      z: "+=8",
      y: "-=1.3",
      duration: .5,
      ease: "easeIncubic"
    }, 0)

    if (katanaMesh) {
      tl.to(katanaMesh.position, {
        x: -0.05, // A little in the -x direction
        duration: .5,
        ease: "easeIncubic"
      }, 0)
    }

    tl.to(shaderContext.uBlackout, {
      value: 1.0,
      duration: .5,
      ease: "power3.inOut"
    }, 0)

    // --- Single huge wave pulse ---
    const rippleTl = gsap.timeline({
      delay: 2.7,
      onComplete: () => { canMove = true }
    })

    // Huge wave radius expansion (0 → 1.5 for full screen coverage)
    rippleTl.to(shaderContext.uRippleProgress, {
      value: 1.5,
      duration: .9,
      ease: "power2.out"
    }, 0)

    // Pulse amplitude (0 → 5.0 → 0 to fade it out at the end)
    rippleTl.to(shaderContext.uRippleAmplitude, {
      value: 5.0,
      duration: 0.2,
      ease: "power2.out"
    }, 0)
    rippleTl.to(shaderContext.uRippleAmplitude, {
      value: 0.0,
      duration: .6,
      ease: "power3.in"
    }, 0.3)



    // --- GUI Setup Removed ---
  })

  scrollMsgEl = document.getElementById('scroll-msg')
  window.addEventListener("resize", onResize)
}

function animate() {
  requestAnimationFrame(animate)

  const elapsed = performance.now() * 0.001
  shaderContext.uTime.value = elapsed

  // Update ripple post-processing uniforms
  if (ripplePass) {
    ripplePass.uniforms.uRippleTime.value = elapsed
    ripplePass.uniforms.uRippleAmplitude.value = shaderContext.uRippleAmplitude.value
    ripplePass.uniforms.uRippleFrequency.value = shaderContext.uRippleFrequency.value
    ripplePass.uniforms.uRippleProgress.value = shaderContext.uRippleProgress.value
  }

  // Interactive Mouse Parallax & Scroll Animation
  if (sword && canMove) {
    const baseRotationX = Math.PI / 7
    const baseRotationY = Math.PI / 9
    const baseRotationZ = Math.PI / 7

    // --- Two-stage Scroll Logic (Pinned to original 1.3-page scroll distance) ---
    // We calculate a local progress relative to when total scrolling would have been 130vh (original 230vh height - 100vh).
    const scrollDistPx = window.scrollY
    const originalMaxScroll = window.innerHeight * 1.3
    const modelProgress = Math.min(scrollDistPx / originalMaxScroll, 1.0)

    const returnT = Math.min(modelProgress / 0.15, 1.0)
    const separateT = Math.max(0, (modelProgress - 0.12) / 0.15)

    // --- Text & Model Sync Progress ---
    const scrollDistVh = window.scrollY / window.innerHeight
    const textStartVh = 1.1 // Start slightly later to clear hero section
    const textTotalVh = 5.0 // (600vh - 100vh) / 100vh
    const currentScrollRel = Math.max(0, Math.min((scrollDistVh - textStartVh) / (textTotalVh - textStartVh), 1.0))

    // Smooth the progress with a faster factor (0.15)
    smoothTextProgress += (currentScrollRel - smoothTextProgress) * 0.15
    if (smoothTextProgress < 0.001) smoothTextProgress = 0 // Snap to zero
    const textProgress = smoothTextProgress;

    // Position and Rotation targets
    const scrollScale = 1 - modelProgress * 0.08
    const scrollRotZ = -modelProgress * .03

    const targetRotX = baseRotationX * (1 - returnT) + (mouse.y * 0.2)
    const targetRotY = baseRotationY * (1 - returnT) + (mouse.x * 0.2)
    const targetRotZ = baseRotationZ * (1 - returnT) + scrollRotZ

    const targetPosX = -1.5 * (1 - returnT) + (mouse.x * 0.15)
    const lift = separateT * 0.4
    const targetPosY = -1.3 * (1 - returnT) + lift + (mouse.y * 0.15)
    const targetPosZ = 6 - (8 * returnT)


    if (sword) {
      sword.rotation.x += (targetRotX - sword.rotation.x) * 0.05
      sword.rotation.y += (targetRotY - sword.rotation.y) * 0.05
      sword.rotation.z += (targetRotZ - sword.rotation.z) * 0.05

      sword.position.x += (targetPosX - sword.position.x) * 0.05
      sword.position.y += (targetPosY - sword.position.y) * 0.05
      sword.position.z += (targetPosZ - sword.position.z) * 0.05

      const currentTargetScale = baseScale * scrollScale
      sword.scale.x += (-currentTargetScale - sword.scale.x) * 0.05
      sword.scale.y += (-currentTargetScale - sword.scale.y) * 0.05
      sword.scale.z += (currentTargetScale - sword.scale.z) * 0.05
    }

    if (sheathMesh) {
      // 1. Initial separation (pre-text)
      const sheathIntroProgress = Math.min(scrollDistVh / 0.9, 1.0)
      const introSheathX = sheathIntroProgress * .7
      const introSheathRotZ = sheathIntroProgress * .35 // Slight rotation from the beginning

      // 2. Concentrate phase animation (reaches target faster)
      const concentrateT = Math.max(0, Math.min(textProgress / 0.15, 1.0))
      
      // 3. Pose timing - reaches final pose earlier (by 0.25 progress)
      const posePeakT = Math.max(0, Math.min(textProgress / 0.25, 1.0))
      
      // X-axis only spin that starts AFTER the pose reaches its final target
      const extraSpinX = Math.max(0, textProgress - 0.5) * (Math.PI * 4)

      // Target values - Y accelerates until the "Keep scrolling" section (textProgress = 0.33)
      const targetSheathX = introSheathX * (1 - concentrateT) + (0.1 * concentrateT) // Slightly more in +X
      
      // Stop the Y increase when "Keep scrolling" starts (at textProgress 0.33)
      const textScrollCap = 1.1 + (0.23 * (5.0 - 1.1)) // The scrollDistVh at textProgress 0.33
      const cappedScrollVh = Math.min(scrollDistVh, textScrollCap)
      const targetSheathY = Math.pow(cappedScrollVh, 2.1) * 0.1 
      
      const targetSheathZ = concentrateT * -0.05 // Slightly more in -Z

      // Apply positions with snappier smoothing
      sheathMesh.position.x += (targetSheathX - sheathMesh.position.x) * 0.1
      sheathMesh.position.y += (targetSheathY - sheathMesh.position.y) * 0.1
      sheathMesh.position.z += (targetSheathZ - sheathMesh.position.z) * 0.1

      // Rotations - Continues spinning on X ONLY after settling into the final requested pose
      // Requested Pose: Rot X: 1.88988, Rot Y: 0, Rot Z: 3.08414
      const targetSheathRotX = (posePeakT * 1.88988) + extraSpinX
      const targetSheathRotY = 0
      const targetSheathRotZ = introSheathRotZ + posePeakT * (3.08414 - introSheathRotZ)

      sheathMesh.rotation.x += (targetSheathRotX - sheathMesh.rotation.x) * 0.1
      sheathMesh.rotation.y += (targetSheathRotY - sheathMesh.rotation.y) * 0.1
      sheathMesh.rotation.z += (targetSheathRotZ - sheathMesh.rotation.z) * 0.1
    }

    if (katanaMesh) {
      // Transition to final pose by midpoint of text progress (now faster)
      const katanaPoseT = Math.max(0, Math.min(textProgress / 0.25, 1.0))
      
      // Values from user screenshot
      const targetKatanaX = -0.05 * (1 - katanaPoseT) + (-0.06 * katanaPoseT)
      const targetKatanaY = 0.08 * katanaPoseT
      const targetKatanaZ = -0.18 * katanaPoseT

      katanaMesh.position.x += (targetKatanaX - katanaMesh.position.x) * 0.05
      katanaMesh.position.y += (targetKatanaY - katanaMesh.position.y) * 0.05
      katanaMesh.position.z += (targetKatanaZ - katanaMesh.position.z) * 0.05

      // Rotate katana in +x direction on scroll starting from text section
      const targetKatanaRotX = textProgress * (Math.PI * 4)
      katanaMesh.rotation.x += (targetKatanaRotX - katanaMesh.rotation.x) * 0.05
    }

    // --- Dynamic Center Text Animation ---
    if (scrollMsgEl) {
      function updateScrollText(text) {
        if (scrollMsgEl.getAttribute('data-text') === text) return;
        scrollMsgEl.setAttribute('data-text', text);

        // Split text into 2-character chunks
        let chunks = [];
        for (let i = 0; i < text.length; i += 2) {
          chunks.push(text.substring(i, i + 2));
        }

        scrollMsgEl.innerHTML = chunks.map(chunk => `<span>${chunk}</span>`).join('');
      }

      function animateChars(stageProgress) {
        const spans = scrollMsgEl.querySelectorAll('span');
        const numChunks = spans.length;
        // Stage progress: 0 to 1
        // Entry: 0 to 0.45 (Controlled slow entry)
        // Stay: 0.45 to 0.55 (Brief peak)
        // Exit: 0.55 to 1.0 (Controlled slow exit)

        let containerOpacity = 0;
        let containerScale = 1.0;
        let containerBlur = 0;

        if (stageProgress < 0.45) {
          // Entry: Sequential Char Scaling Down and Fading In
          const t = stageProgress / 0.45;
          containerOpacity = 1;
          containerScale = 1.0;
          containerBlur = 0;

          spans.forEach((span, i) => {
            const start = (i / numChunks) * 0.8;
            const end = start + 0.2;
            let chunkT = 0;
            if (t > start) chunkT = Math.min((t - start) / (end - start), 1.0);

            span.style.opacity = chunkT;
            span.style.filter = `blur(${(1 - chunkT) * 7}px)`;
            span.style.transform = `scale(${2 - chunkT})`;
            span.style.pointerEvents = 'none';
          });
        } else if (stageProgress < 0.55) {
          // Stay (Stable Scale)
          containerOpacity = 1;
          containerScale = 1.0;
          containerBlur = 0;

          spans.forEach(span => {
            span.style.opacity = 1;
            span.style.filter = 'none';
            span.style.transform = 'none';
          });
        } else {
          // Exit: Sequential Char Scaling Up and Fading Out
          const t = (stageProgress - 0.55) / 0.45;
          containerOpacity = 1;
          containerScale = 1.0;
          containerBlur = t * 4;

          spans.forEach((span, i) => {
            const start = (i / numChunks) * 0.8;
            const end = start + 0.2;
            let chunkT = 0;
            if (t > start) chunkT = Math.min((t - start) / (end - start), 1.0);

            span.style.opacity = 1 - chunkT;
            span.style.filter = `blur(${chunkT * 10}px)`;
            span.style.transform = `scale(${1 + chunkT})`;
            span.style.pointerEvents = 'none';
          });
        }

        scrollMsgEl.style.opacity = containerOpacity;
        scrollMsgEl.style.transform = `scale(${containerScale})`;
        scrollMsgEl.style.filter = `blur(${containerBlur}px)`;
      }

      if (textProgress <= 0) {
        scrollMsgEl.style.opacity = 0;
      } else if (textProgress < 0.33) {
        updateScrollText("concentrate");
        animateChars((textProgress - 0.0) / 0.33);
      } else if (textProgress < 0.66) {
        updateScrollText("keep scrolling");
        animateChars((textProgress - 0.33) / 0.33);
      } else if (textProgress <= 1.0) {
        updateScrollText("the spirit awakened");
        animateChars((textProgress - 0.66) / 0.34);
      }
    }
  }

  composer.render()
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)

  if (ripplePass) {
    ripplePass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
  }
}
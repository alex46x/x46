import * as THREE from 'three';

/**
 * Pure Three.js WebGL Spatial Engine
 * Handles full-screen portrait shader plane, circular blurred snow particles
 * with mouse aerodynamics/repulsion, dynamic studio lighting, and smooth audio choreography.
 */
export class BackgroundScene {
  constructor(canvasId = 'webgl-canvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.portraitMesh = null;
    this.portraitMaterial = null;
    
    // Snow Particle System
    this.particleSystem = null;
    this.particleMaterial = null;
    this.particlePositions = null;
    this.particleVelocities = null;
    this.snowData = null;

    this.cursorLight = null;

    this.mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      speedX: 0,
      speedY: 0
    };

    this.currentStep = 0;
    this.isFormMode = false;
    this.isAudioActive = false;
    this.soundPulse = 0;

    this.cameraDistance = 10;
    this.targetCameraZ = 10;
    this.targetCameraY = 0;

    this.startTime = performance.now();
    this.init();
  }

  init() {
    // 1. Scene setup with studio neutral tone #96989C
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x96989c);

    // 2. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, this.cameraDistance);

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // 4. Studio Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(5, 8, 8);
    this.scene.add(keyLight);

    // Soft interactive cursor light in 3D space
    this.cursorLight = new THREE.PointLight(0xffffff, 0.8, 18);
    this.cursorLight.position.set(0, 0, 4);
    this.scene.add(this.cursorLight);

    // 5. Build Fullscreen WebGL Portrait Plane (100% Static & Sharp)
    this.createPortraitMesh();

    // 6. Build Circular Blurred Interactive Snow Particle Field
    this.createParticleField();

    // 7. Event listeners
    window.addEventListener('resize', this.onResize.bind(this));
    window.addEventListener('pointermove', this.onPointerMoveEvent.bind(this), { passive: true });

    // 8. Start 60fps render loop
    this.animate();
  }

  createPortraitMesh() {
    const loader = new THREE.TextureLoader();
    loader.load('./portrait.png', (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      const imgWidth = texture.image ? texture.image.width : 1920;
      const imgHeight = texture.image ? texture.image.height : 1080;

      // WebGL Shader Material with GPU cover-fit, film grain, and subtle vignette
      this.portraitMaterial = new THREE.ShaderMaterial({
        uniforms: {
          u_texture: { value: texture },
          u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          u_imageResolution: { value: new THREE.Vector2(imgWidth, imgHeight) },
          u_time: { value: 0 },
          u_grainIntensity: { value: 0.024 },
          u_audioActive: { value: 0.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D u_texture;
          uniform vec2 u_resolution;
          uniform vec2 u_imageResolution;
          uniform float u_time;
          uniform float u_grainIntensity;
          uniform float u_audioActive;
          varying vec2 vUv;

          // Pseudo-random noise for subtle high-end studio film grain
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
          }

          void main() {
            vec2 s = u_resolution;
            vec2 i = u_imageResolution;
            float rs = s.x / s.y;
            float ri = i.x / i.y;
            vec2 uv = vUv;

            // GPU object-fit: cover math
            if (rs > ri) {
              uv = vec2(vUv.x, (vUv.y - 0.5) * (ri / rs) + 0.5);
            } else {
              uv = vec2((vUv.x - 0.5) * (rs / ri) + 0.5, vUv.y);
            }

            vec4 color = texture2D(u_texture, uv);

            // Subtle film grain
            float grain = (random(vUv + fract(u_time * 0.5)) - 0.5) * u_grainIntensity;
            color.rgb += grain;

            // Studio radial vignette to blend edges softly into #96989C
            vec2 centerDist = (vUv - 0.5) * 1.6;
            float vignette = clamp(1.0 - dot(centerDist, centerDist) * 0.35, 0.0, 1.0);
            color.rgb *= vignette;

            gl_FragColor = color;
          }
        `,
        depthWrite: false,
        depthTest: false
      });

      this.updatePortraitGeometry();
    });
  }

  updatePortraitGeometry() {
    if (!this.camera || !this.portraitMaterial) return;

    // Calculate exact frustum coverage at z = 0
    const vFov = (this.camera.fov * Math.PI) / 180;
    const planeHeight = 2 * Math.tan(vFov / 2) * this.cameraDistance;
    const planeWidth = planeHeight * this.camera.aspect;

    if (this.portraitMesh) {
      this.scene.remove(this.portraitMesh);
      if (this.portraitMesh.geometry) this.portraitMesh.geometry.dispose();
    }

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    this.portraitMesh = new THREE.Mesh(geometry, this.portraitMaterial);
    this.portraitMesh.position.set(0, 0, 0);
    this.scene.add(this.portraitMesh);
  }

  /**
   * Create Circular, Blurred Snow Particles with Depth and Aerodynamics
   */
  createParticleField() {
    const count = 220; // Elegant snow density
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const snowData = [];

    // Requested Studio Palette: #565759, #A0A1A4, #343539
    const palette = [
      new THREE.Color('#565759'),
      new THREE.Color('#A0A1A4'),
      new THREE.Color('#343539')
    ];

    for (let i = 0; i < count; i++) {
      // 3D frustum space in front of portrait
      const x = (Math.random() - 0.5) * 24;
      const y = (Math.random() - 0.5) * 17;
      const z = Math.random() * 5.2 + 1.2; // 1.2 to 6.4 depth range

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;

      // Assign palette color
      const chosenColor = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = chosenColor.r;
      colors[i * 3 + 1] = chosenColor.g;
      colors[i * 3 + 2] = chosenColor.b;

      // Realistic snow variety: delicate background flakes + large dreamy bokeh foreground flakes
      const isBokeh = Math.random() < 0.16;
      sizes[i] = isBokeh
        ? Math.random() * 0.40 + 0.30  // Large soft bokeh flakes
        : Math.random() * 0.20 + 0.10; // Fine falling snowflakes

      // Soft translucency
      alphas[i] = isBokeh
        ? Math.random() * 0.40 + 0.30  // Softer large bokeh
        : Math.random() * 0.55 + 0.45; // Crisp falling flakes

      // Slower, graceful floating snowfall speed
      snowData.push({
        speed: Math.random() * 0.005 + 0.0025, // Reduced speed
        swaySpeed: Math.random() * 1.0 + 0.5,
        swayAmp: Math.random() * 0.008 + 0.003,
        swayOffset: Math.random() * Math.PI * 2
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    this.particlePositions = positions;
    this.particleVelocities = velocities;
    this.snowData = snowData;

    // Custom ShaderMaterial: 100% CIRCULAR with Gaussian-style soft blur edges and custom palette
    const snowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_opacityFactor: { value: 1.0 }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          // Perspective sizing: closer flakes appear larger & softer like real snow bokeh
          gl_PointSize = aSize * (360.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float u_opacityFactor;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          // Circular discard: Eliminates all square edges!
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          // Smooth Gaussian-like radial blur falloff for pure snow look
          float softCircle = smoothstep(0.5, 0.05, dist);
          float coreGlow = smoothstep(0.24, 0.0, dist) * 0.45;
          float alpha = (softCircle + coreGlow) * vAlpha * u_opacityFactor;

          // Render with specific palette color
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.particleMaterial = snowMaterial;
    this.particleSystem = new THREE.Points(geometry, snowMaterial);
    this.scene.add(this.particleSystem);
  }

  onPointerMoveEvent(e) {
    // Normalized mouse (-1 to +1)
    const newTargetX = (e.clientX / window.innerWidth) * 2 - 1;
    const newTargetY = -(e.clientY / window.innerHeight) * 2 + 1;

    // Track mouse velocity for wind impulse
    this.mouse.speedX = newTargetX - this.mouse.targetX;
    this.mouse.speedY = newTargetY - this.mouse.targetY;

    this.mouse.targetX = newTargetX;
    this.mouse.targetY = newTargetY;
  }

  /**
   * Set active dialogue step (0, 1, 2)
   */
  setStep(stepIndex) {
    this.currentStep = stepIndex;
    if (this.particleMaterial && this.particleMaterial.uniforms.u_opacityFactor) {
      const factors = [1.0, 1.15, 0.95];
      this.particleMaterial.uniforms.u_opacityFactor.value = factors[stepIndex] || 1.0;
    }
  }

  /**
   * Set contact form focus mode
   */
  setFormMode(active) {
    this.isFormMode = active;
    if (this.particleMaterial && this.particleMaterial.uniforms.u_opacityFactor) {
      this.particleMaterial.uniforms.u_opacityFactor.value = active ? 0.60 : 1.0;
    }
  }

  /**
   * Set audio playback state
   */
  setAudioActive(active) {
    this.isAudioActive = active;
    if (this.portraitMaterial && this.portraitMaterial.uniforms.u_audioActive) {
      this.portraitMaterial.uniforms.u_audioActive.value = active ? 1.0 : 0.0;
    }
  }

  /**
   * Reset scene state
   */
  reset() {
    this.setStep(0);
    this.setFormMode(false);
  }

  onResize() {
    if (!this.renderer || !this.camera) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (this.portraitMaterial && this.portraitMaterial.uniforms.u_resolution) {
      this.portraitMaterial.uniforms.u_resolution.value.set(width, height);
    }

    if (this.portraitMaterial) {
      this.updatePortraitGeometry();
    }
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const time = (performance.now() - this.startTime) * 0.001;

    // 1. Smooth mouse lerp
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.06;

    // Dampen mouse velocity
    this.mouse.speedX *= 0.85;
    this.mouse.speedY *= 0.85;

    // 2. Cursor PointLight tracks mouse in 3D coordinates
    if (this.cursorLight) {
      this.cursorLight.position.x = this.mouse.x * 6;
      this.cursorLight.position.y = this.mouse.y * 4;
      this.cursorLight.position.z = 4.5 + Math.sin(time) * 0.3;
    }

    // 3. Audio pulse simulation
    if (this.isAudioActive) {
      this.soundPulse = Math.sin(time * 3.5) * 0.06;
    } else {
      this.soundPulse += (0 - this.soundPulse) * 0.08;
    }

    // 4. Update portrait shader uniforms
    if (this.portraitMaterial && this.portraitMaterial.uniforms.u_time) {
      this.portraitMaterial.uniforms.u_time.value = time;
    }

    // 5. Interactive Snow Dynamics & Mouse Repulsion Physics
    if (this.particleSystem && this.particlePositions && this.snowData) {
      const positions = this.particlePositions;
      const vels = this.particleVelocities;
      const count = this.snowData.length;

      // Mouse world coordinates at snow depth
      const aspect = this.camera ? this.camera.aspect : window.innerWidth / window.innerHeight;
      const mouseWorldX = this.mouse.x * (aspect * 5.6);
      const mouseWorldY = this.mouse.y * 4.2;
      const repulsionRadiusSq = 3.4 * 3.4;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const data = this.snowData[i];

        // A. Gentle downward gravity snowfall
        positions[i3 + 1] -= data.speed;

        // B. Natural horizontal wind sway
        positions[i3] += Math.sin(time * data.swaySpeed + data.swayOffset) * data.swayAmp;

        // C. Mouse Interaction: Aerodynamic repulsion & wind displacement
        const dx = positions[i3] - mouseWorldX;
        const dy = positions[i3 + 1] - mouseWorldY;
        const distSq = dx * dx + dy * dy;

        if (distSq < repulsionRadiusSq && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const force = (1.0 - dist / 3.4) * 0.055;
          vels[i3] += (dx / dist) * force + this.mouse.speedX * 0.08;
          vels[i3 + 1] += (dy / dist) * force + this.mouse.speedY * 0.08;
        }

        // Apply impulse velocities with friction/damping
        positions[i3] += vels[i3];
        positions[i3 + 1] += vels[i3 + 1];
        vels[i3] *= 0.92;
        vels[i3 + 1] *= 0.92;

        // D. Audio rhythm response (gentle levitation/twinkle when music is on)
        if (this.isAudioActive) {
          positions[i3 + 1] += Math.sin(time * 3.0 + i) * 0.006;
        }

        // E. Seamless wrapping (continuous snowfall)
        if (positions[i3 + 1] < -8.5) {
          positions[i3 + 1] = 8.5;
          positions[i3] = (Math.random() - 0.5) * 24;
          vels[i3] = 0;
          vels[i3 + 1] = 0;
        }
        if (positions[i3] < -14) positions[i3] = 14;
        if (positions[i3] > 14) positions[i3] = -14;
      }

      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // 6. Render WebGL Scene
    this.renderer.render(this.scene, this.camera);
  }
}

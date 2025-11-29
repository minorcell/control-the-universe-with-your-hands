import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { HandPosition } from '../types';

interface BlackHoleProps {
  handPosition: HandPosition;
}

const BlackHole: React.FC<BlackHoleProps> = ({ handPosition }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const timeRef = useRef<number>(0);
  
  // Camera smooth dampening
  const targetCameraPos = useRef({ x: 0, y: 10, z: 30 });
  const currentCameraPos = useRef({ x: 0, y: 10, z: 30 });
  
  // Smoothing Logic
  const smoothedHandRef = useRef({ x: 0, y: 0 });
  const lastDetectionTimeRef = useRef(0);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0008); 
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 10, 30);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Create Black Hole Objects
    
    // A. Event Horizon
    const sphereGeo = new THREE.SphereGeometry(3.5, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // A2. Accretion Disk Glow
    const innerRingGeo = new THREE.RingGeometry(3.6, 5, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00, 
        side: THREE.DoubleSide, 
        transparent: true, 
        opacity: 0.1,
        blending: THREE.AdditiveBlending
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    scene.add(innerRing);

    // B. Accretion Disk (Particles)
    const particleCount = 40000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const colorCore = new THREE.Color(0xffffff);
    const colorInner = new THREE.Color(0xffd700); 
    const colorMid = new THREE.Color(0xff4500);   
    const colorOuter = new THREE.Color(0x8a0303); 

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4.5 + Math.pow(Math.random(), 1.5) * 20; 
      const verticalSpread = Math.max(0.1, (r - 4) * 0.05);
      const spreadY = (Math.random() - 0.5) * verticalSpread; 

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = spreadY;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const distRatio = (r - 4.5) / 20;
      let particleColor = colorCore.clone();

      if (distRatio < 0.1) {
          particleColor.lerp(colorInner, distRatio * 10);
      } else if (distRatio < 0.5) {
          particleColor = colorInner.clone().lerp(colorMid, (distRatio - 0.1) * 2.5);
      } else {
          particleColor = colorMid.clone().lerp(colorOuter, (distRatio - 0.5) * 2);
      }

      colors[i * 3] = particleColor.r;
      colors[i * 3 + 1] = particleColor.g;
      colors[i * 3 + 2] = particleColor.b;

      sizes[i] = Math.random() * 0.15 + 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);

      if (!particlesRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      timeRef.current += 0.005;
      
      // Rotate disk
      particlesRef.current.rotation.y = -timeRef.current * 0.5;

      // --- LOGIC START ---
      
      // 1. Determine State (Active vs Idle) with Debounce
      const now = Date.now();
      if (handPosition.detected) {
        lastDetectionTimeRef.current = now;
        isInteractingRef.current = true;
      } else if (now - lastDetectionTimeRef.current > 1500) {
        // Only go to idle if hand lost for 1.5 seconds
        isInteractingRef.current = false;
      }

      // 2. Input Smoothing with Deadzone
      if (handPosition.detected) {
        // Calculate difference
        const dx = handPosition.x - smoothedHandRef.current.x;
        const dy = handPosition.y - smoothedHandRef.current.y;
        
        // Deadzone: if change is very small, ignore it to prevent jitter when holding still
        const threshold = 0.02; // 2% movement required
        
        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
           // Smooth lerp: slower factor = smoother movement
           const lerpFactor = 0.05; 
           smoothedHandRef.current.x += dx * lerpFactor;
           smoothedHandRef.current.y += dy * lerpFactor;
        }
      }

      // 3. Calculate Target Position
      if (isInteractingRef.current) {
        // Active Control
        const azimuth = smoothedHandRef.current.x * Math.PI * 1.2; 
        const polar = (Math.PI / 2.5) + (-smoothedHandRef.current.y * Math.PI / 3.5); 
        
        // Reduced radius variation to prevent zoom jitter
        const radius = 30; // Fixed radius is more stable than dynamic radius based on X

        targetCameraPos.current.x = radius * Math.sin(polar) * Math.sin(azimuth);
        targetCameraPos.current.y = radius * Math.cos(polar);
        targetCameraPos.current.z = radius * Math.sin(polar) * Math.cos(azimuth);
      } else {
        // Idle Animation
        const idleTime = timeRef.current * 0.2;
        targetCameraPos.current.x = Math.sin(idleTime) * 35;
        targetCameraPos.current.y = 10 + Math.sin(idleTime * 0.5) * 5;
        targetCameraPos.current.z = Math.cos(idleTime) * 35;
      }

      // 4. Apply to Camera (Final Layer of Smoothing)
      const cameraDamping = 0.03; // Very smooth catch-up
      currentCameraPos.current.x += (targetCameraPos.current.x - currentCameraPos.current.x) * cameraDamping;
      currentCameraPos.current.y += (targetCameraPos.current.y - currentCameraPos.current.y) * cameraDamping;
      currentCameraPos.current.z += (targetCameraPos.current.z - currentCameraPos.current.z) * cameraDamping;

      cameraRef.current.position.set(
          currentCameraPos.current.x, 
          currentCameraPos.current.y, 
          currentCameraPos.current.z
      );
      cameraRef.current.lookAt(0, 0, 0);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      material.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
    };
  }, [handPosition.detected]); // We rely on ref for coordinates, so only re-bind on detection change is rare but safe.

  // Updates ref constantly without re-triggering effect
  useEffect(() => {
    // We already read directly from handPosition inside the loop? 
    // Actually no, the effect captures the initial handPosition closure if not in dependency array.
    // BUT we are passing handPosition as prop. 
    // To access fresh props in requestAnimationFrame without re-running the heavy effect, 
    // we should use a ref to store the latest handPosition.
  }, [handPosition]);

  // Fix: Use a ref to track the latest prop value to avoid stale closure in the animation loop
  // The previous implementation might have had stale closures if the effect didn't re-run.
  // However, re-running the ThreeJS setup is expensive.
  // The best pattern is:
  const latestHandPos = useRef(handPosition);
  useEffect(() => {
      latestHandPos.current = handPosition;
  }, [handPosition]);

  // We need to patch the loop to use latestHandPos.current instead of handPosition
  // Let's rewrite the loop logic in the previous useEffect slightly:
  // Since I cannot edit the previous useEffect block easily in this XML format without duplicating the whole file content,
  // I will assume the previous content block REPLACED the file content.
  // I will include the corrected Ref usage in the full file content below.

  return <div ref={mountRef} className="fixed top-0 left-0 w-full h-full z-0" />;
};

// Re-paste the Full Corrected BlackHole Component with Ref fix
const BlackHoleCorrected: React.FC<BlackHoleProps> = ({ handPosition }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const timeRef = useRef<number>(0);
  
  // Track latest props in ref to access in animation loop
  const handPosRef = useRef(handPosition);
  useEffect(() => { handPosRef.current = handPosition; }, [handPosition]);

  const targetCameraPos = useRef({ x: 0, y: 10, z: 30 });
  const currentCameraPos = useRef({ x: 0, y: 10, z: 30 });
  
  const smoothedHandRef = useRef({ x: 0, y: 0 });
  const lastDetectionTimeRef = useRef(0);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0008); 
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 10, 30);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const sphereGeo = new THREE.SphereGeometry(3.5, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    const innerRingGeo = new THREE.RingGeometry(3.6, 5, 64);
    const innerRingMat = new THREE.MeshBasicMaterial({ 
        color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    scene.add(innerRing);

    const particleCount = 40000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    const colorCore = new THREE.Color(0xffffff);
    const colorInner = new THREE.Color(0xffd700); 
    const colorMid = new THREE.Color(0xff4500);   
    const colorOuter = new THREE.Color(0x8a0303); 

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 4.5 + Math.pow(Math.random(), 1.5) * 20; 
      const verticalSpread = Math.max(0.1, (r - 4) * 0.05);
      const spreadY = (Math.random() - 0.5) * verticalSpread; 

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = spreadY;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const distRatio = (r - 4.5) / 20;
      let particleColor = colorCore.clone();
      if (distRatio < 0.1) particleColor.lerp(colorInner, distRatio * 10);
      else if (distRatio < 0.5) particleColor = colorInner.clone().lerp(colorMid, (distRatio - 0.1) * 2.5);
      else particleColor = colorMid.clone().lerp(colorOuter, (distRatio - 0.5) * 2);

      colors[i * 3] = particleColor.r;
      colors[i * 3 + 1] = particleColor.g;
      colors[i * 3 + 2] = particleColor.b;
      sizes[i] = Math.random() * 0.15 + 0.05;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const material = new THREE.PointsMaterial({
      size: 0.15, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      requestAnimationFrame(animate);
      if (!particlesRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      timeRef.current += 0.005;
      particlesRef.current.rotation.y = -timeRef.current * 0.5;

      const currentHand = handPosRef.current; // Access latest from Ref
      const now = Date.now();

      // State Logic
      if (currentHand.detected) {
        lastDetectionTimeRef.current = now;
        isInteractingRef.current = true;
      } else if (now - lastDetectionTimeRef.current > 1000) {
        isInteractingRef.current = false;
      }

      // Input Smoothing
      if (currentHand.detected) {
        const dx = currentHand.x - smoothedHandRef.current.x;
        const dy = currentHand.y - smoothedHandRef.current.y;
        
        // Deadzone: 1.5%
        if (Math.abs(dx) > 0.015 || Math.abs(dy) > 0.015) {
           smoothedHandRef.current.x += dx * 0.05; // Smooth factor
           smoothedHandRef.current.y += dy * 0.05;
        }
      }

      // Target Logic
      if (isInteractingRef.current) {
        const azimuth = smoothedHandRef.current.x * Math.PI * 1.2; 
        const polar = (Math.PI / 2.5) + (-smoothedHandRef.current.y * Math.PI / 3.5); 
        const radius = 30; // Fixed radius for stability

        targetCameraPos.current.x = radius * Math.sin(polar) * Math.sin(azimuth);
        targetCameraPos.current.y = radius * Math.cos(polar);
        targetCameraPos.current.z = radius * Math.sin(polar) * Math.cos(azimuth);
      } else {
        const idleTime = timeRef.current * 0.2;
        targetCameraPos.current.x = Math.sin(idleTime) * 35;
        targetCameraPos.current.y = 10 + Math.sin(idleTime * 0.5) * 5;
        targetCameraPos.current.z = Math.cos(idleTime) * 35;
      }

      // Camera Damping
      const damping = 0.02; // Very slow catchup
      currentCameraPos.current.x += (targetCameraPos.current.x - currentCameraPos.current.x) * damping;
      currentCameraPos.current.y += (targetCameraPos.current.y - currentCameraPos.current.y) * damping;
      currentCameraPos.current.z += (targetCameraPos.current.z - currentCameraPos.current.z) * damping;

      cameraRef.current.position.set(currentCameraPos.current.x, currentCameraPos.current.y, currentCameraPos.current.z);
      cameraRef.current.lookAt(0, 0, 0);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) mountRef.current.removeChild(rendererRef.current.domElement);
      geometry.dispose(); material.dispose(); sphereGeo.dispose(); sphereMat.dispose(); innerRingGeo.dispose(); innerRingMat.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed top-0 left-0 w-full h-full z-0" />;
};

export default BlackHoleCorrected;

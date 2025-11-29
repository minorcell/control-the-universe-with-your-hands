import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { HandPosition } from '../types';

interface BlackHoleProps {
  handPosition: HandPosition;
}

// 常量控制相机与黑洞尺度
const CAMERA_START = { x: 0, y: 2.5, z: 26.4 };
const CAMERA_IDLE_RADIUS = 21.6;
const CAMERA_ACTIVE_RADIUS = 26.4;
const BH_RADIUS = 1.0;
const DISK_INNER = 2.2;
const DISK_OUTER = 14.0;
const RADIUS_MIN = 12.0; // 手很近时相机的最近距离
const RADIUS_MAX = 48.0; // 手很远时相机的最远距离

const BlackHole: React.FC<BlackHoleProps> = ({ handPosition }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);

  const handPosRef = useRef(handPosition);
  useEffect(() => {
    handPosRef.current = handPosition;
  }, [handPosition]);

  const targetCameraPos = useRef({ ...CAMERA_START });
  const currentCameraPos = useRef({ ...CAMERA_START });
  const smoothedHandRef = useRef({ x: 0, y: 0 });
  const smoothedProximityRef = useRef(0.4);
  const lastDetectionTimeRef = useRef(0);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(CAMERA_START.x, CAMERA_START.y, CAMERA_START.z);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 cameraPos;
      uniform vec3 cameraDir;
      uniform vec3 cameraUp;
      uniform float uBhRadius;
      uniform float uDiskInner;
      uniform float uDiskOuter;
      varying vec2 vUv;

      float hash(float n) { return fract(sin(n) * 43758.5453123); }

      float noise(vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        float n = p.x + p.y * 57.0 + p.z * 113.0;
        return mix(mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                       mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
                   mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                       mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

        vec3 camForward = normalize(cameraDir);
        vec3 camRight = normalize(cross(camForward, cameraUp));
        vec3 camUp = cross(camRight, camForward);

        vec3 ro = cameraPos;
        vec3 rd = normalize(uv.x * camRight + uv.y * camUp + 1.5 * camForward);

        vec3 col = vec3(0.0);
        vec3 acc = vec3(0.0);

        float t = 0.0;
        vec3 p = ro;

        for (int i = 0; i < 180; i++) {
          p = ro + rd * t;
          float dist = length(p);

          float gravity = 0.05 / (dist * dist + 0.1);
          vec3 toCenter = normalize(-p);
          rd = normalize(rd + toCenter * gravity);

          if (dist < uBhRadius) {
            col = vec3(0.0);
            break;
          }

          float distToPlane = abs(p.y);

          if (distToPlane < 0.25 && dist > uDiskInner && dist < uDiskOuter) {
            float r = dist;
            float a = atan(p.z, p.x);
            float angle = a + iTime * (1.5 / r);

            float f = noise(vec3(r * 2.0, angle * 4.0, iTime * 0.5));
            f += noise(vec3(r * 4.0, angle * 8.0, 0.0)) * 0.5;
            f = pow(f, 3.0);

            vec3 diskColor = mix(vec3(1.0, 0.3, 0.0), vec3(1.0, 0.9, 0.6), 1.0 / (r - uDiskInner + 0.5));
            float alpha = exp(-distToPlane * distToPlane * 48.0) * (1.0 - smoothstep(uDiskOuter - 1.2, uDiskOuter, r));

            acc += diskColor * f * alpha * 0.1;
          }

          float stepSize = clamp(dist * 0.08, 0.02, 0.5);
          t += stepSize;

          if (dist > 40.0) break;
        }

        // 背景深空（密集星点 + 偶发大星 + 微弱银河雾）
        if (length(col) == 0.0 && length(acc) < 0.8) {
          vec3 starDir = rd;

          // 小星点密度 + 色散（冷蓝、暖黄、淡紫随机混合）
          float sn = noise(starDir * 140.0);
          float tiny = smoothstep(0.92, 1.0, sn) * 0.45;
          float huePick = fract(sn * 53.17);
          vec3 cold = vec3(0.8, 0.9, 1.1);
          vec3 warm = vec3(1.05, 0.9, 0.7);
          vec3 mag  = vec3(1.05, 0.85, 1.1);
          vec3 starTint = mix(cold, warm, smoothstep(0.3, 0.7, huePick));
          starTint = mix(starTint, mag, smoothstep(0.78, 0.95, huePick));
          col += starTint * tiny;

          // 偶发亮星（颜色更显著）
          float big = noise(starDir * 45.0 + 12.3);
          if (big > 0.965) {
            float glow = pow((big - 0.965) / 0.035, 2.0);
            vec3 warm = vec3(1.2, 0.9, 0.6);
            vec3 cool = vec3(0.8, 0.9, 1.2);
            vec3 magBright = vec3(1.1, 0.85, 1.2);
            float pick = fract(big * 37.0);
            vec3 tint = mix(cool, warm, pick);
            tint = mix(tint, magBright, smoothstep(0.82, 0.98, pick));
            col += tint * glow * 2.2;
          }

          // 少量拉丝/彗尾
          float streak = noise(vec3(starDir.xy * 60.0, iTime * 0.08));
          if (streak > 0.988) {
            float g = (streak - 0.988) * 60.0;
            col += vec3(1.1, 1.0, 0.9) * g;
          }

          // 微弱银河雾（低频淡带，不喧宾夺主）
          vec3 bandDir = normalize(vec3(0.18, 0.05, 1.0));
          float band = dot(starDir, bandDir);
          float bandWidth = 0.28;
          float milkyMask = exp(-pow(band / bandWidth, 2.0) * 2.8);
          float mwNoise = noise(starDir * 18.0 + iTime * 0.015);
          vec3 mwColor = mix(vec3(0.65, 0.75, 1.05), vec3(1.05, 0.9, 0.78), mwNoise);
          col += mwColor * milkyMask * 0.18;
        }

        col += acc;
        col = vec3(1.0) - exp(-col * 1.5);
        col = pow(col, vec3(0.4545));

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        cameraPos: { value: new THREE.Vector3() },
        cameraDir: { value: new THREE.Vector3() },
        cameraUp: { value: new THREE.Vector3(0, 1, 0) },
        uBhRadius: { value: BH_RADIUS },
        uDiskInner: { value: DISK_INNER },
        uDiskOuter: { value: DISK_OUTER }
      },
      side: THREE.BackSide
    });
    materialRef.current = material;

    const geometry = new THREE.BoxGeometry(100, 100, 100);
    const skybox = new THREE.Mesh(geometry, material);
    scene.add(skybox);

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && materialRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        materialRef.current.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    clockRef.current = new THREE.Clock();
    const cameraDirection = new THREE.Vector3();

    const animate = () => {
      requestAnimationFrame(animate);
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !materialRef.current) return;

      const elapsed = clockRef.current ? clockRef.current.getElapsedTime() : 0;
      materialRef.current.uniforms.iTime.value = elapsed;

      const currentHand = handPosRef.current;
      const now = Date.now();
      if (currentHand.detected) {
        lastDetectionTimeRef.current = now;
        isInteractingRef.current = true;
      } else if (now - lastDetectionTimeRef.current > 1500) {
        isInteractingRef.current = false;
      }

      if (currentHand.detected) {
        const dx = currentHand.x - smoothedHandRef.current.x;
        const dy = currentHand.y - smoothedHandRef.current.y;
        smoothedHandRef.current.x += dx * 0.05;
        smoothedHandRef.current.y += dy * 0.05;

        if (typeof currentHand.proximity === 'number') {
          const dProx = currentHand.proximity - smoothedProximityRef.current;
          smoothedProximityRef.current += dProx * 0.12;
        }
      }

      if (isInteractingRef.current) {
        const prox = THREE.MathUtils.clamp(smoothedProximityRef.current, 0, 1);
        const yaw = THREE.MathUtils.clamp(smoothedHandRef.current.x * 0.9, -1.2, 1.2);
        const polarOffset = THREE.MathUtils.clamp(-smoothedHandRef.current.y * 0.45, -0.7, 0.7);
        const polarBase = Math.PI / 2; // 水平视角
        const polar = THREE.MathUtils.clamp(polarBase + polarOffset, 0.35, 2.4);
        const radius = THREE.MathUtils.lerp(RADIUS_MAX, RADIUS_MIN, prox);

        targetCameraPos.current.x = radius * Math.sin(polar) * Math.sin(yaw);
        targetCameraPos.current.y = radius * Math.cos(polar);
        targetCameraPos.current.z = radius * Math.sin(polar) * Math.cos(yaw);
      } else {
        const idleTime = elapsed * 0.05;
        targetCameraPos.current.x = CAMERA_START.x + Math.sin(idleTime) * 1.5;
        targetCameraPos.current.y = CAMERA_START.y + Math.sin(idleTime * 0.7) * 0.6;
        targetCameraPos.current.z = CAMERA_START.z + Math.cos(idleTime) * 1.5;
      }

      const damping = 0.03;
      currentCameraPos.current.x += (targetCameraPos.current.x - currentCameraPos.current.x) * damping;
      currentCameraPos.current.y += (targetCameraPos.current.y - currentCameraPos.current.y) * damping;
      currentCameraPos.current.z += (targetCameraPos.current.z - currentCameraPos.current.z) * damping;

      cameraRef.current.position.set(
        currentCameraPos.current.x,
        currentCameraPos.current.y,
        currentCameraPos.current.z
      );
      cameraRef.current.lookAt(0, 0, 0);

      cameraRef.current.getWorldDirection(cameraDirection);
      materialRef.current.uniforms.cameraPos.value.copy(cameraRef.current.position);
      materialRef.current.uniforms.cameraDir.value.copy(cameraDirection);
      materialRef.current.uniforms.cameraUp.value.copy(cameraRef.current.up);

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      geometry.dispose();
      if (materialRef.current) materialRef.current.dispose();
      if (rendererRef.current) rendererRef.current.dispose();
    };
  }, []);

  return <div ref={mountRef} className="fixed top-0 left-0 w-full h-full z-0" />;
};

export default BlackHole;

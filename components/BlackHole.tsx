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
  
  // 相机平滑阻尼
  const targetCameraPos = useRef({ x: 0, y: 10, z: 30 });
  const currentCameraPos = useRef({ x: 0, y: 10, z: 30 });

  // 平滑逻辑
  const smoothedHandRef = useRef({ x: 0, y: 0 });
  const lastDetectionTimeRef = useRef(0);
  const isInteractingRef = useRef(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. 设置场景
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.0008);
    sceneRef.current = scene;

    // 2. 相机
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 10, 30);
    cameraRef.current = camera;

    // 3. 渲染器
    const renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. 创建黑洞对象

    // A. 事件视界
    const sphereGeo = new THREE.SphereGeometry(3.5, 64, 64);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // A2. 吸积盘辉光
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

    // B. 吸积盘（粒子）
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

    // 调整大小
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // 动画
    const animate = () => {
      requestAnimationFrame(animate);

      if (!particlesRef.current || !sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      timeRef.current += 0.005;

      // 旋转圆盘
      particlesRef.current.rotation.y = -timeRef.current * 0.5;

      // --- 逻辑开始 ---

      // 1. 确定状态（活跃vs空闲）带防抖
      const now = Date.now();
      if (handPosition.detected) {
        lastDetectionTimeRef.current = now;
        isInteractingRef.current = true;
      } else if (now - lastDetectionTimeRef.current > 1500) {
        // 只有当手部丢失1.5秒后才进入空闲状态
        isInteractingRef.current = false;
      }

      // 2. 带死区的输入平滑
      if (handPosition.detected) {
        // 计算差值
        const dx = handPosition.x - smoothedHandRef.current.x;
        const dy = handPosition.y - smoothedHandRef.current.y;

        // 死区：如果变化非常小，忽略以防止静止时抖动
        const threshold = 0.02; // 需要2%的移动

        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
           // 平滑lerp：因子越慢 = 移动越平滑
           const lerpFactor = 0.05;
           smoothedHandRef.current.x += dx * lerpFactor;
           smoothedHandRef.current.y += dy * lerpFactor;
        }
      }

      // 3. 计算目标位置
      if (isInteractingRef.current) {
        // 主动控制
        const azimuth = smoothedHandRef.current.x * Math.PI * 1.2;
        const polar = (Math.PI / 2.5) + (-smoothedHandRef.current.y * Math.PI / 3.5);

        // 减少半径变化以防止缩放抖动
        const radius = 30; // 固定半径比基于X的动态半径更稳定

        targetCameraPos.current.x = radius * Math.sin(polar) * Math.sin(azimuth);
        targetCameraPos.current.y = radius * Math.cos(polar);
        targetCameraPos.current.z = radius * Math.sin(polar) * Math.cos(azimuth);
      } else {
        // 空闲动画
        const idleTime = timeRef.current * 0.2;
        targetCameraPos.current.x = Math.sin(idleTime) * 35;
        targetCameraPos.current.y = 10 + Math.sin(idleTime * 0.5) * 5;
        targetCameraPos.current.z = Math.cos(idleTime) * 35;
      }

      // 4. 应用到相机（最后一层平滑）
      const cameraDamping = 0.03; // 非常平滑的跟进
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
  }, [handPosition.detected]); // 我们依赖ref进行坐标，因此在检测变化时重新绑定是罕见但安全的。

  // 持续更新ref而不重新触发effect
  useEffect(() => {
    // 我们是否已经在循环中直接从handPosition读取？
    // 实际上不是，如果不在依赖数组中，effect会捕获初始的handPosition闭包。
    // 但是我们正在将handPosition作为props传递。
    // 为了在requestAnimationFrame中访问最新的props而不重新运行开销大的effect，
    // 我们应该使用ref来存储最新的handPosition。
  }, [handPosition]);

  // 修复：使用ref跟踪最新的prop值以避免动画循环中的过时闭包
  // 之前的实现如果effect没有重新运行可能会有过时的闭包。
  // 但是，重新运行ThreeJS设置是昂贵的。
  // 最佳模式是：
  const latestHandPos = useRef(handPosition);
  useEffect(() => {
      latestHandPos.current = handPosition;
  }, [handPosition]);

  // 我们需要修改循环以使用latestHandPos.current而不是handPosition
  // 让我们稍微重写前面useEffect中的循环逻辑：
  // 由于我无法在这个XML格式中轻松编辑前面的useEffect块而不复制整个文件内容，
  // 我将假设前面的内容块替换了文件内容。
  // 我将在下面的完整文件内容中包含修正后的Ref使用。

  return <div ref={mountRef} className="fixed top-0 left-0 w-full h-full z-0" />;
};

// 重新粘贴带有Ref修复的完整修正BlackHole组件
const BlackHoleCorrected: React.FC<BlackHoleProps> = ({ handPosition }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const timeRef = useRef<number>(0);

  // 在ref中跟踪最新的props以在动画循环中访问
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

      const currentHand = handPosRef.current; // 从Ref访问最新值
      const now = Date.now();

      // 状态逻辑
      if (currentHand.detected) {
        lastDetectionTimeRef.current = now;
        isInteractingRef.current = true;
      } else if (now - lastDetectionTimeRef.current > 1000) {
        isInteractingRef.current = false;
      }

      // 输入平滑
      if (currentHand.detected) {
        const dx = currentHand.x - smoothedHandRef.current.x;
        const dy = currentHand.y - smoothedHandRef.current.y;

        // 死区：1.5%
        if (Math.abs(dx) > 0.015 || Math.abs(dy) > 0.015) {
           smoothedHandRef.current.x += dx * 0.05; // 平滑因子
           smoothedHandRef.current.y += dy * 0.05;
        }
      }

      // 目标逻辑
      if (isInteractingRef.current) {
        const azimuth = smoothedHandRef.current.x * Math.PI * 1.2;
        const polar = (Math.PI / 2.5) + (-smoothedHandRef.current.y * Math.PI / 3.5);
        const radius = 30; // 固定半径以保持稳定性

        targetCameraPos.current.x = radius * Math.sin(polar) * Math.sin(azimuth);
        targetCameraPos.current.y = radius * Math.cos(polar);
        targetCameraPos.current.z = radius * Math.sin(polar) * Math.cos(azimuth);
      } else {
        const idleTime = timeRef.current * 0.2;
        targetCameraPos.current.x = Math.sin(idleTime) * 35;
        targetCameraPos.current.y = 10 + Math.sin(idleTime * 0.5) * 5;
        targetCameraPos.current.z = Math.cos(idleTime) * 35;
      }

      // 相机阻尼
      const damping = 0.02; // 非常缓慢的跟进
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

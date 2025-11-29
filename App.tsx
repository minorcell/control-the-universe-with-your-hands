import React, { useState, useRef, useEffect } from 'react';
import BlackHole from './components/BlackHole';
import ScannerOverlay from './components/ScannerOverlay';
import { AppState, HandPosition } from './types';
import { initializeHandLandmarker, detectHand } from './services/gestureService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [handPosition, setHandPosition] = useState<HandPosition>({ x: 0, y: 0, detected: false });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(0);

  // 初始化摄像头和手势识别
  const startCamera = async () => {
    try {
      await initializeHandLandmarker();

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // 等待视频元数据准备好后再启动循环
        videoRef.current.onloadedmetadata = () => {
           videoRef.current?.play().catch(e => console.error("Play failed", e));
           setAppState(AppState.ACTIVE);
           startGestureLoop();
        };
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("需要摄像头权限才能进行手势控制。");
    }
  };

  const startGestureLoop = () => {
    const loop = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Detect hand
        const hand = detectHand(videoRef.current);
        
        // Update state
        setHandPosition(prev => {
           // Basic smoothing for UI state if needed, but passing raw to BlackHole is usually fine
           // Only update if detection status changes or we want to drive React UI
           // For 3D performance, BlackHole could use a Ref, but since we have a cursor in App, we need state.
           if (prev.detected !== hand.detected) return hand;
           // If detected, always update coordinates
           if (hand.detected) return hand;
           return prev; 
        });
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* Hidden Video Element for Processing */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none"
        playsInline
        muted
      />

      {/* Background Layer - 3D Black Hole */}
      <BlackHole
        handPosition={handPosition}
      />

      {/* Foreground Layer - UI */}
      <ScannerOverlay 
        appState={appState}
        onStartCamera={startCamera}
        handPosition={handPosition}
      />
      
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default App;
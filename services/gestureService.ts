import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { HandPosition } from "../types";

let handLandmarker: HandLandmarker | null = null;
let lastVideoTime = -1;

export const initializeHandLandmarker = async () => {
  if (handLandmarker) return;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
};

export const detectHand = (video: HTMLVideoElement): HandPosition => {
  if (!handLandmarker || !video.currentTime || video.currentTime === lastVideoTime) {
    return { x: 0, y: 0, detected: false, landmarks: [] };
  }

  lastVideoTime = video.currentTime;
  const startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);

  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    const point = landmarks[9]; // 中指掌指关节
    // 粗略估算远近：使用 2D span 作为接近度
    let proximity = 0;
    if (landmarks.length > 0) {
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      landmarks.forEach(l => {
        minX = Math.min(minX, l.x);
        maxX = Math.max(maxX, l.x);
        minY = Math.min(minY, l.y);
        maxY = Math.max(maxY, l.y);
      });
      const span = Math.max(maxX - minX, maxY - minY);
      // 经验阈值：0.07 远，0.32 近，拉满更容易
      proximity = Math.min(1, Math.max(0, (span - 0.07) / (0.32 - 0.07)));
    }

    return {
      x: (1 - point.x) * 2 - 1, 
      y: -(point.y * 2 - 1), 
      detected: true,
      proximity,
      landmarks: landmarks
    };
  }

  return { x: 0, y: 0, detected: false, landmarks: [] };
};

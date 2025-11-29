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
    
    return {
      x: (1 - point.x) * 2 - 1, 
      y: -(point.y * 2 - 1), 
      detected: true,
      landmarks: landmarks
    };
  }

  return { x: 0, y: 0, detected: false, landmarks: [] };
};

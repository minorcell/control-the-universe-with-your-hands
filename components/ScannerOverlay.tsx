import React from 'react';
import { AppState, HandPosition } from '../types';

interface ScannerOverlayProps {
  appState: AppState;
  onStartCamera: () => void;
  handPosition: HandPosition;
}

const HandVisualizer: React.FC<{ hand: HandPosition }> = ({ hand }) => {
  if (!hand.detected || !hand.landmarks) return null;

  // MediaPipe地标是0-1，(0,0)是左上角。
  // 我们想在一个小SVG框中绘制这个。
  const points = hand.landmarks;

  // 手指连接
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // 拇指
    [0, 5], [5, 6], [6, 7], [7, 8],       // 食指
    [0, 9], [9, 10], [10, 11], [11, 12],  // 中指
    [0, 13], [13, 14], [14, 15], [15, 16],// 无名指
    [0, 17], [17, 18], [18, 19], [19, 20] // 小指
  ];

  return (
    <div className="w-32 h-24 border border-blue-400/40 bg-black/80 rounded-lg backdrop-blur-md flex items-center justify-center relative shadow-[0_0_20px_rgba(0,100,255,0.25)]">
      {/* 网格线 */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,120,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(0,120,255,0.2)_1px,transparent_1px)] bg-[size:10px_10px]"></div>
      
      <svg className="w-full h-full p-2 transform scale-x-[-1]" viewBox="0 0 1 1">
        {connections.map(([start, end], i) => (
          <line
            key={i}
            x1={points[start].x}
            y1={points[start].y}
            x2={points[end].x}
            y2={points[end].y}
            stroke="#00ffff"
            strokeWidth="0.02"
            strokeLinecap="round"
            className="opacity-80"
          />
        ))}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="0.015"
            fill={i === 0 ? "#ffaa00" : "#ffffff"} // 手腕是橙色的
            className="drop-shadow-[0_0_3px_rgba(255,255,255,0.9)]"
          />
        ))}
      </svg>
      <div className="absolute top-1 left-2 text-[8px] text-blue-300 font-mono tracking-widest drop-shadow-[0_0_4px_rgba(0,120,255,0.6)]">
        INPUT_MONITOR
      </div>
    </div>
  );
};

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  appState,
  onStartCamera,
  handPosition
}) => {
  return (
    <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-6 pointer-events-none">
      
      {/* 页头 */}
      <header className="absolute top-6 w-full text-center">
        <h1 className="text-3xl md:text-5xl font-thin tracking-[0.5em] text-white opacity-80 uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          使用你的手控制黑洞
        </h1>
      </header>

      {/* 主要内容区域 */}
      <main className="flex flex-col items-center justify-center w-full max-w-lg pointer-events-auto">
        
        {/* 启动按钮 */}
        {appState === AppState.IDLE && (
          <button
            onClick={onStartCamera}
            className="group relative px-12 py-4 bg-transparent overflow-hidden rounded-full transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 border border-blue-400/50 rounded-full group-hover:border-blue-400 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-500"></div>
            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="relative text-blue-100 tracking-[0.3em] font-light text-lg">启动连接</span>
          </button>
        )}

        {/* 说明/状态 */}
        {appState === AppState.ACTIVE && !handPosition.detected && (
           <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-16 h-16 border-2 border-dashed border-red-500/30 rounded-full animate-spin"></div>
              <div className="text-red-300/80 tracking-widest text-sm font-mono blink">
                 等待信号接入...
              </div>
           </div>
        )}

      </main>

      {/* 页脚可视化器 */}
      <footer className="absolute bottom-6 w-full flex justify-center items-end pointer-events-none">
        {appState === AppState.ACTIVE && (
          <div className="flex flex-col items-center gap-2">
             <HandVisualizer hand={handPosition} />
             {handPosition.detected && (
                <div className="text-[10px] text-blue-500/50 tracking-[0.5em] font-mono animate-pulse">
                   SYNCHRONIZED
                </div>
             )}
          </div>
        )}
      </footer>
    </div>
  );
};

export default ScannerOverlay;

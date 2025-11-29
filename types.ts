export enum AppState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE', // Camera on, gesture control active
  ERROR = 'ERROR'
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandPosition {
  x: number; // Normalized -1 to 1 for control
  y: number; // Normalized -1 to 1 for control
  detected: boolean;
  landmarks?: Landmark[]; // Raw landmarks for visualization
}

export interface AnalysisResult {
  subject: string;
  message: string;
  dangerLevel: number;
}

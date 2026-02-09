export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface SummaryData {
  text: string;
  timestamp: string;
}

export interface RecorderOptions {
  mimeType: string;
  videoBitsPerSecond: number;
}

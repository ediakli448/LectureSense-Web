/**
 * Application State Types
 * Central type definitions for LectureSense Web App
 */

/**
 * Main application state enum
 * Represents the current phase of the recording/processing workflow
 */
export enum AppState {
  /** Ready to start recording */
  IDLE = 'IDLE',
  /** Currently recording screen/audio */
  RECORDING = 'RECORDING',
  /** Processing recording with Gemini AI */
  PROCESSING = 'PROCESSING',
  /** Summary generated successfully */
  COMPLETED = 'COMPLETED',
  /** An error occurred */
  ERROR = 'ERROR',
}

/**
 * Summary data structure for persistence/export
 */
export interface SummaryData {
  /** The generated summary text (markdown format) */
  text: string;
  /** ISO timestamp of when the summary was generated */
  timestamp: string;
  /** Optional: Duration of the original recording in seconds */
  recordingDuration?: number;
}

/**
 * Configuration options for media recording
 */
export interface RecorderOptions {
  /** MIME type for the recording (e.g., 'video/webm; codecs=vp9') */
  mimeType: string;
  /** Video bitrate in bits per second */
  videoBitsPerSecond: number;
  /** Target frame rate */
  frameRate?: number;
  /** Interval for collecting chunks in milliseconds */
  timeslice?: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'markdown' | 'print';

/**
 * Generic error with additional context
 */
export interface AppError {
  message: string;
  code?: string;
  recoverable: boolean;
}

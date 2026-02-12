/**
 * Services Module Index
 * Centralized exports for all service modules
 */

// Gemini AI Service
export {
  generateLectureSummary,
  extractResponseText,
  validateApiKey,
} from './geminiService';
export type { GeminiServiceConfig, ProgressCallback } from './geminiService';

// Recorder Service
export {
  RecorderService,
  createRecorder,
} from './recorderService';
export type {
  RecorderConfig,
  RecorderState,
  RecorderCallbacks,
} from './recorderService';

// PDF Export Service
export {
  exportToPdf,
  exportViaPrint,
  extractTextFromResponse,
  processHebrewText,
} from './pdfExportService';

/**
 * RecorderService - Handles screen/audio recording with proper resource management
 * 
 * Features:
 * - Non-blocking async operations
 * - Proper stream cleanup on stop/error
 * - Event-based communication with UI
 * - Automatic resource disposal
 */

export interface RecorderConfig {
  frameRate?: number;
  videoBitsPerSecond?: number;
  timeslice?: number;
}

export type RecorderState = 'idle' | 'recording' | 'stopping' | 'error';

export interface RecorderCallbacks {
  onStateChange: (state: RecorderState) => void;
  onDataAvailable: (chunk: Blob) => void;
  onStop: (blob: Blob) => void;
  onError: (error: Error) => void;
  onTimeUpdate: (seconds: number) => void;
}

const DEFAULT_CONFIG: Required<RecorderConfig> = {
  frameRate: 5,
  videoBitsPerSecond: 250000,
  timeslice: 1000,
};

/**
 * RecorderService class
 * Encapsulates all recording logic with proper cleanup
 */
export class RecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private timerInterval: number | null = null;
  private elapsedSeconds: number = 0;
  private state: RecorderState = 'idle';
  private callbacks: RecorderCallbacks | null = null;
  private config: Required<RecorderConfig>;
  private videoPreviewElement: HTMLVideoElement | null = null;

  constructor(config: RecorderConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Attach callbacks for state changes and events
   */
  public setCallbacks(callbacks: RecorderCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Set video element for preview (optional)
   */
  public setPreviewElement(element: HTMLVideoElement | null): void {
    this.videoPreviewElement = element;
  }

  /**
   * Get current recorder state
   */
  public getState(): RecorderState {
    return this.state;
  }

  /**
   * Get elapsed recording time in seconds
   */
  public getElapsedTime(): number {
    return this.elapsedSeconds;
  }

  /**
   * Start recording - requests screen capture and begins recording
   * Returns immediately; state updates via callbacks
   */
  public async start(): Promise<void> {
    if (this.state === 'recording') {
      console.warn('RecorderService: Already recording');
      return;
    }

    this.setState('idle');
    this.chunks = [];
    this.elapsedSeconds = 0;

    try {
      // Request screen capture with system audio
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: this.config.frameRate } },
        audio: true,
      });

      // Handle user stopping share via browser UI
      this.stream.getVideoTracks()[0].onended = () => {
        if (this.state === 'recording') {
          this.stop();
        }
      };

      // Setup preview if element is provided
      if (this.videoPreviewElement) {
        this.videoPreviewElement.srcObject = this.stream;
        this.videoPreviewElement.play().catch((e) => {
          console.warn('Preview play interrupted:', e);
        });
      }

      // Determine best supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9')
        ? 'video/webm; codecs=vp9'
        : 'video/webm';

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        videoBitsPerSecond: this.config.videoBitsPerSecond,
      });

      // Handle data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          this.callbacks?.onDataAvailable(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        this.handleRecordingStopped();
      };

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`MediaRecorder error: ${event.type}`);
        this.handleError(error);
      };

      // Verify recorder is ready
      if (this.mediaRecorder.state !== 'inactive') {
        throw new Error('MediaRecorder is not in inactive state');
      }

      // Start recording
      this.mediaRecorder.start(this.config.timeslice);
      this.setState('recording');

      // Start elapsed time counter
      this.startTimer();

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      
      // Handle permission denied gracefully
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        this.setState('idle');
        return;
      }

      this.handleError(err);
    }
  }

  /**
   * Stop recording - finalizes and returns blob via callback
   */
  public stop(): void {
    if (this.state !== 'recording') {
      console.warn('RecorderService: Not currently recording');
      return;
    }

    this.setState('stopping');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Force cleanup of all resources
   * Call this when component unmounts or on error recovery
   */
  public dispose(): void {
    this.stopTimer();
    this.cleanupStream();
    this.cleanupPreview();
    
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.elapsedSeconds = 0;
    this.setState('idle');
  }

  // === Private Methods ===

  private setState(newState: RecorderState): void {
    this.state = newState;
    this.callbacks?.onStateChange(newState);
  }

  private startTimer(): void {
    this.elapsedSeconds = 0;
    this.callbacks?.onTimeUpdate(0);

    this.timerInterval = window.setInterval(() => {
      this.elapsedSeconds += 1;
      this.callbacks?.onTimeUpdate(this.elapsedSeconds);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private handleRecordingStopped(): void {
    this.stopTimer();
    this.cleanupStream();
    this.cleanupPreview();

    // Create final blob from collected chunks
    const blob = new Blob(this.chunks, { type: 'video/webm' });
    this.chunks = [];

    this.setState('idle');
    this.callbacks?.onStop(blob);
  }

  private handleError(error: Error): void {
    console.error('RecorderService error:', error);
    this.dispose();
    this.setState('error');
    this.callbacks?.onError(error);
  }

  /**
   * Cleanup media stream tracks
   * Releases screen share indicator and camera/mic
   */
  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
      this.stream = null;
    }
  }

  /**
   * Cleanup video preview element
   */
  private cleanupPreview(): void {
    if (this.videoPreviewElement) {
      this.videoPreviewElement.srcObject = null;
    }
  }
}

/**
 * Factory function for creating recorder instances
 */
export const createRecorder = (config?: RecorderConfig): RecorderService => {
  return new RecorderService(config);
};

export default RecorderService;

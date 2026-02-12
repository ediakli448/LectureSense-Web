import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Video, AlertCircle, Loader2, FileText } from 'lucide-react';
import { generateLectureSummary } from './services/geminiService';
import { RecorderService, RecorderState } from './services/recorderService';
import { SummaryView } from './components/SummaryView';
import { useCleanup } from './hooks/useCleanup';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs for services and DOM elements
  const recorderRef = useRef<RecorderService | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const pendingBlobRef = useRef<Blob | null>(null);
  
  // Cleanup hook for proper resource management
  const cleanup = useCleanup();

  /**
   * Format seconds to MM:SS display
   */
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * Handle recorder state changes
   */
  const handleRecorderStateChange = useCallback((state: RecorderState) => {
    switch (state) {
      case 'recording':
        setAppState(AppState.RECORDING);
        break;
      case 'stopping':
        // Transitional state, handled in onStop
        break;
      case 'error':
        setAppState(AppState.ERROR);
        break;
      case 'idle':
        // Only set idle if we're not processing
        if (pendingBlobRef.current === null) {
          // Keep current state
        }
        break;
    }
  }, []);

  /**
   * Handle recording completion - process with AI
   */
  const handleRecordingStop = useCallback(async (blob: Blob) => {
    // Track blob for cleanup
    cleanup.trackBlob(blob);
    pendingBlobRef.current = blob;
    
    setAppState(AppState.PROCESSING);
    
    try {
      const generatedText = await generateLectureSummary(blob);
      setSummary(generatedText);
      setAppState(AppState.COMPLETED);
    } catch (err) {
      console.error('Processing failed:', err);
      setError('Failed to process the recording with Gemini. Please check your API key and try again.');
      setAppState(AppState.ERROR);
    } finally {
      // Clear blob reference to allow garbage collection
      pendingBlobRef.current = null;
      cleanup.cleanupBlobs();
    }
  }, [cleanup]);

  /**
   * Handle recorder errors
   */
  const handleRecorderError = useCallback((err: Error) => {
    console.error('Recorder error:', err);
    
    // Handle specific errors
    if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
      setError(null);
      setAppState(AppState.IDLE);
      return;
    }
    
    if (err.name === 'InvalidStateError') {
      setError('Recording failed to start. Please refresh the page and try again.');
    } else {
      setError('Failed to start recording. Please ensure you grant screen permissions.');
    }
    
    setAppState(AppState.ERROR);
  }, []);

  /**
   * Initialize recorder service on mount
   */
  useEffect(() => {
    const recorder = new RecorderService({
      frameRate: 5,
      videoBitsPerSecond: 250000,
      timeslice: 1000,
    });
    
    recorder.setCallbacks({
      onStateChange: handleRecorderStateChange,
      onDataAvailable: () => {}, // Chunks handled internally
      onStop: handleRecordingStop,
      onError: handleRecorderError,
      onTimeUpdate: setElapsedTime,
    });
    
    recorderRef.current = recorder;
    
    // Cleanup on unmount - ensures resources are freed even on crash
    return () => {
      recorder.dispose();
      cleanup.cleanupAll();
    };
  }, [handleRecorderStateChange, handleRecordingStop, handleRecorderError, cleanup]);

  /**
   * Update preview element reference when available
   */
  useEffect(() => {
    if (recorderRef.current && videoPreviewRef.current) {
      recorderRef.current.setPreviewElement(videoPreviewRef.current);
    }
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    setError(null);
    
    if (recorderRef.current) {
      await recorderRef.current.start();
    }
  }, []);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stop();
    }
  }, []);

  /**
   * Reset app to initial state
   */
  const resetApp = useCallback(() => {
    setAppState(AppState.IDLE);
    setSummary('');
    setError(null);
    setElapsedTime(0);
    pendingBlobRef.current = null;
    
    // Ensure all resources are cleaned up
    cleanup.cleanupAll();
    
    // Dispose and recreate recorder for clean state
    if (recorderRef.current) {
      recorderRef.current.dispose();
    }
  }, [cleanup]);

  if (appState === AppState.COMPLETED) {
    return <SummaryView summary={summary} onReset={resetApp} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-vet-600 to-vet-800 shadow-lg mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white">LectureSense</h1>
          <p className="text-vet-300">Veterinary Study Companion</p>
        </div>

        {/* Status Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-vet-500 opacity-10 blur-3xl rounded-full"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-purple-500 opacity-10 blur-3xl rounded-full"></div>

          {appState === AppState.IDLE && (
            <div className="space-y-6 relative z-10">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-white">Ready to Record</h2>
                <p className="text-sm text-gray-400">
                  Ensure you select "Share System Audio" in the browser dialog to capture the lecturer's voice clearly.
                </p>
              </div>
              
              {error && (
                 <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-2 text-sm text-red-200">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                 </div>
              )}

              <button
                onClick={startRecording}
                className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-red-900/20"
              >
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                Start Recording
              </button>
            </div>
          )}

          {appState === AppState.RECORDING && (
             <div className="space-y-6 relative z-10">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                   <div className="w-24 h-24 rounded-full border-4 border-red-500/30 flex items-center justify-center animate-pulse">
                      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                        <span className="text-2xl font-mono font-bold text-white">{formatTime(elapsedTime)}</span>
                      </div>
                   </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-medium text-red-400">Recording in Progress</h3>
                  <p className="text-xs text-gray-500 mt-1">Capturing Screen & System Audio</p>
                </div>
                
                {/* Hidden video element for preview stream keeping alive */}
                <video ref={videoPreviewRef} muted className="hidden" playsInline />
              </div>

              <button
                onClick={stopRecording}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors border border-gray-600"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop & Analyze
              </button>
            </div>
          )}

          {appState === AppState.PROCESSING && (
            <div className="space-y-6 text-center py-4 relative z-10">
              <div className="flex justify-center">
                <Loader2 className="w-12 h-12 text-vet-400 animate-spin" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Processing Lecture</h3>
                <p className="text-sm text-gray-400 mt-2">Gemini 3 Pro is analyzing visual and audio data...</p>
                <p className="text-xs text-gray-600 mt-4">This may take a minute depending on duration.</p>
              </div>
            </div>
          )}

          {appState === AppState.ERROR && (
            <div className="space-y-6 text-center py-4 relative z-10">
              <div className="flex justify-center">
                <AlertCircle className="w-12 h-12 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Analysis Failed</h3>
                <p className="text-sm text-red-200 mt-2">{error}</p>
              </div>
              <button
                onClick={resetApp}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs text-gray-500">
            <div className="flex flex-col items-center gap-1">
                <Video className="w-4 h-4 mb-1 text-vet-500" />
                <span>Screen Sync</span>
            </div>
             <div className="flex flex-col items-center gap-1">
                <Mic className="w-4 h-4 mb-1 text-vet-500" />
                <span>System Audio</span>
            </div>
             <div className="flex flex-col items-center gap-1">
                <FileText className="w-4 h-4 mb-1 text-vet-500" />
                <span>Hebrew PDF</span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;
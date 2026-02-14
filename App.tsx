import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Video, AlertCircle, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { generateLectureSummary } from './services/geminiService';
import { SummaryView } from './components/SummaryView';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false); // New state to prevent double-clicks/freezing
  
  // Refs for state management across async operations and event listeners
  const appStateRef = useRef<AppState>(AppState.IDLE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Sync ref with state for event listeners
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    // 1. Immediate UI Feedback (Prevents "Freezing" feeling)
    setIsInitializing(true);
    setError(null);

    try {
      // Request screen capture with system audio
      // Note: "systemAudio: 'include'" is a hint, user must still select it.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 5 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // 2. CRITICAL: Validate System Audio Check
      // If the user forgot to check "Share System Audio", we must fail early.
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        // Stop the video track immediately to close the "Stop Sharing" banner
        stream.getTracks().forEach(t => t.stop());
        throw new Error("System Audio missing. You MUST check 'Share system audio' in the browser dialog.");
      }

      // Handle user stopping the share via browser UI
      stream.getVideoTracks()[0].onended = () => {
        // Use ref to check current state, as closure 'appState' might be stale
        if (appStateRef.current === AppState.RECORDING) {
           stopRecording(); // Trigger logic, don't just call setAppState
        }
      };

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        // Handle play promise to prevent Uncaught (in promise) DOMException
        videoPreviewRef.current.play().catch(e => console.warn("Preview play interrupted:", e));
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp9') 
        ? 'video/webm; codecs=vp9' 
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 250000
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
         // This listener is triggered by mediaRecorder.stop()
         // We handle the actual processing in the stopRecording function or a helper
         // But we ensure clean up here if needed.
         stream.getTracks().forEach(track => track.stop());
         handleRecordingStop(); 
      };

      // Ensure state is inactive before starting
      if (mediaRecorder.state !== 'inactive') {
        throw new Error("MediaRecorder is not in inactive state");
      }

      mediaRecorder.start(1000); // Collect chunks every second
      setAppState(AppState.RECORDING);
      
      setElapsedTime(0);
      timerRef.current = window.setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Error starting recording:", err);

      // Handle "Permission denied" gracefully (User clicked Cancel)
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setError(null); // No error message needed if user canceled voluntarily
        setAppState(AppState.IDLE);
        return;
      }
      
      // Specific error messaging
      let errorMessage = "Failed to start recording.";
      if (err.message.includes('System Audio missing')) {
        errorMessage = err.message;
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No recording device found.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Hardware error: Could not access screen/audio.";
      }

      setError(errorMessage);
      setAppState(AppState.IDLE);
    } finally {
      // 3. Release the "Loading" state
      setIsInitializing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // onstop event will fire handleRecordingStop
    }
  };

  const handleRecordingStop = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setAppState(AppState.PROCESSING);
    
    try {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      // Sanity check for blob size
      if (blob.size === 0) {
        throw new Error("Recording failed: Video file is empty.");
      }
      
      const generatedText = await generateLectureSummary(blob);
      setSummary(generatedText);
      setAppState(AppState.COMPLETED);
    } catch (err) {
      console.error("Processing failed", err);
      setError("Failed to process the recording with Gemini. Please check your API key and try again.");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setSummary('');
    setError(null);
    setElapsedTime(0);
    chunksRef.current = [];
  };

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
                  Ensure you select <strong className="text-white">"Share System Audio"</strong> in the browser dialog to capture the lecturer's voice clearly.
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
                disabled={isInitializing}
                className={`w-full group relative flex items-center justify-center gap-3 py-4 px-6 rounded-xl font-semibold transition-all shadow-lg 
                  ${isInitializing 
                    ? 'bg-gray-600 cursor-wait opacity-80' 
                    : 'bg-red-600 hover:bg-red-500 hover:shadow-red-900/20 text-white'}`}
              >
                {isInitializing ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin" />
                     <span>Initializing...</span>
                   </>
                ) : (
                   <>
                     <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                     <span>Start Recording</span>
                   </>
                )}
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
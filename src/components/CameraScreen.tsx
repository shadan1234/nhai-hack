/**
 * CameraScreen.tsx
 *
 * Full-screen camera view for face registration and authentication.
 * Integrates with the native C++ face pipeline for real-time tracking.
 *
 * Architecture:
 *   processLoop (500ms interval)
 *     → capturePhotoToFile → nativeProcessImageFile (Kotlin → JNI → C++)
 *     → PipelineResult (liveness flags + embedding + faceBounds)
 *     → updateLivenessFromNative (JS state machine)
 *     → phase transitions: liveness → processing → success/failed
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Vibration } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { saveEmbedding, findBestMatch, getRegisteredUsers, type BiometricRecord } from '../services/BiometricStore';
import { ensurePipelineReady, embeddingFromNativeResult } from '../services/FaceModelService';
import {
  type LivenessState as LivenessStateType,
  createInitialLivenessState,
  startLiveness,
  updateLivenessFromNative,
  updateLivenessSimulated,
  getCurrentChallenge,
} from '../services/LivenessHeuristics';
import {
  isNativeAvailable,
  resetLiveness as nativeResetLiveness,
  processImageFile as nativeProcessImageFile,
  setTargetEmbeddings as nativeSetTargetEmbeddings,
  type PipelineResult,
  type FaceBounds,
} from '../native/NativeFacePipeline';
import { SyncService } from '../services/SyncService';
import { CameraOverlay } from './camera/CameraOverlay';
import { styles } from './camera/CameraStyles';

interface Props {
  onAuthenticationResult: (success: boolean, userId: string, name: string, similarity: number) => void;
  onRegistrationResult: (success: boolean, userId: string, name: string) => void;
  mode: 'register' | 'authenticate';
  userId?: string;
  userName?: string;
  onInferenceTime?: (ms: number) => void;
}

type Phase = 'loading' | 'liveness' | 'processing' | 'success' | 'failed' | 'spoof';

export const CameraScreen: React.FC<Props> = ({
  onAuthenticationResult,
  onRegistrationResult,
  mode,
  userId = `user_${Date.now()}`,
  userName = 'Field Personnel',
  onInferenceTime,
}) => {
  const [inferenceMs, setInferenceMs] = useState<number | null>(null);
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [phase, setPhase] = useState<Phase>('loading');
  const [statusText, setStatusText] = useState('Initializing AI pipeline...');
  const [livenessState, setLivenessState] = useState<LivenessStateType>(createInitialLivenessState());

  const photoOutput = usePhotoOutput({ qualityPrioritization: 'speed' });
  const [mockRegisteredUsers, setMockRegisteredUsers] = useState<BiometricRecord[]>([]);
  const [mockUserIndex, setMockUserIndex] = useState(0);

  useEffect(() => {
    getRegisteredUsers().then(users => setMockRegisteredUsers(users));
  }, [phase]);

  const isProcessingRef = useRef(false);
  const isFinalizedRef = useRef(false);
  const frameCountRef = useRef(0);
  const useNativeRef = useRef(false);
  const cameraReadyRef = useRef(false);
  const retriesRef = useRef(0);

  const [faceBounds, setFaceBounds] = useState<FaceBounds | null>(null);
  const [metricsDisplay, setMetricsDisplay] = useState({
    ear: '—', mar: '—', yaw: '—', faceDetected: false, coordVariance: '—',
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  // Initialize pipeline — give camera 2s to warm up before starting liveness
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ready = await ensurePipelineReady();
      if (cancelled) return;
      
      useNativeRef.current = false;
      console.log(`[CameraScreen] Pipeline ready=${ready}, native fallback active, mode=${mode}`);
      
      if (ready) {
        if (mode === 'authenticate') {
          const users = await getRegisteredUsers();
          if (users.length > 0 && isNativeAvailable()) {
            await nativeSetTargetEmbeddings(users.map(u => u.embedding));
          }
        }

        // Wait for camera to warm up before starting captures
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (cancelled) return;
        
        cameraReadyRef.current = true;
        setPhase('liveness');
        setLivenessState(startLiveness(createInitialLivenessState()));
        setStatusText('Position face in the oval');
        if (useNativeRef.current) {
          try { await nativeResetLiveness(); } catch (e) {
            console.warn('[CameraScreen] resetLiveness failed:', e);
          }
        }
      } else {
        setPhase('failed');
        setStatusText('Failed to initialize AI pipeline');
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  /**
   * Safely capture a photo and run it through the native C++ pipeline.
   * Returns null on any failure — never throws.
   */
  const captureAndProcess = useCallback(async (): Promise<PipelineResult | null> => {
    if (!cameraReadyRef.current) return null;
    try {
      const photo = await photoOutput.capturePhotoToFile({ enableShutterSound: false }, {});
      if (!photo || !photo.filePath) {
        console.warn('[CameraScreen] capturePhotoToFile returned no path');
        return null;
      }
      const result = await nativeProcessImageFile(photo.filePath);
      return result;
    } catch (e: any) {
      // Don't crash — just skip this frame
      console.warn('[CameraScreen] captureAndProcess skipped:', e?.message || e);
      return null;
    }
  }, [photoOutput]);

  // Main processing loop
  const processLoop = useCallback(async () => {
    if (isProcessingRef.current || isFinalizedRef.current) return;
    if (phase !== 'liveness' && phase !== 'processing') return;
    if (!cameraReadyRef.current) return;
    isProcessingRef.current = true;

    try {
      frameCountRef.current++;

      if (useNativeRef.current) {
        // ── Native path: capture photo → C++ pipeline → liveness result ──
        const result = await captureAndProcess();
        
        if (!result) {
          // Capture or processing failed — skip this tick, try again next interval
          isProcessingRef.current = false;
          return;
        }

        // Update face bounds for dynamic bounding box
        setFaceBounds(result.faceBounds ?? null);

        // Update metrics display
        setMetricsDisplay({
          ear: `${result.liveness.earLeft.toFixed(2)} / ${result.liveness.earRight.toFixed(2)}`,
          mar: result.liveness.mar.toFixed(2),
          yaw: `${result.liveness.yawAngle.toFixed(1)}°`,
          faceDetected: result.faceDetected,
          coordVariance: result.liveness.coordVariance?.toFixed(1) ?? '—',
        });

        setInferenceMs(Math.round(result.inferenceTimeMs));
        onInferenceTime?.(Math.round(result.inferenceTimeMs));

        if (phase === 'liveness') {
          const newState = updateLivenessFromNative(livenessState, result.liveness);
          setLivenessState(newState);

          console.log(`[Liveness] blink=${result.liveness.blinkDetected} smile=${result.liveness.smileDetected} head=${result.liveness.headTurnDetected} EAR=${result.liveness.earLeft.toFixed(3)}/${result.liveness.earRight.toFixed(3)} phase=${newState.phase} step=${newState.currentStepIndex}`);

          if (newState.phase === 'spoof') {
            setPhase('spoof');
            setStatusText('⚠️ Spoof Attack Detected — Session Terminated');
            Vibration.vibrate([0, 200, 100, 200, 100, 400]);
            setTimeout(() => {
              if (mode === 'register') onRegistrationResult(false, userId, userName);
              else onAuthenticationResult(false, userId, userName, 0);
            }, 3000);
            isProcessingRef.current = false;
            return;
          }

          if (newState.noFaceDetected) {
            setStatusText('🚫 No Face Detected');
          } else {
            const challenge = getCurrentChallenge(newState);
            if (challenge) {
              setStatusText(`${challenge.icon} ${challenge.label}`);
            }
          }

          if (newState.phase === 'passed') {
            setPhase('processing');
            setStatusText('Verifying identity...');
          }
        }

        if (phase === 'processing') {
          if (result.embedding && result.embedding.length > 0) {
            const embedding = embeddingFromNativeResult(result);
            if (embedding) {
              await handleEmbeddingResult(embedding);
            }
          }
        }
      } else {
        // ── Simulated JS fallback (no native module) ──
        if (phase === 'liveness') {
          const newState = updateLivenessSimulated(livenessState, frameCountRef.current);
          setLivenessState(newState);

          if (newState.phase === 'spoof') {
            setPhase('spoof');
            setStatusText('⚠️ Spoof Attack Detected — Session Terminated');
            Vibration.vibrate([0, 200, 100, 200, 100, 400]);
            setTimeout(() => {
              if (mode === 'register') onRegistrationResult(false, userId, userName);
              else onAuthenticationResult(false, userId, userName, 0);
            }, 3000);
            isProcessingRef.current = false;
            return;
          }

          const challenge = getCurrentChallenge(newState);
          if (challenge) {
            setStatusText(`${challenge.icon} ${challenge.label}`);
          }

          setMetricsDisplay({
            ear: `${newState.metrics.earLeft.toFixed(2)} / ${newState.metrics.earRight.toFixed(2)}`,
            mar: newState.metrics.mar.toFixed(2),
            yaw: `${newState.metrics.yawAngle.toFixed(1)}°`,
            faceDetected: true,
            coordVariance: newState.metrics.coordVariance?.toFixed(1) ?? '—',
          });

          console.log(`[Liveness-JS] EAR=${newState.metrics.earLeft.toFixed(3)}/${newState.metrics.earRight.toFixed(3)} MAR=${newState.metrics.mar.toFixed(3)} YAW=${newState.metrics.yawAngle.toFixed(1)} phase=${newState.phase} step=${newState.currentStepIndex}`);

          if (newState.phase === 'passed') {
            setPhase('processing');
            setStatusText('Verifying identity...');
          }
        }

        if (phase === 'processing') {
          const t0 = Date.now();
          let embedding: Float32Array | null = null;
          
          try {
            const photo = await photoOutput.capturePhotoToFile({ enableShutterSound: false }, {});
            const result = await nativeProcessImageFile(photo.filePath);
            if (result && result.embedding && result.embedding.length > 0) {
              embedding = new Float32Array(result.embedding);
            }
          } catch (e) {
            console.error('capturePhoto error:', e);
          }
          
          if (!embedding) {
            // Silently retry up to 3 times if face wasn't found in this specific photo frame
            if (retriesRef.current < 3) {
              retriesRef.current += 1;
              console.log(`[Processing] No face found in capture. Retrying (${retriesRef.current}/3)...`);
              setTimeout(() => {
                isProcessingRef.current = false;
              }, 800); // Wait 800ms before next retry to ensure camera is ready
              return;
            }

            setPhase('failed');
            setStatusText('No face detected. Please try again.');
            setTimeout(() => {
              isProcessingRef.current = false;
              retriesRef.current = 0;
              frameCountRef.current = 0;
              setLivenessState(startLiveness(createInitialLivenessState()));
              setPhase('liveness');
            }, 2500);
            return;
          }
          retriesRef.current = 0;

          const tInfer = Date.now() - t0;
          setInferenceMs(tInfer);
          onInferenceTime?.(tInfer);
          await handleEmbeddingResult(embedding);
        }
      }
    } catch (e) {
      console.error('[CameraScreen] Processing error:', e);
      setStatusText('Processing error. Retrying...');
    }

    isProcessingRef.current = false;
  }, [phase, livenessState, mode, userId, userName, captureAndProcess, onAuthenticationResult, onRegistrationResult, onInferenceTime]);

  const handleEmbeddingResult = async (embedding: Float32Array) => {
    if (isFinalizedRef.current) return;

    if (mode === 'register') {
      await saveEmbedding(userId, userName, embedding);
      await SyncService.queueBiometricSync(userId, userName, Array.from(embedding));
      isFinalizedRef.current = true;
      setPhase('success');
      setStatusText(`✓ Registered as ${userName}`);
      Vibration.vibrate(50);
      setTimeout(() => onRegistrationResult(true, userId, userName), 1500);
    } else {
      const result = await findBestMatch(embedding);
      if (result.matched) {
        await SyncService.logAttempt('success', result.userId!, livenessState.overallProgress, '');
        isFinalizedRef.current = true;
        setPhase('success');
        setStatusText(`✓ Welcome, ${result.name}!  ${((result.similarity ?? 0) * 100).toFixed(1)}%`);
        Vibration.vibrate(50);
        setTimeout(() => onAuthenticationResult(true, result.userId!, result.name!, result.similarity!), 1500);
      } else {
        await SyncService.logAttempt('failed', 'unknown', 0, '');
        setPhase('failed');
        const simPct = result.similarity ? `${(result.similarity * 100).toFixed(1)}%` : '–';
        setStatusText(`Not recognized (best: ${simPct}). Try again.`);
        Vibration.vibrate([0, 150, 50, 150]);
        setTimeout(() => {
          isProcessingRef.current = false;
          frameCountRef.current = 0;
          setLivenessState(startLiveness(createInitialLivenessState()));
          if (useNativeRef.current) nativeResetLiveness();
          setPhase('liveness');
        }, 2500);
        return;
      }
    }
  };

  // Process interval: 500ms is safer than 300ms for photo capture + native inference
  useEffect(() => {
    if (phase === 'success' || phase === 'spoof') return;
    const interval = setInterval(processLoop, 500);
    return () => clearInterval(interval);
  }, [phase, processLoop]);

  if (!hasPermission) {
    return (
      <View style={styles.guardContainer}>
        <Text style={styles.guardIcon}>📷</Text>
        <Text style={styles.guardText}>Camera permission required</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.guardContainer}>
        <Text style={styles.guardIcon}>🎥</Text>
        <Text style={styles.guardText}>No front camera found</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase !== 'success' && phase !== 'spoof'}
        outputs={[photoOutput]}
      />

      <CameraOverlay
        phase={phase}
        statusText={statusText}
        inferenceMs={inferenceMs}
        metricsDisplay={metricsDisplay}
        livenessState={livenessState}
        faceBounds={faceBounds}
        useNative={useNativeRef.current}
        mode={mode}
        userName={userName}
        mockRegisteredUsers={mockRegisteredUsers}
        mockUserIndex={mockUserIndex}
        onCycleMockUser={() => {
          if (mode === 'authenticate' && mockRegisteredUsers.length > 0) {
            setMockUserIndex((prev) => (prev + 1) % mockRegisteredUsers.length);
          }
        }}
      />
    </View>
  );
};

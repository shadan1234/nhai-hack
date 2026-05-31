import type { LivenessResult } from '../native/NativeFacePipeline';
import { LivenessStatusCode } from '../native/NativeFacePipeline';

// Re-export for consumers
export { LivenessStatusCode };

export type LivenessChallenge = 'blink' | 'smile' | 'head_turn';
export type LivenessPhase = 'idle' | 'challenging' | 'passed' | 'failed' | 'spoof';

export interface LivenessStep {
  challenge: LivenessChallenge;
  label: string;
  icon: string;
  completed: boolean;
}

export const LIVENESS_CHALLENGES: LivenessStep[] = [
  { challenge: 'blink', label: 'Blink your eyes', icon: '👁️', completed: false },
  { challenge: 'smile', label: 'Smile slightly', icon: '😊', completed: false },
  { challenge: 'head_turn', label: 'Turn your head left or right', icon: '↔️', completed: false },
];

export interface LivenessState {
  phase: LivenessPhase;
  currentStepIndex: number;
  steps: LivenessStep[];
  metrics: {
    earLeft: number;
    earRight: number;
    mar: number;
    yawAngle: number;
    pitchAngle: number;
    totalFrames: number;
    // Anti-spoofing metrics
    coordVariance: number;
    neutralEar: number;
    neutralMar: number;
  };
  overallProgress: number;

  // Anti-spoofing state
  spoofDetected: boolean;
  spoofReason: string;
  noFaceDetected: boolean;
  livenessStatusCode: LivenessStatusCode;
}

const initialMetrics = {
  earLeft: 0,
  earRight: 0,
  mar: 0,
  yawAngle: 0,
  pitchAngle: 0,
  totalFrames: 0,
  coordVariance: 0,
  neutralEar: 0,
  neutralMar: 0,
};

export function createInitialLivenessState(): LivenessState {
  return {
    phase: 'idle',
    currentStepIndex: 0,
    steps: LIVENESS_CHALLENGES.map(s => ({ ...s, completed: false })),
    metrics: { ...initialMetrics },
    overallProgress: 0,
    spoofDetected: false,
    spoofReason: '',
    noFaceDetected: false,
    livenessStatusCode: LivenessStatusCode.Processing,
  };
}

export function startLiveness(state: LivenessState): LivenessState {
  return {
    ...state,
    phase: 'challenging',
    currentStepIndex: 0,
    steps: LIVENESS_CHALLENGES.map(s => ({ ...s, completed: false })),
    metrics: { ...initialMetrics },
    overallProgress: 0,
    spoofDetected: false,
    spoofReason: '',
    noFaceDetected: false,
    livenessStatusCode: LivenessStatusCode.Processing,
  };
}

export function updateLivenessFromNative(
  state: LivenessState,
  nativeResult: LivenessResult
): LivenessState {
  if (state.phase !== 'challenging') return state;

  const statusCode: LivenessStatusCode =
    (nativeResult.livenessStatus as LivenessStatusCode) ?? LivenessStatusCode.Processing;

  // ── Spoof detected → immediate termination ──
  if (nativeResult.spoofDetected || statusCode === LivenessStatusCode.SpoofDetected) {
    return {
      ...state,
      phase: 'spoof',
      spoofDetected: true,
      spoofReason: 'Spoof Attack: Static Media Detected',
      livenessStatusCode: LivenessStatusCode.SpoofDetected,
      metrics: {
        earLeft: nativeResult.earLeft,
        earRight: nativeResult.earRight,
        mar: nativeResult.mar,
        yawAngle: nativeResult.yawAngle,
        pitchAngle: nativeResult.pitchAngle,
        totalFrames: nativeResult.totalFrames,
        coordVariance: nativeResult.coordVariance ?? 0,
        neutralEar: nativeResult.neutralEar ?? 0,
        neutralMar: nativeResult.neutralMar ?? 0,
      },
      overallProgress: state.overallProgress,
    };
  }

  // ── No face detected ──
  const noFace = statusCode === LivenessStatusCode.NoFaceDetected;

  // ── Update challenge steps from native detection ──
  const newSteps = [...state.steps.map(s => ({ ...s }))];
  const newMetrics = {
    earLeft: nativeResult.earLeft,
    earRight: nativeResult.earRight,
    mar: nativeResult.mar,
    yawAngle: nativeResult.yawAngle,
    pitchAngle: nativeResult.pitchAngle,
    totalFrames: nativeResult.totalFrames,
    coordVariance: nativeResult.coordVariance ?? 0,
    neutralEar: nativeResult.neutralEar ?? 0,
    neutralMar: nativeResult.neutralMar ?? 0,
  };

  if (nativeResult.blinkDetected) {
    const blinkStep = newSteps.find(s => s.challenge === 'blink');
    if (blinkStep) blinkStep.completed = true;
  }

  if (nativeResult.smileDetected) {
    const smileStep = newSteps.find(s => s.challenge === 'smile');
    if (smileStep) smileStep.completed = true;
  }

  if (nativeResult.headTurnDetected) {
    const headStep = newSteps.find(s => s.challenge === 'head_turn');
    if (headStep) headStep.completed = true;
  }

  const completedCount = newSteps.filter(s => s.completed).length;
  const allPassed = completedCount === newSteps.length;

  let newStepIndex = state.currentStepIndex;
  for (let i = 0; i < newSteps.length; i++) {
    if (!newSteps[i].completed) {
      newStepIndex = i;
      break;
    }
    if (i === newSteps.length - 1) {
      newStepIndex = newSteps.length;
    }
  }

  return {
    phase: allPassed ? 'passed' : 'challenging',
    currentStepIndex: newStepIndex,
    steps: newSteps,
    metrics: newMetrics,
    overallProgress: completedCount / newSteps.length,
    spoofDetected: false,
    spoofReason: '',
    noFaceDetected: noFace,
    livenessStatusCode: statusCode,
  };
}

/**
 * Simulated liveness fallback — DEMO MODE ONLY.
 *
 * This path does NOT perform real anti-spoofing.  It auto-passes all
 * challenges after fixed frame-count thresholds for UI demo purposes.
 */
export function updateLivenessSimulated(state: LivenessState, frameCount: number): LivenessState {
  if (state.phase !== 'challenging') return state;

  const newSteps = [...state.steps.map(s => ({ ...s }))];

  // At 500ms per frame, 5 frames = 2.5 seconds
  if (frameCount > 5) {
    const blinkStep = newSteps.find(s => s.challenge === 'blink');
    if (blinkStep) blinkStep.completed = true;
  }

  if (frameCount > 10) {
    const smileStep = newSteps.find(s => s.challenge === 'smile');
    if (smileStep) smileStep.completed = true;
  }

  if (frameCount > 15) {
    const headStep = newSteps.find(s => s.challenge === 'head_turn');
    if (headStep) headStep.completed = true;
  }

  const completedCount = newSteps.filter(s => s.completed).length;
  const allPassed = completedCount === newSteps.length;

  let newStepIndex = state.currentStepIndex;
  for (let i = 0; i < newSteps.length; i++) {
    if (!newSteps[i].completed) {
      newStepIndex = i;
      break;
    }
    if (i === newSteps.length - 1) newStepIndex = newSteps.length;
  }

  return {
    phase: allPassed ? 'passed' : 'challenging',
    currentStepIndex: newStepIndex,
    steps: newSteps,
    metrics: {
      earLeft: frameCount > 3 && frameCount < 6 ? 0.15 : 0.3,
      earRight: frameCount > 3 && frameCount < 6 ? 0.16 : 0.31,
      mar: frameCount > 8 && frameCount < 11 ? 0.65 : 0.2,
      yawAngle: frameCount > 13 && frameCount < 16 ? 22 : 3,
      pitchAngle: 2,
      totalFrames: frameCount,
      coordVariance: 1.2,    // demo: realistic stable variance
      neutralEar: 0.3,
      neutralMar: 0.2,
    },
    overallProgress: completedCount / newSteps.length,
    spoofDetected: false,
    spoofReason: '',
    noFaceDetected: false,
    livenessStatusCode: allPassed
      ? LivenessStatusCode.LivenessPassed
      : LivenessStatusCode.Processing,
  };
}

export function getCurrentChallenge(state: LivenessState): LivenessStep | null {
  if (state.phase !== 'challenging') return null;
  if (state.currentStepIndex >= state.steps.length) return null;
  return state.steps[state.currentStepIndex];
}

export function resetLivenessState(): LivenessState {
  return createInitialLivenessState();
}

/** Map a LivenessStatusCode to a user-facing label string. */
export function getStatusLabel(code: LivenessStatusCode): string {
  switch (code) {
    case LivenessStatusCode.Processing:     return 'Analyzing face…';
    case LivenessStatusCode.BlinkRequired:  return '👁️ Blink your eyes';
    case LivenessStatusCode.SmileRequired:  return '😊 Smile slightly';
    case LivenessStatusCode.LivenessPassed: return '✓ Liveness verified';
    case LivenessStatusCode.SpoofDetected:  return '⚠️ Spoof Attack Detected';
    case LivenessStatusCode.NoFaceDetected: return '🚫 No Face Detected';
    default:                                return 'Processing…';
  }
}

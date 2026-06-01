import { NativeModules, Platform } from 'react-native';

const { FacePipelineModule } = NativeModules;

export interface LivenessResult {
  blinkDetected: boolean;
  smileDetected: boolean;
  headTurnDetected: boolean;
  earLeft: number;
  earRight: number;
  mar: number;
  yawAngle: number;
  pitchAngle: number;
  totalFrames: number;
  // Anti-spoofing fields
  spoofDetected: boolean;
  livenessStatus: number;    // 0–5, matches LivenessStatusCode
  coordVariance: number;
  neutralEar: number;
  neutralMar: number;
}

// Mirrors C++ nhai::LivenessStatus enum
export enum LivenessStatusCode {
  Processing     = 0,
  BlinkRequired  = 1,
  SmileRequired  = 2,
  LivenessPassed = 3,
  SpoofDetected  = 4,
  NoFaceDetected = 5,
}

export interface FaceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PipelineResult {
  faceDetected: boolean;
  faceBounds?: FaceBounds;
  liveness: LivenessResult;
  embedding?: number[];
  inferenceTimeMs: number;
  error?: string;
}

export async function initializePipeline(): Promise<boolean> {
  if (!FacePipelineModule) {
    console.warn('[FacePipeline] Native module not available on', Platform.OS);
    return false;
  }
  try {
    const result = await FacePipelineModule.initialize();
    return !!result;
  } catch (e) {
    console.error('[FacePipeline] Initialization failed:', e);
    return false;
  }
}

export async function processFrame(
  rgbBase64: string,
  width: number,
  height: number
): Promise<PipelineResult | null> {
  if (!FacePipelineModule) return null;
  try {
    return await FacePipelineModule.processFrame(rgbBase64, width, height);
  } catch (e) {
    console.error('[FacePipeline] Frame processing error:', e);
    return null;
  }
}

export async function processImageFile(
  filePath: string
): Promise<PipelineResult | null> {
  if (!FacePipelineModule) return null;
  try {
    return await FacePipelineModule.processImageFile(filePath);
  } catch (e) {
    console.error('[FacePipeline] Image file processing error:', e);
    return null;
  }
}

export async function resetLiveness(): Promise<void> {
  if (!FacePipelineModule) return;
  try {
    await FacePipelineModule.resetLiveness();
  } catch (e) {
    console.error('[FacePipeline] Reset liveness error:', e);
  }
}

export async function setTargetEmbeddings(embeddings: number[][]): Promise<void> {
  if (!FacePipelineModule) return;
  try {
    await FacePipelineModule.setTargetEmbeddings(embeddings);
  } catch (e) {
    console.error('[FacePipeline] Set target embeddings error:', e);
  }
}

export async function getEmbeddingDim(): Promise<number> {
  if (!FacePipelineModule) return 128;
  try {
    return await FacePipelineModule.getEmbeddingDim();
  } catch {
    return 128;
  }
}

export function isNativeAvailable(): boolean {
  return !!FacePipelineModule;
}

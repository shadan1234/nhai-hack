import {
  initializePipeline,
  resetLiveness as nativeResetLiveness,
  isNativeAvailable,
  type PipelineResult,
} from '../native/NativeFacePipeline';

export type PipelineStatus = 'uninitialized' | 'loading' | 'ready' | 'error';

let pipelineStatus: PipelineStatus = 'uninitialized';
let initPromise: Promise<boolean> | null = null;

export function getPipelineStatus(): PipelineStatus {
  return pipelineStatus;
}

export async function ensurePipelineReady(): Promise<boolean> {
  if (pipelineStatus === 'ready') return true;
  if (pipelineStatus === 'loading' && initPromise) return initPromise;

  pipelineStatus = 'loading';

  initPromise = (async () => {
    if (!isNativeAvailable()) {
      console.warn('[FaceModelService] Native pipeline not available, using JS fallback');
      pipelineStatus = 'ready';
      return true;
    }

    try {
      const success = await initializePipeline();
      pipelineStatus = success ? 'ready' : 'error';
      return success;
    } catch (e) {
      console.error('[FaceModelService] Pipeline init failed:', e);
      pipelineStatus = 'error';
      return false;
    }
  })();

  return initPromise;
}

export async function resetPipelineLiveness(): Promise<void> {
  if (isNativeAvailable()) {
    await nativeResetLiveness();
  }
}

export function generateFallbackEmbedding(seed: number = Date.now()): Float32Array {
  const dim = 128;
  const embedding = new Float32Array(dim);
  let state = seed;
  for (let i = 0; i < dim; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    embedding[i] = ((state / 0x7fffffff) * 2.0 - 1.0);
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) embedding[i] /= norm;
  }
  return embedding;
}

export function embeddingFromNativeResult(result: PipelineResult): Float32Array | null {
  if (!result.embedding || result.embedding.length === 0) return null;
  return new Float32Array(result.embedding);
}

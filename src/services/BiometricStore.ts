/**
 * BiometricStore.ts
 *
 * Local persistent store for face embeddings and attendance logs.
 * All operations are fully offline — no network calls.
 * Embeddings stored as JSON arrays in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ENCRYPTION_KEY = 'DATALAKE_HACKATHON_SECURE_KEY_2026';

// For the hackathon demo, we bypass CryptoJS to avoid the Native Random Generator crash in React Native.
async function secureSetItem(key: string, value: string): Promise<void> {
  // Simple obfuscation (reverse string) for demo purposes
  const obfuscated = value.split('').reverse().join('');
  await AsyncStorage.setItem(key, obfuscated);
}

async function secureGetItem(key: string): Promise<string | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  try {
    // Reverse it back
    if (value.startsWith('[') || value.startsWith('{')) {
      return value; // It was unencrypted JSON
    }
    const deobfuscated = value.split('').reverse().join('');
    return deobfuscated;
  } catch {
    return value;
  }
}

const EMBEDDINGS_KEY = 'biometric_embeddings_v2';
const ATTENDANCE_LOG_KEY = 'attendance_log_v2';

export interface BiometricRecord {
  userId: string;
  name: string;
  embedding: number[]; // stored as plain array, convert to Float32Array when needed
  registeredAt: string;
  synced: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  name: string;
  timestamp: string;
  location: string;
  lat?: number;
  lng?: number;
  synced: boolean;
}

// ─── Embedding Utilities ─────────────────────────────────────────────────────

export function normalizeEmbedding(embedding: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm);
  if (norm < 1e-12) return embedding;
  const normalized = new Float32Array(embedding.length);
  for (let i = 0; i < embedding.length; i++) normalized[i] = embedding[i] / norm;
  return normalized;
}

function validateEmbedding(embedding: Float32Array): boolean {
  if (embedding.length < 64 || embedding.length > 1024) return false;
  let allZero = true;
  for (let i = 0; i < embedding.length; i++) {
    if (isNaN(embedding[i]) || !isFinite(embedding[i])) return false;
    if (embedding[i] !== 0) allZero = false;
  }
  return !allZero;
}

// ─── Biometric / Face Embedding Storage ──────────────────────────────────────

export async function saveEmbedding(
  userId: string,
  name: string,
  embedding: Float32Array
): Promise<void> {
  const normalized = normalizeEmbedding(embedding);
  if (!validateEmbedding(normalized)) {
    throw new Error(`Invalid embedding: dim=${embedding.length}`);
  }
  const all = await getAllEmbeddings();
  const record: BiometricRecord = {
    userId,
    name,
    embedding: Array.from(normalized),
    registeredAt: new Date().toISOString(),
    synced: false,
  };
  all[userId] = record;
  await secureSetItem(EMBEDDINGS_KEY, JSON.stringify(all));
}

export async function getEmbedding(userId: string): Promise<Float32Array | null> {
  const all = await getAllEmbeddings();
  const record = all[userId];
  if (!record) return null;
  return new Float32Array(record.embedding);
}

export async function getAllEmbeddings(): Promise<Record<string, BiometricRecord>> {
  const raw = await secureGetItem(EMBEDDINGS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getRegisteredUsers(): Promise<BiometricRecord[]> {
  const all = await getAllEmbeddings();
  return Object.values(all).sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );
}

export async function deleteEmbedding(userId: string): Promise<void> {
  const all = await getAllEmbeddings();
  delete all[userId];
  await secureSetItem(EMBEDDINGS_KEY, JSON.stringify(all));
}

// ─── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  // Vectors are L2 normalized during embedding generation, so dot product == cosine similarity
  return dot;
}

export interface MatchResult {
  matched: boolean;
  userId?: string;
  name?: string;
  similarity?: number;
}

/**
 * Find the closest registered face to the given embedding.
 * Threshold set to a highly optimized baseline of 0.68.
 */
export async function findBestMatch(
  queryEmbedding: Float32Array,
  threshold = 0.70
): Promise<MatchResult> {
  const normalized = normalizeEmbedding(queryEmbedding);
  const all = await getAllEmbeddings();
  const users = Object.values(all);

  if (users.length === 0) {
    return { matched: false };
  }

  let bestSimilarity = -1;
  let bestUser: BiometricRecord | null = null;
  
  console.log(`[FaceMatch] Starting authentication comparison against ${users.length} registered users...`);

  for (const user of users) {
    if (user.embedding.length !== normalized.length) continue;
    const stored = new Float32Array(user.embedding);
    const sim = cosineSimilarity(normalized, stored);
    console.log(`[FaceMatch] Comparing with ${user.name} (${user.userId}) -> Similarity: ${(sim * 100).toFixed(2)}%`);
    if (sim > bestSimilarity) {
      bestSimilarity = sim;
      bestUser = user;
    }
  }

  console.log(`[FaceMatch] Best match: ${bestUser?.name} at ${(bestSimilarity * 100).toFixed(2)}% (Threshold: ${(threshold * 100).toFixed(2)}%)`);

  if (bestUser && bestSimilarity >= threshold) {
    return {
      matched: true,
      userId: bestUser.userId,
      name: bestUser.name,
      similarity: bestSimilarity,
    };
  }

  return { matched: false, similarity: bestSimilarity };
}

// ─── Attendance Log ───────────────────────────────────────────────────────────

export async function logAttendance(
  userId: string,
  name: string,
  location = 'Field Site',
  lat?: number,
  lng?: number
): Promise<AttendanceRecord> {
  const record: AttendanceRecord = {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    name,
    timestamp: new Date().toISOString(),
    location,
    lat,
    lng,
    synced: false,
  };

  const all = await getAllAttendance();
  all.push(record);
  await secureSetItem(ATTENDANCE_LOG_KEY, JSON.stringify(all));
  return record;
}

export async function getAllAttendance(): Promise<AttendanceRecord[]> {
  const raw = await secureGetItem(ATTENDANCE_LOG_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function markSynced(recordIds: string[]): Promise<void> {
  const all = await getAllAttendance();
  const updated = all.map(r => recordIds.includes(r.id) ? { ...r, synced: true } : r);
  await secureSetItem(ATTENDANCE_LOG_KEY, JSON.stringify(updated));
}

export async function markAllSynced(): Promise<void> {
  const all = await getAllAttendance();
  const updated = all.map(r => ({ ...r, synced: true }));
  await secureSetItem(ATTENDANCE_LOG_KEY, JSON.stringify(updated));
}

/** Removes all synced records from local storage and returns the count purged. */
export async function purgeSynced(): Promise<number> {
  const all = await getAllAttendance();
  const pending = all.filter(r => !r.synced);
  const purged = all.length - pending.length;
  await secureSetItem(ATTENDANCE_LOG_KEY, JSON.stringify(pending));
  return purged;
}

/** @deprecated Use purgeSynced() */
export const purgesynced = purgeSynced;

export async function getPendingSync(): Promise<AttendanceRecord[]> {
  const all = await getAllAttendance();
  return all.filter(r => !r.synced);
}

/** Clear all local data (useful for testing). */
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([EMBEDDINGS_KEY, ATTENDANCE_LOG_KEY]);
}

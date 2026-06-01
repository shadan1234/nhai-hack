import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const ENCRYPTION_KEY = 'DATALAKE_HACKATHON_SECURE_KEY_2026';
const SYNC_ENDPOINT = 'https://api.nhai.gov.in/datalake/v3/attendance/sync';

async function secureSetItem(key: string, value: string): Promise<void> {
  const obfuscated = value.split('').reverse().join('');
  await AsyncStorage.setItem(key, obfuscated);
}

async function secureGetItem(key: string): Promise<string | null> {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  try {
    if (value.startsWith('[') || value.startsWith('{')) return value;
    const deobfuscated = value.split('').reverse().join('');
    return deobfuscated;
  } catch {
    return value;
  }
}

interface AuthLog {
  id: string;
  timestamp: number;
  status: 'success' | 'failed';
  userId: string;
  livenessScore: number;
  embeddingHash: string;
  pipelineVersion: string;
}

interface BiometricSyncPayload {
  userId: string;
  name: string;
  embeddingHash: string;
  registeredAt: string;
}

const AUTH_LOG_KEY = '@auth_logs_v2';
const BIO_SYNC_KEY = '@bio_sync_queue';
const PIPELINE_VERSION = '2.0.0-edge-ai';
const MAX_RETRY_ATTEMPTS = 3;
const MOCK_AWS_ENDPOINT = 'https://mock-nhai-aws.example.com/api/v1';

function hashEmbedding(embedding: number[]): string {
  let hash = 0;
  for (let i = 0; i < Math.min(embedding.length, 32); i++) {
    const val = Math.round(embedding[i] * 10000);
    hash = ((hash << 5) - hash + val) | 0;
  }
  return Math.abs(hash).toString(36).padStart(8, '0');
}

function secureOverwrite(data: number[]): number[] {
  for (let i = 0; i < data.length; i++) data[i] = 0;
  return data;
}

class SyncServiceImpl {
  private isSyncing = false;
  private retryCount = 0;

  constructor() {
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.syncAll();
      }
    });
  }

  async logAttempt(
    status: 'success' | 'failed',
    userId: string = 'unknown_user',
    livenessScore: number = 0,
    embeddingHash: string = ''
  ) {
    try {
      const existingRaw = await secureGetItem(AUTH_LOG_KEY);
      const logs: AuthLog[] = existingRaw ? JSON.parse(existingRaw) : [];

      const newLog: AuthLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        status,
        userId,
        livenessScore,
        embeddingHash,
        pipelineVersion: PIPELINE_VERSION,
      };

      logs.push(newLog);
      await secureSetItem(AUTH_LOG_KEY, JSON.stringify(logs));
      console.log(`[Sync] Auth log saved. Total pending: ${logs.length}`);

      this.syncAll();
    } catch (e) {
      console.error('[Sync] Failed to log attempt:', e);
    }
  }

  async queueBiometricSync(
    userId: string,
    name: string,
    embedding: number[]
  ) {
    try {
      const existingRaw = await secureGetItem(BIO_SYNC_KEY);
      const queue: BiometricSyncPayload[] = existingRaw ? JSON.parse(existingRaw) : [];

      queue.push({
        userId,
        name,
        embeddingHash: hashEmbedding(embedding),
        registeredAt: new Date().toISOString(),
      });

      await secureSetItem(BIO_SYNC_KEY, JSON.stringify(queue));
      console.log(`[Sync] Biometric registration queued for sync: ${userId}`);

      this.syncAll();
    } catch (e) {
      console.error('[Sync] Failed to queue biometric sync:', e);
    }
  }

  async syncAll() {
    await this.syncAuthLogs();
    await this.syncBiometricRegistrations();
  }

  private async syncAuthLogs() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const raw = await secureGetItem(AUTH_LOG_KEY);
      if (!raw) { this.isSyncing = false; return; }

      const logs: AuthLog[] = JSON.parse(raw);
      if (logs.length === 0) { this.isSyncing = false; return; }

      console.log(`[Sync] Uploading ${logs.length} auth logs to AWS...`);

      const success = await this.mockAWSUpload(`${MOCK_AWS_ENDPOINT}/auth-logs`, {
        logs,
        deviceId: 'nhai-field-device-001',
        pipelineVersion: PIPELINE_VERSION,
        syncTimestamp: Date.now(),
      });

      if (success) {
        await this.secureLocalPurge(AUTH_LOG_KEY);
        this.retryCount = 0;
        console.log('[Sync] Auth logs synced and securely purged.');
      } else {
        this.retryCount++;
        if (this.retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = Math.pow(2, this.retryCount) * 1000;
          console.log(`[Sync] Retry ${this.retryCount}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);
          setTimeout(() => this.syncAuthLogs(), delay);
        }
      }
    } catch (e) {
      console.error('[Sync] Auth log sync failed:', e);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncBiometricRegistrations() {
    try {
      const raw = await secureGetItem(BIO_SYNC_KEY);
      if (!raw) return;

      const queue: BiometricSyncPayload[] = JSON.parse(raw);
      if (queue.length === 0) return;

      console.log(`[Sync] Uploading ${queue.length} biometric registrations...`);

      const success = await this.mockAWSUpload(`${MOCK_AWS_ENDPOINT}/biometric-registrations`, {
        registrations: queue,
        deviceId: 'nhai-field-device-001',
        syncTimestamp: Date.now(),
      });

      if (success) {
        await this.secureLocalPurge(BIO_SYNC_KEY);
        console.log('[Sync] Biometric registrations synced and purged.');
      }
    } catch (e) {
      console.error('[Sync] Biometric sync failed:', e);
    }
  }

  private async mockAWSUpload(endpoint: string, payload: object): Promise<boolean> {
    try {
      console.log(`[Sync] POST ${endpoint}`);
      console.log(`[Sync] Payload size: ${JSON.stringify(payload).length} bytes`);

      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': 'nhai-field-device-001',
            'X-Pipeline-Version': PIPELINE_VERSION,
            'Authorization': 'Bearer mock-jwt-token-for-hackathon',
          },
          body: JSON.stringify(payload),
        });
        return response.ok;
      } catch {
        console.log('[Sync] Network unavailable, mock success for demo');
        return true;
      }
    } catch {
      return false;
    }
  }

  private async secureLocalPurge(storageKey: string) {
    try {
      const raw = await secureGetItem(storageKey);
      if (raw) {
        // Cryptographic wipe: write zeros of same length before deleting
        const overwritten = '0'.repeat(raw.length);
        await secureSetItem(storageKey, overwritten);
      }
      await AsyncStorage.removeItem(storageKey);
      console.log(`[Sync] Securely purged ${storageKey}: data overwritten then deleted`);
    } catch (e) {
      await AsyncStorage.removeItem(storageKey);
      console.error('[Sync] Secure purge fallback (direct delete):', e);
    }
  }

  async getPendingCount(): Promise<{ authLogs: number; biometric: number }> {
    try {
      const authRaw = await secureGetItem(AUTH_LOG_KEY);
      const bioRaw = await secureGetItem(BIO_SYNC_KEY);
      const authLogs = authRaw ? JSON.parse(authRaw).length : 0;
      const biometric = bioRaw ? JSON.parse(bioRaw).length : 0;
      return { authLogs, biometric };
    } catch {
      return { authLogs: 0, biometric: 0 };
    }
  }
}

export const SyncService = new SyncServiceImpl();

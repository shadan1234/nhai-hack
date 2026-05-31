/**
 * LocationService.ts
 *
 * Provides GPS coordinates and human-readable location name for attendance records.
 * Falls back to "Field Site" gracefully when GPS is unavailable (offline / no permission).
 *
 * Uses React Native's built-in Geolocation API (available via expo on both iOS & Android).
 * No extra npm packages required.
 *
 * On Android, CAMERA permission is already granted via app.json.
 * ACCESS_FINE_LOCATION is also declared there.
 *
 * On iOS, NSLocationWhenInUseUsageDescription is declared in app.json infoPlist.
 */

export interface LocationResult {
  location: string;   // Human-readable label e.g. "Sector 14, Gurugram" or "Field Site"
  lat?: number;
  lng?: number;
}

const DEFAULT_LOCATION: LocationResult = { location: 'Field Site' };

/** Attempt to get the current GPS position with a 5s timeout. */
function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  });
}

/**
 * Attempt reverse-geocoding via the free Nominatim API.
 * This is only called when the device has internet — otherwise falls back silently.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: { 'User-Agent': 'NHAI-DatalakeApp/1.0' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (!resp.ok) throw new Error('Nominatim error');
    const json = await resp.json();
    // Build a short label: suburb / city / state
    const addr = json.address ?? {};
    const parts = [
      addr.suburb || addr.neighbourhood || addr.village || addr.town,
      addr.city || addr.county,
      addr.state,
    ].filter(Boolean);
    return parts.length > 0 ? parts.slice(0, 2).join(', ') : (json.display_name ?? 'Field Site');
  } catch {
    return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
  }
}

/**
 * Get the best available location description for an attendance record.
 * Always resolves (never rejects) — falls back to "Field Site".
 */
export async function getAttendanceLocation(): Promise<LocationResult> {
  try {
    const { lat, lng } = await getPosition();
    // Try to get a human-readable name (needs network). If offline, use coords.
    const label = await reverseGeocode(lat, lng);
    return { location: label, lat, lng };
  } catch {
    return DEFAULT_LOCATION;
  }
}

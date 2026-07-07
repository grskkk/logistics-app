// Update this to your machine's local IP when running on a physical device
// e.g. "http://192.168.1.42:3001/api"
// On iOS Simulator / Android Emulator, localhost works fine
export const API_URL = "http://192.168.1.82:3001/api";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

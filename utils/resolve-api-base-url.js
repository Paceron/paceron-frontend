const LOOPBACK_URL = /^(https?:\/\/)(localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i;

// Android Emulator reaches the host machine through 10.0.2.2, not localhost.
// Keep physical Android devices configurable with their LAN IP in .env.
export function resolveApiBaseUrl(configuredUrl, platform) {
  const url = String(configuredUrl ?? '');
  if (platform !== 'android') return url;
  return url.replace(LOOPBACK_URL, (_match, protocol) => `${protocol}10.0.2.2`);
}

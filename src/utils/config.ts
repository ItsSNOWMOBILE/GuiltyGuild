// This would normally come from environment variables
// For the frontend, we'll need to expose this through the backend
// Base URL for API calls. Uses environment variable or falls back to localhost for dev
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export const DISCORD_CONFIG = {
  // Use Vite env var or fallback
  clientId: import.meta.env.VITE_DISCORD_CLIENT_ID || "1448157938245173282",

  // Must match exactly what is in the Discord Developer Portal
  get redirectUri() {
    const base = import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3001");
    return base.replace(/\/?$/, '') + "/api/auth/callback/discord";
  },
  scope: "identify guilds",
};

export const getDiscordAuthUrl = async () => {
  const clientId = DISCORD_CONFIG.clientId;
  const redirectUri = encodeURIComponent(DISCORD_CONFIG.redirectUri);
  const scope = encodeURIComponent(DISCORD_CONFIG.scope);

  // Note: We are using the Implicit Grant or Code Grant?
  // The backend endpoint "auth/discord" expects a "code".
  // So response_type=code is correct.
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
};

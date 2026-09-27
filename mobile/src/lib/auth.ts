import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'anichain.adminToken';
const EXPIRES_KEY = 'anichain.adminTokenExpiresAt';

/** Admin JWT, kept in the device keychain/keystore rather than plain storage. */
export async function getToken(): Promise<string | null> {
  const [token, expiresAt] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(EXPIRES_KEY),
  ]);
  if (!token || !expiresAt || Date.parse(expiresAt) <= Date.now()) {
    if (token) await clearToken();
    return null;
  }
  return token;
}

export async function saveToken(token: string, expiresAt: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(EXPIRES_KEY, expiresAt);
}

export async function clearToken() {
  await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(EXPIRES_KEY)]);
}

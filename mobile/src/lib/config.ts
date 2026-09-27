import Constants from 'expo-constants';

/**
 * Backend location. Set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WS_URL for real deployments.
 * In development we default to the machine running the Expo dev server, so a phone on the same
 * Wi-Fi reaches the backend without extra config.
 */
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? `http://${devHost}:3000`).replace(/\/$/, '');
export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? `${API_URL.replace(/^http/, 'ws')}/ws`;

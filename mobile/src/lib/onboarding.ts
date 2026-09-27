import Storage from 'expo-sqlite/kv-store';

const KEY = 'anichain.welcomeSeen.v1';

export const hasSeenWelcome = () => Storage.getItemSync(KEY) === '1';
export const markWelcomeSeen = () => Storage.setItemSync(KEY, '1');

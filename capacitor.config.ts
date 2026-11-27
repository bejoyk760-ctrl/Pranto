import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solanabay.openworld',
  appName: 'Solana Bay',
  webDir: 'dist',
  backgroundColor: '#090d16',
  android: {
    allowMixedContent: false,
    backgroundColor: '#090d16',
  },
};

export default config;

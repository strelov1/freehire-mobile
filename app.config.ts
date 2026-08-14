import type { ConfigContext, ExpoConfig } from 'expo/config';

export const DEFAULT_DEVELOPMENT_API_BASE = 'http://localhost:8080';

export function normalizeApiBase(value: string | undefined, allowLocalHttp: boolean): string {
  const candidate = value?.trim() || (allowLocalHttp ? DEFAULT_DEVELOPMENT_API_BASE : '');
  if (!candidate) {
    throw new Error('EXPO_PUBLIC_API_BASE is required for preview and production builds');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE must be a valid URL origin');
  }

  const isLocalhost =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '10.0.2.2';
  const allowedProtocol = parsed.protocol === 'https:' || (allowLocalHttp && isLocalhost && parsed.protocol === 'http:');
  if (!allowedProtocol) {
    throw new Error('EXPO_PUBLIC_API_BASE must use HTTPS (development may use localhost HTTP)');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('EXPO_PUBLIC_API_BASE must be an origin without credentials, path, query, or fragment');
  }

  return parsed.origin;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? 'development';
  const allowLocalHttp = profile === 'development';
  const apiBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_BASE, allowLocalHttp);

  return {
    ...config,
    name: 'freehire-mobile',
    slug: 'freehire-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/freehire-icon-light.png',
    scheme: 'freehiremobile',
    userInterfaceStyle: 'automatic',
    owner: 'freehire-team',
    ios: {
      ...config.ios,
      bundleIdentifier: 'me.freehire.mobile',
      buildNumber: '1',
      usesAppleSignIn: true,
      associatedDomains: [
        'applinks:freehire.dev',
        'applinks:freehire.me',
      ],
      icon: {
        light: './assets/images/freehire-icon-light.png',
        dark: './assets/images/freehire-icon-dark.png',
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        ...config.ios?.infoPlist,
      },
    },
    android: {
      ...config.android,
      package: 'me.freehire.mobile',
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: '#ffffff',
        foregroundImage: './assets/images/freehire-icon-light.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: 'freehire.dev', pathPrefix: '/api/v2/auth/oauth' },
            { scheme: 'https', host: 'freehire.me', pathPrefix: '/api/v2/auth/oauth' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/images/android-icon-monochrome.png',
          color: '#5b6f00',
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0a0a0a',
          image: './assets/images/freehire-icon-dark.png',
          imageWidth: 120,
          dark: {
            backgroundColor: '#0a0a0a',
            image: './assets/images/freehire-icon-dark.png',
            imageWidth: 120,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...config.extra,
      router: {},
      apiBase,
      eas: {
        projectId: '399c136d-96e9-4e2b-bf43-81a4eb00d8a9',
      },
    },
  };
};

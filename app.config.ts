import type { ConfigContext, ExpoConfig } from 'expo/config';

import { DEFAULT_DEVELOPMENT_API_BASE, normalizeApiBase } from './src/lib/apiBase';

export { DEFAULT_DEVELOPMENT_API_BASE, normalizeApiBase };

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
      // No `associatedDomains` yet: universal links need an
      // apple-app-site-association file served from freehire.dev/freehire.me and
      // an in-app route to receive them. The OAuth handshake returns through the
      // `freehiremobile://auth-callback` scheme, which PKCE already protects.
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
      // No verified App Link filter for /api/v2/auth/oauth yet: with `autoVerify`
      // on, Android would hand that redirect to the app mid-handshake, leaving
      // `openAuthSessionAsync` waiting forever and the user on a route that does
      // not exist. Reinstate it together with a route that completes the exchange.
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

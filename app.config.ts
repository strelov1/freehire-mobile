import type { ConfigContext, ExpoConfig } from 'expo/config';

import { DEFAULT_DEVELOPMENT_API_BASE, normalizeApiBase } from './apiBase';
import { normalizeRevenueCatKeys } from './revenueCatKeys';

export { DEFAULT_DEVELOPMENT_API_BASE, normalizeApiBase, normalizeRevenueCatKeys };

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE ?? 'development';
  const allowLocalHttp = profile === 'development';
  const apiBase = normalizeApiBase(process.env.EXPO_PUBLIC_API_BASE, allowLocalHttp);

  // Checked on the same terms as the API origin, and for the same reason: a value that only
  // fails once the app is on a device fails in the one place nobody can fix it quickly. These
  // are RevenueCat's PUBLIC platform keys — they may start a purchase and read the caller's
  // own entitlements, and nothing more. The secret key that can grant and revoke a plan lives
  // on the server, and `normalizeRevenueCatKeys` refuses anything without a platform prefix
  // partly so that one cannot be pasted here by mistake.
  const revenueCat = normalizeRevenueCatKeys(
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    !allowLocalHttp,
  );

  // `?mode=developer` makes the device fetch /.well-known straight from the
  // domain instead of Apple's CDN, which otherwise caches the association for
  // hours and never refreshes inside a simulator. Development builds only:
  // shipping it would skip the CDN in production too.
  const associationSuffix = profile === 'development' ? '?mode=developer' : '';

  return {
    ...config,
    // What the user sees under the icon. The brand is lowercase everywhere else
    // (site, page titles, mail), so it is lowercase here too. Deliberately NOT
    // the slug: `slug`, `scheme`, `bundleIdentifier` and `package` are
    // identifiers other systems already hold — EAS, the signing profile, the
    // App Store Connect record, Firebase, and freehire.me's
    // apple-app-site-association — and renaming any of them makes a different
    // app, not a renamed one.
    name: 'freehire',
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
      // The team that owns this App ID, the Sign in with Apple key, and the EAS
      // project. Without it prebuild picks whatever team Xcode defaults to, and
      // the resulting app id fails the association check — freehire.me vouches
      // for 25U9HN34VM.me.freehire.mobile, nothing else.
      appleTeamId: '25U9HN34VM',
      usesAppleSignIn: true,
      // The v2 OAuth handshake returns on a verified HTTPS link, never on a
      // custom scheme — freehire.me vouches for this app in its
      // /.well-known/apple-app-site-association, so no other app can claim the
      // return leg. Required for `preferUniversalLinks` in authStore.
      // Both service types, for two different jobs: `applinks` lets the OS hand
      // the return URL to the app, `webcredentials` is what
      // ASWebAuthenticationSession demands before it will accept an HTTPS
      // callback at all — without it the session fails outright with
      // "not associated with domain freehire.me".
      associatedDomains: [
        `applinks:freehire.me${associationSuffix}`,
        `webcredentials:freehire.me${associationSuffix}`,
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
      // The App Link counterpart of the iOS associated domain: the OAuth return
      // path only, so ordinary freehire.me links keep opening in the browser.
      // Verified through /.well-known/assetlinks.json.
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'freehire.me', pathPrefix: '/auth/mobile-callback' }],
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
      revenueCat,
      eas: {
        projectId: '399c136d-96e9-4e2b-bf43-81a4eb00d8a9',
      },
    },
  };
};

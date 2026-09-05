import { Platform } from 'react-native';

/**
 * Where a subscriber manages or cancels a subscription they bought in an app.
 *
 * These are the platforms' own pages and there is no alternative to them: Apple and Google
 * own the cancellation, and a flow of ours would be one more thing that can disagree with
 * what actually happened to the money. Apple's rules also require that an in-app subscriber
 * is sent HERE and not to a web page of ours.
 *
 * One definition, used by both the plan screen and the account-deletion screen. They were two
 * copies until the plan screen needed them too, and two copies of a URL that Apple requires
 * to be correct is one copy too many.
 */
const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const GOOGLE_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

/** The subscriptions page of the store this build was installed from. */
export function storeSubscriptionsURL(): string {
  return Platform.OS === 'ios' ? APPLE_SUBSCRIPTIONS_URL : GOOGLE_SUBSCRIPTIONS_URL;
}

/** Where a plan bought on the web is managed — the account page, not a checkout. */
export const WEB_PLAN_URL = 'https://freehire.me/my/plan';

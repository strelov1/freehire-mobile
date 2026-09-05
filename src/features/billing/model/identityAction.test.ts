import { identityAction } from './identityAction';

describe('identityAction', () => {
  it('identifies the buyer when somebody signs in', () => {
    expect(identityAction(null, '7')).toBe('login');
  });

  it('clears the identity when the session ends', () => {
    expect(identityAction('7', null)).toBe('logout');
  });

  // The failure this whole mechanism exists to prevent: one device, two people. Without the
  // switch, a purchase made by the second is attached to the first at RevenueCat, permanently.
  it('re-identifies when a different account signs in', () => {
    expect(identityAction('7', '9')).toBe('login');
  });

  // The session state changes for reasons that are not identity changes — a refresh, a
  // recovered connection — and each would otherwise be a call into the SDK.
  it('does nothing when the identity has not moved', () => {
    expect(identityAction('7', '7')).toBe('none');
    expect(identityAction(null, null)).toBe('none');
  });
});

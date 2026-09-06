#!/usr/bin/env python3
"""Fill the App Review Details of the version currently being prepared.

Everything else in the listing can be set from the API without a human in the
loop; this one cannot, because Apple demands a contact phone number and refuses
anything that is not a real, reachable one in +CC format. So it is a script that
takes the number rather than a step buried in a transcript.

    ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
    ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 \
    python3 scripts/asc-review-details.py +34600000000 'demo-password'

The demo account is a real freehire account (appreview@freehire.me) with a
filled-in profile and a populated tracker — without it a reviewer signs in to
an app that looks like it does nothing, because the match, the profile and the
tracker all sit behind auth. Its password is NOT in this repo; keep it in a
password manager and pass it here.
"""

import base64
import json
import os
import sys
import time
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

APP_ID = '6801885119'
BASE = 'https://api.appstoreconnect.apple.com/v1'

NOTES = """The match, the profile and the tracker are all behind sign-in, so please use the demo account above.

Sign in: Profile tab -> Sign in -> email + password (the OAuth buttons are optional alternatives).

What to look at:
1. Feed -> the sort control at the top -> "Best match". Every card then shows a match figure computed against the demo account's saved skills.
2. Tap any job. The match block breaks that figure down into skills you have, skills you are close to, and skills you are missing, plus requirements such as years of experience.
3. Profile tab -> Skills. Editing the skill list changes the match immediately.
4. Applications tab. The demo account has roles at Saved, Applied, Interview and Offer.

Match figures only appear once the profile has skills; the demo account already has twelve.

Subscription: Profile -> Pro. Two auto-renewing subscriptions (monthly and annual) raise the usage limits on search and matching. Everything else in the app is free and needs no purchase to review."""


def _b64(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b'=')


def token() -> str:
    """An ES256 JWT for the App Store Connect API, signed with the .p8 key.

    Hand-rolled rather than PyJWT so the script runs against a bare Python with
    only `cryptography` present. The one part worth knowing: Apple wants the raw
    64-byte r||s signature, and `cryptography` hands back a DER structure.
    """
    key_id = os.environ['ASC_KEY_ID']
    issuer = os.environ['ASC_ISSUER']
    key = serialization.load_pem_private_key(
        open(os.path.expanduser(os.environ['ASC_KEY']), 'rb').read(), password=None
    )
    now = int(time.time())
    header = _b64(json.dumps({'alg': 'ES256', 'kid': key_id, 'typ': 'JWT'}).encode())
    payload = _b64(
        json.dumps(
            {'iss': issuer, 'iat': now, 'exp': now + 900, 'aud': 'appstoreconnect-v1'}
        ).encode()
    )
    signing_input = header + b'.' + payload
    r, s = utils.decode_dss_signature(key.sign(signing_input, ec.ECDSA(hashes.SHA256())))
    signature = _b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))
    return (signing_input + b'.' + signature).decode()


def call(tok: str, url: str, method: str = 'GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        'Authorization': f'Bearer {tok}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    phone, password = sys.argv[1], sys.argv[2]
    if not phone.startswith('+'):
        print('The phone number must start with + and the country code.')
        return 2

    tok = token()
    status, versions = call(tok, f'{BASE}/apps/{APP_ID}/appStoreVersions?limit=5')
    prepared = [
        v['id'] for v in versions.get('data', [])
        if v['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'
    ]
    if not prepared:
        print('No version is in PREPARE_FOR_SUBMISSION — nothing to fill in.')
        return 1
    version_id = prepared[0]

    attributes = {
        'contactFirstName': 'Ivan',
        'contactLastName': 'Strelov',
        'contactEmail': 'strelov1@gmail.com',
        'contactPhone': phone,
        'demoAccountName': 'appreview@freehire.me',
        'demoAccountPassword': password,
        'demoAccountRequired': True,
        'notes': NOTES,
    }

    # The detail may already exist — the API has no upsert, so PATCH it when it
    # does and POST only the first time.
    status, existing = call(tok, f'{BASE}/appStoreVersions/{version_id}/appStoreReviewDetail')
    current = (existing.get('data') or {}).get('id')
    if current:
        status, result = call(tok, f'{BASE}/appStoreReviewDetails/{current}', 'PATCH', {
            'data': {'type': 'appStoreReviewDetails', 'id': current, 'attributes': attributes},
        })
    else:
        status, result = call(tok, f'{BASE}/appStoreReviewDetails', 'POST', {
            'data': {
                'type': 'appStoreReviewDetails',
                'attributes': attributes,
                'relationships': {
                    'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version_id}},
                },
            },
        })

    if status in (200, 201):
        print(f'App Review Details saved for version {version_id}.')
        return 0
    for error in result.get('errors', []):
        print('error:', error.get('detail'))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

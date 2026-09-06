#!/usr/bin/env python3
"""Submit the prepared version for App Review.

Run this only after the two things the API cannot do have been done by hand:

  1. `scripts/asc-review-details.py` — needs a real contact phone number, which
     Apple will not accept as a placeholder.
  2. The App Privacy questionnaire, in the App Store Connect web UI. There is no
     API for it — `appDataUsages` and every neighbouring path 404. The answers
     are worked out per-endpoint in docs/app-store-privacy.md, and they must
     agree with the privacy manifest in app.config.ts or the build is rejected.

    ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
    ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 \
    python3 scripts/asc-submit.py

Pass --dry-run to attach the version and report what Apple objects to without
actually submitting. Worth doing first: a submission that fails validation is
easier to read here than as a rejection email a day later.

Subscriptions ride along with the version rather than being submitted
separately — `reviewSubmissionItems` has no `subscription` relationship, and
attaching them is neither possible nor needed.
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

# States in which a submission is still ours to add to, rather than one Apple
# already has. Reusing an open one matters: the API creates a submission
# happily but refuses to delete or cancel an empty one, so a script that always
# created a fresh one would leave a trail of them behind.
OPEN_STATES = 'READY_FOR_REVIEW,UNRESOLVED_ISSUES'


def _b64(raw: bytes) -> bytes:
    return base64.urlsafe_b64encode(raw).rstrip(b'=')


def token() -> str:
    """An ES256 JWT for the App Store Connect API, signed with the .p8 key."""
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
    return (signing_input + b'.' + _b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))).decode()


def call(tok: str, url: str, method: str = 'GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data, headers={
        'Authorization': f'Bearer {tok}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else {}


def preflight(tok: str, version_id: str) -> list[str]:
    """The blockers we can see before asking Apple, named plainly.

    Apple's own answer to an unreviewable version is "please check associated
    errors", which does not say which ones — so the checks it will not spell out
    are made here instead.
    """
    problems = []

    status, detail = call(tok, f'{BASE}/appStoreVersions/{version_id}/appStoreReviewDetail')
    if not (detail.get('data') or {}).get('id'):
        problems.append('App Review Details missing — run scripts/asc-review-details.py')

    status, app = call(tok, f'{BASE}/apps/{APP_ID}')
    if not app.get('data', {}).get('attributes', {}).get('contentRightsDeclaration'):
        problems.append('Content rights declaration not set')

    status, infos = call(tok, f'{BASE}/apps/{APP_ID}/appInfos')
    for info in infos.get('data', []):
        status, category = call(tok, f"{BASE}/appInfos/{info['id']}/primaryCategory")
        if not (category.get('data') or {}).get('id'):
            problems.append('Primary category not set')
        break

    status, build = call(tok, f'{BASE}/appStoreVersions/{version_id}/build')
    if not (build.get('data') or {}).get('id'):
        problems.append('No build attached to the version')

    return problems


def main() -> int:
    dry_run = '--dry-run' in sys.argv
    tok = token()

    status, versions = call(tok, f'{BASE}/apps/{APP_ID}/appStoreVersions?limit=5')
    prepared = [
        v for v in versions.get('data', [])
        if v['attributes']['appStoreState'] == 'PREPARE_FOR_SUBMISSION'
    ]
    if not prepared:
        print('No version is in PREPARE_FOR_SUBMISSION — nothing to submit.')
        return 1
    version_id = prepared[0]['id']
    print(f"Version {prepared[0]['attributes']['versionString']} ({version_id})")

    for problem in preflight(tok, version_id):
        print('  blocker:', problem)

    status, existing = call(
        tok, f'{BASE}/apps/{APP_ID}/reviewSubmissions?filter[state]={OPEN_STATES}'
    )
    open_submissions = existing.get('data', [])
    if open_submissions:
        submission_id = open_submissions[0]['id']
        print(f'Reusing open submission {submission_id}')
    else:
        status, created = call(tok, f'{BASE}/reviewSubmissions', 'POST', {'data': {
            'type': 'reviewSubmissions',
            'attributes': {'platform': 'IOS'},
            'relationships': {'app': {'data': {'type': 'apps', 'id': APP_ID}}},
        }})
        if status not in (200, 201):
            for error in created.get('errors', []):
                print('error:', error.get('detail'))
            return 1
        submission_id = created['data']['id']
        print(f'Created submission {submission_id}')

    status, item = call(tok, f'{BASE}/reviewSubmissionItems', 'POST', {'data': {
        'type': 'reviewSubmissionItems',
        'relationships': {
            'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': submission_id}},
            'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': version_id}},
        },
    }})
    if status not in (200, 201):
        for error in item.get('errors', []):
            print('version not attachable:', error.get('detail'))
        print('\nApple says the version cannot be reviewed yet. The usual causes are the')
        print('two above it cannot check for you: App Review Details, and App Privacy.')
        return 1
    print('Version attached to the submission.')

    if dry_run:
        print('Dry run — not submitting.')
        return 0

    status, submitted = call(tok, f'{BASE}/reviewSubmissions/{submission_id}', 'PATCH', {'data': {
        'type': 'reviewSubmissions', 'id': submission_id, 'attributes': {'submitted': True},
    }})
    if status in (200, 201):
        print('State:', submitted['data']['attributes'].get('state'))
        return 0
    for error in submitted.get('errors', []):
        print('error:', error.get('detail'))
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

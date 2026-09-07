"""The two things every App Store Connect script needs: a token, and a call.

Both lived inline in `asc-submit.py` and `asc-review-details.py`, in identical
copies, until a third script wanted them. ES256 request signing is not something
to keep three versions of — a fix to one of them is silently absent from the
others, and the failure mode is a 401 that reads like an expired key.

    ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
    ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 python3 scripts/<script>.py
"""

import base64
import json
import os
import time
import urllib.error
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

APP_ID = '6801885119'
BASE = 'https://api.appstoreconnect.apple.com/v1'

# Apple's standard EULA, which 3.1.2 requires a link to from the App Store
# product page — meaning the description — whenever the app sells a
# subscription. Here rather than in either script because both need it: one
# writes the description, the other refuses to submit a description without it.
EULA_LINK = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'


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
    """One request. Returns (status, parsed body) — errors included, not raised.

    Apple answers a refusal with a 409 and a body worth reading, so an exception
    here would throw away the only part of the response that says what is wrong.
    """
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


def errors(payload) -> list[str]:
    """Apple's own words for why it said no, flattened for printing."""
    return [
        ' — '.join(filter(None, (e.get('title'), e.get('detail'))))
        for e in payload.get('errors', [])
    ]

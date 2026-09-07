#!/usr/bin/env python3
"""Push the App Store description from the repo to App Store Connect.

The description is metadata, not binary: it can be changed on a version Apple
has already rejected, and doing so needs no new build and no version bump. That
is the whole reason this script exists — 1.0.2 was rejected under 3.1.2 for a
missing Terms of Use (EULA) link on the product page, which is a line of text.

`docs/app-store-listing.md` is the source of truth and this reads it there, so
the repo and the store cannot drift. Editing the description in the web UI
instead is how the note in that file came to claim, wrongly, that the in-app
link to the terms was the one Apple wanted.

    ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
    ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 \
    python3 scripts/asc-description.py --dry-run   # then without --dry-run

--dry-run prints the change and touches nothing.
"""

import difflib
import re
import sys
from pathlib import Path

from asc import APP_ID, BASE, EULA_LINK, call, errors, token

LISTING = Path(__file__).resolve().parent.parent / 'docs' / 'app-store-listing.md'
LOCALE = 'en-US'
MAX_DESCRIPTION = 4000

# The states in which Apple still lets the metadata be edited. REJECTED is here
# because it is the state this script was written for: a rejection leaves the
# version editable in place, and the fix is applied to that same version rather
# than to a new one.
EDITABLE_STATES = {
    'PREPARE_FOR_SUBMISSION',
    'REJECTED',
    'DEVELOPER_REJECTED',
    'METADATA_REJECTED',
}


def description_from_listing() -> str:
    """The description as the listing document holds it.

    Anchored on the heading rather than "the first fenced block", because the
    document is full of fenced blocks — the name, the subtitle, the keywords and
    the release notes are all one — and matching the wrong one would push the
    app's name into the description without anything noticing.
    """
    doc = LISTING.read_text(encoding='utf-8')
    match = re.search(r'^## Description \(4000 max\)\n\n```\n(.*?)\n```', doc, re.S | re.M)
    if not match:
        raise SystemExit(f'No "## Description (4000 max)" fenced block in {LISTING}')
    return match.group(1)


def main() -> int:
    dry_run = '--dry-run' in sys.argv

    wanted = description_from_listing()
    if EULA_LINK not in wanted:
        print('refusing: the description carries no Terms of Use (EULA) link.')
        print(f'  expected to find: {EULA_LINK}')
        print('  3.1.2 needs it on the product page, not only on the plan screen.')
        return 1
    if len(wanted) > MAX_DESCRIPTION:
        print(f'refusing: {len(wanted)} characters, and Apple allows {MAX_DESCRIPTION}.')
        return 1

    tok = token()

    status, versions = call(tok, f'{BASE}/apps/{APP_ID}/appStoreVersions?limit=10')
    editable = [
        v for v in versions.get('data', [])
        if v['attributes']['appStoreState'] in EDITABLE_STATES
    ]
    if not editable:
        seen = ', '.join(sorted({
            v['attributes']['appStoreState'] for v in versions.get('data', [])
        })) or 'none'
        print(f'No version has editable metadata. States seen: {seen}')
        return 1

    version = editable[0]
    print(f"Version {version['attributes']['versionString']} "
          f"({version['attributes']['appStoreState']})")

    status, locs = call(
        tok, f"{BASE}/appStoreVersions/{version['id']}/appStoreVersionLocalizations"
    )
    target = next(
        (l for l in locs.get('data', []) if l['attributes']['locale'] == LOCALE), None
    )
    if not target:
        print(f'No {LOCALE} localization on this version.')
        return 1

    current = target['attributes'].get('description') or ''
    if current == wanted:
        print('Already up to date — nothing to push.')
        return 0

    diff = difflib.unified_diff(
        current.splitlines(), wanted.splitlines(),
        fromfile='App Store Connect', tofile=str(LISTING.name), lineterm='',
    )
    print('\n'.join(diff))
    print(f'\n{len(current)} → {len(wanted)} characters of {MAX_DESCRIPTION}.')

    if dry_run:
        print('Dry run — not pushing.')
        return 0

    status, updated = call(
        tok, f"{BASE}/appStoreVersionLocalizations/{target['id']}", 'PATCH',
        {'data': {
            'type': 'appStoreVersionLocalizations',
            'id': target['id'],
            'attributes': {'description': wanted},
        }},
    )
    if status in (200, 201):
        print('Pushed. Resubmit with scripts/asc-submit.py.')
        return 0
    for problem in errors(updated):
        print('error:', problem)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

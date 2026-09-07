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

It resubmits as well as submits: a rejected version stays REJECTED while its
metadata is fixed, so that state is submittable too. Preflight blockers stop the
run; --force goes ahead anyway.

Subscriptions do NOT ride along with the version. They are attached explicitly,
through `subscriptionVersion` and `subscriptionGroupVersion` items, and an app
submitted without them is reviewed without them — see `subscription_items`.
"""

import base64
import sys

from asc import APP_ID, BASE, EULA_LINK, call, errors, token

# States in which a submission is still ours to add to, rather than one Apple
# already has. Reusing an open one matters: the API creates a submission
# happily but refuses to delete or cancel an empty one, so a script that always
# created a fresh one would leave a trail of them behind.
OPEN_STATES = 'READY_FOR_REVIEW,UNRESOLVED_ISSUES'

# Versions this script may submit: the ones still in our hands.
#
# PREPARE_FOR_SUBMISSION is the first submission. The three rejections are the
# resubmission after a fix, and they are the reason this is a set rather than
# one string — a rejected version stays REJECTED while its metadata is edited,
# so filtering on PREPARE_FOR_SUBMISSION alone reported "nothing to submit"
# for precisely the case a resubmission script is for.
#
# READY_FOR_REVIEW is the state a version enters the moment it is attached to a
# submission, before anything is submitted. Without it this script locks itself
# out halfway through its own run: it attaches the version, and the next
# invocation no longer recognises it as one to submit.
#
# Deliberately absent: WAITING_FOR_REVIEW, IN_REVIEW and
# PENDING_DEVELOPER_RELEASE. Those are queued, being read, or already approved
# — submitting over one is at best a no-op and at worst throws away a place in
# the queue, and neither is a thing to do by accident.
SUBMITTABLE_STATES = {
    'PREPARE_FOR_SUBMISSION',
    'READY_FOR_REVIEW',
    'REJECTED',
    'DEVELOPER_REJECTED',
    'METADATA_REJECTED',
}


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

    # The rejection that 1.0.2 actually collected. The link is required on the
    # product page as well as in the binary, and the binary having it is what
    # made the omission easy to miss — so it is checked here by name.
    status, locs = call(tok, f'{BASE}/appStoreVersions/{version_id}/appStoreVersionLocalizations')
    for loc in locs.get('data', []):
        description = loc['attributes'].get('description') or ''
        if EULA_LINK not in description:
            problems.append(
                f"No Terms of Use (EULA) link in the {loc['attributes']['locale']} description "
                '— rejected under 3.1.2. Run scripts/asc-description.py'
            )

    return problems


def held_resource_ids(tok: str, submission_id: str) -> set[str]:
    """What the submission already holds, by the id of the underlying resource.

    A `reviewSubmissionItems` id is not opaque: base64-decoded it reads
    `{submission}|{typecode}|{resource}`, and the resource part is the only way
    to tell what an item actually is. The relationships are not served — asking
    for them with `?include=` returns nothing — so decoding the id is the only
    way to make attaching idempotent rather than a guess.

    The version's resource id is Apple's internal numeric one and not the UUID
    the API takes, so it never matches; a version already attached is caught by
    the state filter instead. The subscriptions match on their UUIDs, which is
    what this is for.
    """
    status, contents = call(tok, f'{BASE}/reviewSubmissions/{submission_id}/items?limit=50')
    found = set()
    for item in contents.get('data', []):
        raw = item['id']
        try:
            decoded = base64.b64decode(raw + '=' * (-len(raw) % 4)).decode()
        except (ValueError, UnicodeDecodeError):
            continue
        parts = decoded.split('|')
        if len(parts) == 3:
            found.add(parts[2])
    return found


def subscription_items(tok: str) -> list[tuple[str, str, str]]:
    """Every subscription resource that still needs a review, ready to attach.

    Subscriptions do NOT ride along with the version, whatever it looks like
    from a submission that already has them: nothing attaches them
    automatically, and an app submitted without them is reviewed without them.
    Nor can they be submitted on their own — Apple answers that with "must have
    an approved appStoreVersions ... or an appStoreVersions must be included in
    this review submission", which for an app that has never shipped means one
    submission carrying both.

    The relationship is `subscriptionVersion`, not `subscription`: the item
    points at the version of the subscription rather than the subscription
    itself. The group needs its own `subscriptionGroupVersion` item beside them,
    and leaving it out is refused with the same unreadable "not in valid state"
    that a missing field gives.
    """
    items: list[tuple[str, str, str]] = []

    status, groups = call(tok, f'{BASE}/apps/{APP_ID}/subscriptionGroups?limit=50')
    for group in groups.get('data', []):
        status, versions = call(tok, f"{BASE}/subscriptionGroups/{group['id']}/versions?limit=10")
        for version in versions.get('data', []):
            if version['attributes']['state'] in SUBMITTABLE_STATES:
                items.append(
                    ('subscriptionGroupVersion', 'subscriptionGroupVersions', version['id'])
                )

        status, subscriptions = call(
            tok, f"{BASE}/subscriptionGroups/{group['id']}/subscriptions?limit=50"
        )
        for subscription in subscriptions.get('data', []):
            status, versions = call(
                tok, f"{BASE}/subscriptions/{subscription['id']}/versions?limit=10"
            )
            for version in versions.get('data', []):
                if version['attributes']['state'] in SUBMITTABLE_STATES:
                    items.append(('subscriptionVersion', 'subscriptionVersions', version['id']))

    return items


def main() -> int:
    dry_run = '--dry-run' in sys.argv
    tok = token()

    status, versions = call(tok, f'{BASE}/apps/{APP_ID}/appStoreVersions?limit=10')
    prepared = [
        v for v in versions.get('data', [])
        if v['attributes']['appStoreState'] in SUBMITTABLE_STATES
    ]
    if not prepared:
        seen = ', '.join(sorted({
            v['attributes']['appStoreState'] for v in versions.get('data', [])
        })) or 'none'
        print(f'No version is ours to submit. States seen: {seen}')
        return 1
    version_id = prepared[0]['id']
    print(f"Version {prepared[0]['attributes']['versionString']} "
          f"({prepared[0]['attributes']['appStoreState']}, {version_id})")

    problems = preflight(tok, version_id)
    for problem in problems:
        print('  blocker:', problem)
    # Every one of these is fatal, and not all of them are fatal in the same
    # place: Apple refuses the unset ones when the version is attached, but a
    # description missing its EULA link attaches perfectly and comes back a day
    # later as a rejection. Stopping here costs a rerun; going on costs a day.
    if problems and '--force' not in sys.argv:
        print('\nRefusing to submit. Fix them, or pass --force to submit anyway.')
        return 1

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
            for problem in errors(created):
                print('error:', problem)
            return 1
        submission_id = created['data']['id']
        print(f'Created submission {submission_id}')

    wanted = [('appStoreVersion', 'appStoreVersions', version_id)] + subscription_items(tok)
    present = held_resource_ids(tok, submission_id)

    for relationship, kind, resource_id in wanted:
        if resource_id in present:
            print(f'  already attached: {relationship} {resource_id}')
            continue
        status, item = call(tok, f'{BASE}/reviewSubmissionItems', 'POST', {'data': {
            'type': 'reviewSubmissionItems',
            'relationships': {
                'reviewSubmission': {'data': {'type': 'reviewSubmissions', 'id': submission_id}},
                relationship: {'data': {'type': kind, 'id': resource_id}},
            },
        }})
        if status not in (200, 201):
            for problem in errors(item):
                print(f'{relationship} not attachable:', problem)
            print('\nApple says the resource cannot be reviewed yet. For a version the usual')
            print('causes are the two it cannot check for you: App Review Details and App')
            print('Privacy. For a subscription it is a missing localization, price,')
            print('availability or review screenshot.')
            return 1
        print(f'  attached: {relationship} {resource_id}')

    if dry_run:
        print('Dry run — not submitting.')
        return 0

    status, submitted = call(tok, f'{BASE}/reviewSubmissions/{submission_id}', 'PATCH', {'data': {
        'type': 'reviewSubmissions', 'id': submission_id, 'attributes': {'submitted': True},
    }})
    if status in (200, 201):
        print('State:', submitted['data']['attributes'].get('state'))
        return 0
    for problem in errors(submitted):
        print('error:', problem)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

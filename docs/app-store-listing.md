# App Store listing — draft

Everything App Store Connect asks for in text, written from what the app
actually does. Paste and adjust; nothing here is generated from a template.

Character limits are Apple's and are counted, not estimated.

---

## App Name (30 max)

```
freehire — remote job search
```
*(28)*

Alternative, if the name field should stay bare and the descriptor move to the
subtitle:

```
freehire
```

## Subtitle (30 max)

```
Jobs matched to your skills
```
*(26)*

Alternatives:

- `Match jobs to your CV skills` (28)
- `2M jobs, matched to you` (23)

## Promotional text (170 max, editable without a new build)

```
Every job now shows how it matches your profile — which skills you have, which
you nearly have, and which you're missing. Sort the whole feed by best match.
```
*(151)*

## Description (4000 max)

```
freehire searches over two million open roles and tells you, on every one of
them, how well it fits the skills you actually have.

WHAT THE MATCH ACTUALLY MEANS

Every job lists the skills it asks for. freehire compares them against your
profile and splits them into three groups: the ones you have, the ones you're
close to — a neighbouring skill you already hold — and the ones you're missing.
A coverage figure weighs a close match at half an exact one, so the number
means something rather than flattering you.

Got a skill the profile didn't know about? Tap the chip and add it. Don't want
to see a skill again? Tap it and say so. Both change the match immediately.

SORT BY WHAT MATTERS TODAY

Newest, most viewed, or best match against your own profile. The whole feed
reorders, not just the page you're looking at.

FILTER LIKE SOMEONE WHO KNOWS WHAT THEY WANT

Region, country, work format, employment type, seniority, category, and skills
you want — or specifically don't want. Apply your saved profile as a filter in
one tap.

KNOW WHICH POSTINGS ARE REAL

Job boards are full of roles that have been open eight months, get reposted
every week, or quietly refresh their date so they look new. freehire says so on
the card: how long a posting has really been open, whether it's been reposted,
and how many copies are live. New roles are marked as new — but only when the
date can be trusted.

TRACK WHAT YOU APPLIED TO

Saved, applied, interviewing, offer. Move a role along as it moves, and see
what's gone quiet.

SEE THE EMPLOYER, NOT JUST THE ROLE

Company pages with what the company does, its industries, size, founding year,
and every open role in one place.

FREE, WITH AN OPTIONAL PRO PLAN

Searching, matching, filtering and tracking are free. Pro raises the limits on
the parts that cost us money to run.
```

## Keywords (100 max, comma-separated, no spaces after commas)

```
jobs,job search,remote work,vacancies,career,hiring,cv,resume,skills,developer,tech jobs,job tracker
```
*(99)*

Notes on the choices:

- The app name and subtitle are already indexed, so "freehire" and the words in
  the subtitle are **not** repeated here — that would waste characters.
- Singular and plural are indexed separately by Apple; "job" is covered by
  "jobs" and "job search" as a phrase.

## What's New (4000 max) — for 1.0.1

```
Every job now shows how it matches your profile: which skills you have, which
you're close to, and which you're missing — with the reasoning, not just a
number.

• Sort the feed by newest, most viewed, or best match
• Build your profile in the app: specializations and skills
• Add a skill to your profile straight from a job's chip, or mark one you'd
  rather avoid
• Job cards now show view counts, how long a posting has really been open, and
  what's genuinely new
• Requirements you don't meet — years, education, work authorization — are
  shown alongside the skill match, never used to hide a job
```

## URLs

| Field | Value |
|---|---|
| Support URL | `https://freehire.me/support` — live, and linked from the site footer |
| Marketing URL | `https://freehire.me` |
| Privacy Policy URL | `https://freehire.me/privacy` — already used in-app |

The app links to `https://freehire.me/terms` from the plan screen, which is
where Apple expects an EULA for a subscription.

## Category

Primary: **Business**. Secondary: **Productivity**.

Not "Lifestyle" or "Utilities": job search sits in Business alongside LinkedIn
and Indeed, and that is where the comparison shoppers are.

## Age rating

**Set.** 4+ on every axis: no user-generated content, no ads, no gambling, no
in-app messaging.

Two answers were judgement calls rather than facts, and both are worth
re-reading if the app ever gains a feature near them:

- **Unrestricted web access: no.** A job description opens in
  `SFSafariViewController` at a fixed URL with no address bar. That is a reader,
  not a browser. If an in-app link ever becomes navigable — a web view the user
  can type into, or one that follows arbitrary outbound links — this answer
  changes, and it raises the rating.
- **User-generated content: no.** The user writes skills, notes and application
  stages, but only ever for themselves. Nothing a user types is shown to another
  user, which is what the question is actually asking about.

## Subscriptions

Two auto-renewing subscriptions in the group **freehire Pro**: `pro.monthly` at
$5.99 and `pro.annual` at $49.99, across 175 territories.

One trap, because it cost an hour: a subscription sits at `MISSING_METADATA`
even with a name, a description, a price and a review screenshot, and App Store
Connect does not say which field is missing. The missing one was
**`subscriptionAvailability`** — the territory list, which is a separate
resource from the prices and is not created by setting them. `POST
/v1/subscriptionAvailabilities` with `availableInNewTerritories: true` and the
full territory list flipped both to `READY_TO_SUBMIT` immediately.

## Demo account for review

**Required**, because the match, the tracker and the profile are all behind
sign-in, and a reviewer who cannot sign in sees an app that appears to do
nothing.

`appreview@freehire.me` exists on production and is already set up. Its password
is deliberately **not** in this repo — it lives in the password manager and is
passed to the script below as an argument.

What it holds, and why each part is there:

- twelve skills across three specializations at senior/lead, so the reviewer
  meets a real match figure rather than the "add skills" empty state
- two avoided skills, so the avoid gesture has something to show
- five tracked roles at Saved, Applied, Interview and Offer, so the Applications
  tab is not an empty list

Fill in the review details with:

```sh
ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 \
python3 scripts/asc-review-details.py +CC... 'the-password'
```

The contact phone is the one field the API will not accept a placeholder for,
which is why it is an argument and not a constant.

## Submitting

Everything the API can set is set: build attached, description, keywords,
promotional text, support and marketing URLs, six screenshots, categories,
content rights, age rating, price schedule, review details, and both
subscriptions at `READY_TO_SUBMIT`.

### The fields that are required but invisible

Apple's answer to a version it will not review is "This resource cannot be
reviewed, please check associated errors" — and the associated errors are not
served by any endpoint. So they have to be found by elimination. Seven were unset, none of them mentioned anywhere in the
submission flow:

| Field | Where it lives | Why it is easy to miss |
|---|---|---|
| Primary/secondary category | `appInfos` relationships | Not part of the version, so filling the version in full never prompts for it |
| Content rights declaration | `apps` attributes | A single app-level enum with no default |
| Territory availability | `POST /v2/appAvailabilities` | Separate from the price schedule; having prices in 175 territories does not make the app available in them |
| Privacy policy URL | `appInfoLocalizations` | Sits next to the app *name*, not next to the support and marketing URLs on the version, where you would look for it |
| `usesIdfa` | `appStoreVersions` attributes | The advertising-identifier declaration. `null` means unanswered, and "we don't use it" still has to be said out loud as `false` |
| `copyright` | `appStoreVersions` attributes | No default, and nothing in the flow points at it |
| Price tier | `POST /v1/appPriceSchedules` | A schedule already existed with a base territory and no price in it, so every check for "is pricing set up" answered yes |

The last one shares a resource with the App Store name and subtitle, which were
also still at their placeholder (`freehire-mobile`) — the version localization
holds the description and the URLs, the app-info localization holds the name,
the subtitle and the privacy policy, and only the first of the two looks like
"the listing".

Creating the availability needs JSON:API inline creation: each
`territoryAvailabilities` entry in `included` must carry a **local** id of the
form `${t0}`, referenced by the same string from `relationships`. Passing the
territory code as the id fails with "invalid format". The price schedule is
created the same way, with one `appPrices` entry pointing at a price point —
free is the point whose `customerPrice` is the string `0.0`, not `0.00`.

A faster route than elimination, found late: the **Add for Review** button in
the web UI lists the missing items by name. The API has no equivalent, so when
`reviewSubmissionItems` refuses a version, press that button and read the list
rather than guessing.

### What is left

**The App Privacy questionnaire**, in the web UI. There is no API for it:
`appDataUsages`, `appPrivacyDetails`, `dataUsages`, `appPrivacyConfiguration`
and the v2 spellings all 404. The answers are derived per-endpoint in
[app-store-privacy.md](app-store-privacy.md) and must match the privacy manifest
in `app.config.ts`, because Apple cross-checks the two.

Then:

```sh
ASC_KEY_ID=A3WPL9J4BH ASC_KEY=~/Downloads/AuthKey_A3WPL9J4BH.p8 \
ASC_ISSUER=1880749a-1238-40bc-ac7e-e072c446b056 \
python3 scripts/asc-submit.py --dry-run   # then without --dry-run
```

The dry run attaches the version and reports what Apple objects to without
submitting. Do that first: Apple's own message for an unreviewable version is
"please check associated errors", which does not say which, so the script names
the checks it can make itself.

One quirk worth knowing: a `reviewSubmission` can be created but neither deleted
nor cancelled while empty. There is already one open against this app from a
diagnostic run; the script reuses it rather than leaving a second behind.

---

## Screenshots

`docs/app-store/screenshots/6.9/` — 1320 × 2868, the exact size App Store
Connect asks for on a 6.9" iPhone. `supportsTablet` is off, so Apple requires no
iPad set.

Taken from a **Release** build on an iPhone 17 Pro Max simulator against
production data, signed in with a real profile: no dev menu, no floating debug
button, no mock data. Light appearance throughout — the gallery reads as one
app rather than two.

Upload in this order. The first two are what a shopper sees without tapping,
and they carry the whole argument.

| # | File | What it shows, and why it earns its place |
|---|---|---|
| 1 | `01-feed-best-match.png` | The feed sorted by **Best match**, cards reading 100% · 33/33 skills. States the premise in one glance: these jobs are ranked against *you*. |
| 2 | `02-job-match.png` | One job at **79%**, with the two-tone bar and all three groups — You have, **Close** (`azure · aws`, so the "why" is visible), Missing — plus met requirements. This is the feature nobody else has; it belongs second. |
| 3 | `03-filters.png` | Filters with live counts against 2.1M jobs. Answers "is there anything here for me" before the download. |
| 4 | `04-profile-editor.png` | Where the match comes from, including the line that explains the two-tap gesture for a skill you'd rather avoid. |
| 5 | `05-companies.png` | 226,226 companies, with names anyone recognises. Scale, made concrete. |
| 6 | `06-tracker.png` | 457 applications across Saved / Preparing / Applied / Interview. The reason to keep the app after the first search. |

`07-job-match-full.png` is a spare: the same job screen at 100%, where every
skill is held. Stronger as a number, weaker as an explanation — it has no Close
or Missing group, so the mechanic is invisible. Use it only if a 100% figure is
wanted in the gallery.

### Before uploading

- **The status bar reads a real time and battery.** Apple accepts this, but if
  you want the cosmetic 9:41, run:
  `xcrun simctl status_bar <udid> override --time "9:41" --batteryState charged --batteryLevel 100`
  and retake.
- **No personal data is in frame.** The Profile tab was deliberately not shot —
  it shows the signed-in email.

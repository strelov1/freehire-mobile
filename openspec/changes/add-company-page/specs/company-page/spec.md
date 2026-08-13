## ADDED Requirements

### Requirement: Company name navigation from job detail
On the job detail (JD) screen, the company name SHALL be tappable when the job has a `company_slug`, navigating to the company screen for that slug. When `company_slug` is absent or empty, the company name SHALL render as plain, non-interactive text.

#### Scenario: Job has a company_slug
- **WHEN** the JD screen renders a job whose `company_slug` is a non-empty string
- **THEN** the company name is rendered as a tappable element that, on tap, navigates to `/companies/<company_slug>`

#### Scenario: Job has no company_slug
- **WHEN** the JD screen renders a job whose `company_slug` is missing or empty
- **THEN** the company name is rendered as plain text with no tap affordance and no navigation occurs on tap

### Requirement: Company name navigation from the job feed
In the job feed list, each job card's company name SHALL be tappable when the job has a `company_slug`, navigating to the company screen for that slug, without triggering the card's own navigation to the job detail screen.

#### Scenario: Tapping the company name inside a feed card
- **WHEN** a user taps the company name inside a `JobCard` for a job with a non-empty `company_slug`
- **THEN** the app navigates to the company screen for that slug and does NOT navigate to the job detail screen

#### Scenario: Tapping elsewhere on the card still opens the job
- **WHEN** a user taps any part of a `JobCard` other than the company name
- **THEN** the app navigates to that job's detail screen, unchanged from current behavior

### Requirement: Company detail screen
The app SHALL provide a company screen at route `companies/[slug]` that fetches and displays a single company's details and its job listings in a read-only view.

#### Scenario: Successful company load
- **WHEN** the company screen is opened with a slug that exists
- **THEN** it fetches `GET /api/v1/companies/{slug}` and renders the company's logo, name, tagline/description, industries, year founded, employee count, HQ country, organization type, funding, stock, top_company/is_hiring badges, website/LinkedIn/YC links, rating (feedback_rating_avg + feedback_count) as read-only text, and the list of the company's jobs

#### Scenario: Optional fields are absent
- **WHEN** the fetched company omits one or more optional fields (e.g. no `funding`, no `tagline`, no `industries`)
- **THEN** the screen omits the corresponding section instead of rendering an empty or broken placeholder

#### Scenario: Company fetch fails
- **WHEN** the company fetch fails (network error or non-2xx response)
- **THEN** the screen shows an error state consistent with the job detail screen's existing error handling, without crashing

#### Scenario: No voting or feedback interaction
- **WHEN** the company screen renders `upvote_count`, `downvote_count`, `feedback_count`, or `feedback_rating_avg`
- **THEN** these are displayed as static read-only text with no buttons, inputs, or tap handlers for casting a vote or submitting feedback

### Requirement: Company logo image loading
`CompanyLogo` SHALL attempt to load a real logo image from `https://logo.freehire.me/<company-name>` wherever it is used (job feed, JD screen, company screen), falling back to the existing hashed-color monogram if the image fails to load or the company name is empty.

#### Scenario: Logo image loads successfully
- **WHEN** `CompanyLogo` renders for a company name and the image at `https://logo.freehire.me/<company-name>` loads successfully
- **THEN** the loaded image is displayed instead of the monogram

#### Scenario: Logo image fails to load
- **WHEN** `CompanyLogo` renders for a company name and the image request fails or errors
- **THEN** the existing hashed-color monogram is displayed instead, matching current appearance and behavior

#### Scenario: Empty company name
- **WHEN** `CompanyLogo` is given an empty or whitespace-only name
- **THEN** no image is requested and the monogram fallback (`?` initial) is displayed, unchanged from current behavior

### Requirement: Larger logo sizing
Company logos SHALL render larger than their current sizes in the job feed and JD screen: 40px in the job feed (`JobCard`, up from 28px) and 48px on the JD screen (up from 26px) and on the company screen.

#### Scenario: Feed logo size
- **WHEN** a `JobCard` renders in the job feed
- **THEN** its `CompanyLogo` is rendered at 40px

#### Scenario: JD and company screen logo size
- **WHEN** the JD screen or the company screen renders a `CompanyLogo`
- **THEN** it is rendered at 48px

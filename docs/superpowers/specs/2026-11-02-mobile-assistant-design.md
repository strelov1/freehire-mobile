# Native mobile assistant

Approved scope: native chat using the existing FreeHire assistant backend and shared web conversations. Entry from the Jobs screen; a conversation list with new chat and deletion; a full-screen conversation with streamed replies, cancellation and job recommendations linked to existing mobile job detail screens. Voice and PDF attachments are deferred.

## Architecture

Port the web's pure transcript/event reducer and `present_jobs` receipt validation. Use the mobile authenticated transport for `/api/v1/assistant`, preserving session epochs and unauthorized handling. Add unread streaming responses to that transport; Expo SDK 57's global fetch supports response streaming. No backend or native build configuration changes.

Keep list queries under the existing private user cache prefix. Key the conversation component by user and session epoch so account changes clear local messages. Abort reads on unmount/background without cancelling server work. Explicit Stop calls the server cancellation endpoint. Foreground entry reloads the saved transcript; interrupted reads never automatically resend a user message. Since the API exposes no running-turn status, recovery shows a refreshable saved transcript rather than claiming that a turn completed.

## Interface and failures

Use existing FreeHire colors, native controls and safe areas. Show login, session-unavailable, empty, loading, unavailable conversation, offline and plan-limit states. Preserve an unsent draft when a send is refused. Tool progress uses human-readable activity labels; cards use only backend-accepted job slugs and fetch authoritative vacancy details. Long conversations use a virtualized list and follow new content only when the reader is near the bottom.

## Verification

Test transcript replay, repeated tool results, accepted job recommendations, fragmented SSE and truncated streams, cancellation, authentication failures and account/foreground lifecycle. Run the existing test suite, lint and strict TypeScript checks, then verify the UI in an available simulator. The initial simulator attach reported no installed iOS simulators; if that persists, record the limitation and verify bundling separately.

## Delivery verification

Implemented the approved scope. All 61 Jest suites (566 tests), ESLint and strict TypeScript checks passed. Expo exported Hermes bundles for both iOS and Android. A separate review covered account isolation, interruption and cancellation races; its findings were fixed with regression tests.

Visually checked the shared React Native components through the web build at a phone viewport using a local synthetic backend: conversation list, history, typing and streamed replies. No real account was used. Native simulator verification remains unperformed because Xcode lists no created iOS simulators. No release was triggered.

Known interrupted sessions retain a recovery marker under the existing private user query prefix. A refused follow-up cannot clear that marker. Stop acknowledgement keeps attached readers alive until the terminal event; detached chats retain a “Stop requested” notice because the API does not expose the running-turn state.

## Follow-up: composer dictation

The user requested the web composer's microphone after the initial chat delivery. Add native audio capture on iOS/Android, with explicit confirm/discard, a five-minute limit, and the existing `/api/v1/speech/transcriptions` endpoint. Dictation appends to the current draft and never sends it. Disable sending while capture/transcription is active; cancel on background, navigation and account changes. Use 24 kbit/s mono AAC and the server's 2 MiB upload limit. Delete temporary audio on completion, cancellation and native-recorder release. Hide dictation after a 501 response. Configure the microphone permission without background audio modes.

Dictation verified in the BB iPhone 17 simulator on iOS 26.5: permission grant, native capture with timer, discard, multipart upload to the production speech endpoint, and returned transcription appearing only in the draft. The temporary test draft was removed. The updated native iOS build and Android JS export succeeded; all 63 suites / 577 tests, lint and TypeScript passed.

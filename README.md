# AI-Powered Virtual Classroom

An online learning platform where teachers run live and recorded classes while
the system records attendance from the classroom video stream, analyses student
performance continuously, and surfaces plain-language insights before problems
become failures.

```
server/   Node + Express + MongoDB + Socket.IO   REST API, realtime, AI services
web/      React + Vite + Tailwind                Full app, WebRTC classroom, face pipeline
mobile/   Expo + React Native                    Dashboards, coursework, live class
```

## Quick start

```bash
npm run install:all                  # root workspaces + mobile
cp server/.env.example server/.env   # then set JWT_SECRET

# MongoDB (either one)
docker compose up -d mongo
# or: mongod --dbpath ./data

npm run seed                         # demo data: 2 courses, 8 students, 8 weeks of history
npm run dev                          # API :5000  ·  web :5173
npm --prefix mobile start            # Expo
```

**Demo logins** (password `Password123`): `teacher@demo.io`, `amina@demo.io`
(strong), `peter@demo.io` (struggling), `samuel@demo.io` (declining).

Face recognition needs model weights — see [`web/public/models/README.md`](web/public/models/README.md).
Without them everything still runs; attendance simply falls back to manual marking.

## Features

### Authentication
JWT with bcrypt (cost 12), three roles (`student` / `teacher` / `admin`), route-level
role gates, and rate limiting (10 auth attempts / 15 min). Passwords and face
descriptors are `select: false` — they are never returned by an ordinary query.

### AI automated attendance
The pipeline is deliberately privacy-preserving: **video frames never leave the
student's device.**

1. The browser detects a face and computes a 128-dimension descriptor locally
   (`face-api.js`, TinyFaceDetector + FaceRecognitionNet).
2. Every 30 s only that vector is sent over the socket.
3. The server matches it against the course roster by Euclidean distance
   (threshold `0.52`) and folds the observation into the attendance record.
4. Landmark geometry yields a gaze proxy, blended with tab focus, mic, and chat
   activity into a 0–100 engagement score.

Status is derived from *presence over the class's own duration* — not from how
many samples a student happened to send, so appearing for four ticks of a
two-hour class does not read as fully present:

| Status | Rule |
|---|---|
| `present` | seen for ≥ 75% of the class, joined within the grace period |
| `late` | met the ratio but joined > 10 min after the start |
| `partial` | seen, but below the ratio |
| `absent` | never recognised |

Safeguards: ambiguous matches (runner-up within 0.08) are flagged rather than
trusted, multiple faces in frame are flagged, and **every AI decision is
correctable** — a teacher override is marked `method: 'override'` and is never
recalculated by a later re-finalise.

### Virtual classroom
Mesh WebRTC (Socket.IO signalling) with camera, mic, screen share, chat, and
hand-raise. The teacher sees students appear on a live attendance panel as the
AI recognises them. Ending a class finalises attendance, fills in absentees, and
regenerates insights in one step. Recordings are uploaded and replayable.

### Analytics & insights
Weighted grading (`Σ (score/max × weight) / Σ weight`), with un-submitted
past-due work counted as zero so a student who submits nothing cannot show a
perfect average. Least-squares trend slope over each student's score timeline.

The risk model is a transparent weighted sum, not a black box — every flag can be
traced to its drivers:

| Signal | Weight | Signal | Weight |
|---|---|---|---|
| Attendance | 0.30 | Missing work | 0.15 |
| Grade | 0.30 | Trend | 0.05 |
| Engagement | 0.15 | Lateness | 0.05 |

Eight rules turn those metrics into insight cards (`at-risk`, `attendance-drop`,
`low-engagement`, `missing-work`, `declining`, `improving`, `top-performer`,
`chronic-lateness`), each with a recommended action. Insights refresh
automatically when a class ends or a submission is graded.

### Assignments & scoreboard
Types (homework / quiz / project / exam), weights, attachments, configurable late
penalties applied automatically at grading, per-assignment difficulty analysis,
and a class scoreboard. **The scoreboard is role-aware:** students see names,
grades, and attendance; engagement and risk are visible to teachers only.

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` · `/login` | Authentication |
| `POST` | `/api/auth/face/enrol` · `DELETE /api/auth/face` | Face enrolment & deletion |
| `GET/POST` | `/api/courses` | Courses; `POST /courses/enrol` joins by code |
| `POST` | `/api/sessions/:id/start` · `/end` | Run a class; `/end` finalises attendance |
| `POST` | `/api/sessions/:id/recognise` | Attendance tick (HTTP fallback for mobile) |
| `POST` | `/api/sessions/:id/attendance/override` | Teacher correction |
| `POST` | `/api/assignments/:id/submit` · `/submissions/:id/grade` | Coursework |
| `GET` | `/api/analytics/dashboard/student` · `/teacher` | Dashboards |
| `GET` | `/api/analytics/course/:id/scoreboard` | Scoreboard |

Socket events: `room:join`, `signal:offer|answer|ice`, `attendance:tick`,
`attendance:update`, `chat:message`, `hand:raise`, `session:ended`.

## Design notes

- **Charts are hand-rolled SVG** against a validated palette — 2 px lines, 4 px
  rounded data-ends, recessive grid ink, a hover layer on every chart, and a
  "view as table" fallback. Attendance uses the fixed status palette, which
  always ships with a glyph and a word so colour never carries meaning alone.
  Light and dark are each selected, not inverted.
- **The mobile live classroom is a WebView** onto the web client. WebRTC mesh
  video and the on-device embedding model are already tuned in the browser
  build; a second native WebRTC stack and ML runtime would drift out of sync for
  the same result. The native shell keeps navigation, permissions, and the token.

## Production checklist

Not yet handled, and needed before real deployment:

- Add a TURN server (`web/src/hooks/useWebRTC.js`) — STUN alone fails behind
  symmetric NAT.
- Mesh WebRTC is fine to ~8 cameras; past that move signalling to an SFU.
- Move uploads to object storage; the current disk volume does not scale out.
- Recognition thresholds (`FACE_MATCH_THRESHOLD`, presence ratio) are calibrated
  against synthetic data — re-tune on real enrolments before trusting them.
- Add refresh-token rotation; access tokens currently live for 7 days.
- Face data is biometric information. Obtain explicit consent, set a retention
  policy, and confirm your GDPR/FERPA obligations before enrolling real students.

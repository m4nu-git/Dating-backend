# Dating App Backend

A production-grade REST API and real-time chat server for a location-based dating application — built with Node.js, Express, TypeScript, PostgreSQL + PostGIS, Prisma ORM, AWS S3, and WebSockets.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Folder Structure](#folder-structure)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [Authentication Flow](#authentication-flow)
8. [Matching Workflow](#matching-workflow)
9. [Bloom Filter — Seen Profile Tracking](#bloom-filter--seen-profile-tracking)
10. [Real-time Chat Workflow](#real-time-chat-workflow)
11. [Recommendation Engine Logic](#recommendation-engine-logic)
12. [Logging & Observability](#logging--observability)
13. [Security Practices](#security-practices)
14. [Scalability Considerations](#scalability-considerations)
15. [Installation & Setup](#installation--setup)
16. [Environment Variables](#environment-variables)
17. [Running with Docker](#running-with-docker)
18. [Seeding the Database](#seeding-the-database)
19. [API Examples](#api-examples)
20. [Future Improvements](#future-improvements)

---

## Project Overview

This backend powers a Hinge-style dating application. Users register with photos and personality prompts ("behaviours"), discover nearby profiles through a PostGIS geospatial radius query, express interest by liking a photo or a prompt with a comment, and mutually match to unlock real-time chat.

**Key design goals:**
- Clean layered architecture (routes → controllers → services → repositories)
- Zero duplicate database logic — all queries isolated in the repository layer
- Bloom filters ensure users never see the same profile twice
- Sub-100ms discovery queries using geohash pre-filtering + PostGIS for precision
- Horizontally scalable: stateless HTTP server, WebSocket server, isolated DB pool

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 + TypeScript (ESNext) |
| Framework | Express.js 5 |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| ORM | Prisma 7 (adapter-pg) |
| Spatial | PostGIS `ST_DWithin`, ngeohash |
| Seen-tracking | Bloom filter (bitset + murmurhash) |
| Auth | JWT (jsonwebtoken) |
| Password | bcrypt |
| File Upload | AWS S3 via multer-s3 |
| Real-time | WebSocket (ws) |
| Validation | Zod v4 |
| Logging | Winston + DailyRotateFile |
| Observability | Correlation ID per request (AsyncLocalStorage) |
| Containerisation | Docker + Docker Compose |
| Build | tsx (dev), tsc (production) |

---

## System Architecture

```
                         ┌─────────────────────────────────────┐
                         │           Client (Mobile/Web)        │
                         └────────────┬────────────┬───────────┘
                                      │ HTTP        │ WebSocket
                                      ▼             ▼
                         ┌────────────────────────────────────────┐
                         │           Express Server :3000          │
                         │                                        │
                         │  ┌──────────────────────────────────┐  │
                         │  │  Middleware Pipeline              │  │
                         │  │  CORS → CorrelationID → JSON      │  │
                         │  │  → AuthMiddleware (protected)     │  │
                         │  └──────────────────────────────────┘  │
                         │                                        │
                         │  ┌──────────────────────────────────┐  │
                         │  │  Routes  /api/v1/users            │  │
                         │  └────────────────┬─────────────────┘  │
                         │                   │                    │
                         │  ┌────────────────▼─────────────────┐  │
                         │  │  Controllers  (input validation)  │  │
                         │  └────────────────┬─────────────────┘  │
                         │                   │                    │
                         │  ┌────────────────▼─────────────────┐  │
                         │  │  Services  (business logic)       │  │
                         │  │  bcrypt · JWT · geohash · bloom   │  │
                         │  └────────────────┬─────────────────┘  │
                         │                   │                    │
                         │  ┌────────────────▼─────────────────┐  │
                         │  │  Repository  (all DB queries)     │  │
                         │  └────────────────┬─────────────────┘  │
                         └───────────────────┼────────────────────┘
                                             │
                         ┌───────────────────▼────────────────────┐
                         │         Prisma 7 + @prisma/adapter-pg   │
                         └───────────────────┬────────────────────┘
                                             │
                         ┌───────────────────▼────────────────────┐
                         │     PostgreSQL 16 + PostGIS 3.4         │
                         │     (Docker: postgis/postgis:16-3.4)    │
                         └────────────────────────────────────────┘

                         ┌────────────────────────────────────────┐
                         │       WebSocket Server :8080            │
                         │       ChatManager (Singleton)           │
                         │       in-memory Map<userId, socket>     │
                         └───────────────────┬────────────────────┘
                                             │ persists messages
                                             ▼
                                         PostgreSQL
```

---

## Folder Structure

```
dating-backend/
├── prisma/
│   ├── schema.prisma          # Database models + PostGIS extension
│   ├── seed.ts                # Dev seed: 4 users (2M + 2F), nearby locations
│   └── migrations/            # Prisma migration history
├── src/
│   ├── server.ts              # Entry point: HTTP + WebSocket servers
│   ├── config/
│   │   ├── index.ts           # Typed env config (all vars in one object)
│   │   ├── logger.config.ts   # Winston + DailyRotateFile
│   │   └── s3.config.ts       # Lazy S3Client + multer-s3 upload
│   ├── db/
│   │   └── index.ts           # Prisma singleton (pg pool + adapter)
│   ├── generated/
│   │   └── prisma/            # Auto-generated Prisma client (gitignored)
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # JWT verification → req.userId
│   │   ├── correlation.middleware.ts # UUID per request via AsyncLocalStorage
│   │   └── error.middleware.ts      # AppError handler + generic fallback
│   ├── controllers/
│   │   └── user.controller.ts  # Thin: validate input → call service → respond
│   ├── services/
│   │   └── user.service.ts     # Business logic: hashing, geohash, bloom, tokens
│   ├── repositories/
│   │   └── user.repository.ts  # All Prisma queries + raw PostGIS SQL
│   ├── routes/
│   │   └── user.routes.ts      # Route definitions + middleware wiring
│   ├── routers/
│   │   ├── v1/index.router.ts  # Mounts /ping, /users under /api/v1
│   │   └── v2/index.router.ts  # Reserved for v2 endpoints
│   ├── validators/
│   │   ├── user.validator.ts   # Zod schemas for all user endpoints
│   │   └── index.ts            # Generic validateRequestBody middleware
│   ├── utils/
│   │   ├── bloom.util.ts        # addToBloomFilter / existsInBloomFilter
│   │   ├── age.util.ts          # calculateAge from dd-mm-yyyy
│   │   ├── async.handler.ts     # Wraps async controllers → forwards errors
│   │   ├── errors/app.error.ts  # Typed error classes (400/401/403/404/500)
│   │   └── helpers/
│   │       └── request.helpers.ts # AsyncLocalStorage + getCorrelationId
│   └── ws/
│       └── chat.manager.ts     # WebSocket singleton: join, sendMessage, clearUser
├── logs/                       # Auto-created, daily rotating log files
├── docker-compose.yml          # postgis/postgis:16-3.4-alpine
├── prisma.config.ts            # Prisma 7 datasource + migrations config
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Database Schema

### User
```
User {
  id               Int       PK autoincrement
  first_name       String
  last_name        String
  email            String    UNIQUE
  password         String    bcrypt hash
  phone_number     String
  gender           String
  preferred_gender String
  latitude         String
  longitude        String
  geohash          String    4-char geohash for proximity pre-filter
  bloom_filter     String    BitSet string — tracks seen/rejected profiles
  age              Int
  date_of_birth    String    format: dd-mm-yyyy
  occupation       String
  region           String
  religion         String
  home_town        String
  dating_type      String    "serious" | "casual"
  images           Images[]
  behaviours       Behaviour[]

  @@index([age, geohash])   compound index for discovery queries
}
```

### Images
```
Images {
  id       Int    PK
  url      String S3 object URL
  user_id  Int    FK → User
}
```

### Behaviour (Personality Prompts)
```
Behaviour {
  id       Int    PK
  question String e.g. "What are you looking for?"
  answer   String user's personal answer
  user_id  Int    FK → User
}
```

### Likes
```
Likes {
  id           Int        PK
  liked_by     Int        FK → User
  liked_to     Int        FK → User
  image_id     Int?       FK → Images     (like on a photo)
  behaviour_id Int?       FK → Behaviour  (like on a prompt)
  comment      String     message attached to the like
  UNIQUE(liked_by, liked_to)
}
```

### Matches
```
Matches {
  id               Int PK
  first_person_id  Int FK → User  (the one who sent the original like)
  second_person_id Int FK → User  (the one who accepted)
}
```

### Chats
```
Chats {
  id          Int      PK
  sender_id   Int      FK → User
  receiver_id Int      FK → User
  message     String
  created_at  DateTime default now()
}
```

---

## API Reference

**Base URL:** `http://localhost:3000/api/v1/users`

**Auth header:** `Authorization: <jwt_token>`

### Public Endpoints

| Method | Path | Body / Notes |
|--------|------|-------------|
| POST | `/register` | `multipart/form-data` — `userData` (JSON string) + `images` (files) |
| POST | `/login` | `{ email, password }` |
| POST | `/googleLogin` | `{ email }` — skips password check |

### Protected Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Your full profile with images and behaviours |
| GET | `/matches` | Discover nearby users (PostGIS 100km, gender-filtered, bloom-deduplicated) |
| GET | `/allLikes` | All users who liked you, with their image/behaviour they liked |
| GET | `/allMatches` | All mutual matches with last message preview |
| GET | `/profile/:id` | Another user's profile — only accessible if they liked you |
| GET | `/chats/:id` | Full chat history sorted by `created_at` |
| POST | `/imageLiked` | `{ likedUserId, imageId, comment }` |
| POST | `/behaviourLiked` | `{ likedUserId, behaviourId, comment }` |
| POST | `/reject` | `{ rejectedUserId }` — pass on a profile |
| POST | `/accept` | `{ acceptedUserId, message }` — accept a like, creates Match |

---

## Authentication Flow

```
POST /register
  ├── Zod validation
  ├── bcrypt.hash(password, 10)
  ├── ngeohash.encode(lat, lng, 4) → geohash
  ├── calculateAge(date_of_birth)
  ├── multer-s3 uploads photos → AWS S3
  ├── Prisma transaction:
  │     INSERT User → INSERT Images → INSERT Behaviours
  └── jwt.sign({ userId }) → return { token }

POST /login
  ├── findUserByEmail
  ├── bcrypt.compare(plain, hash)
  └── jwt.sign({ userId }) → return { token }

Protected routes
  ├── Authorization header → jwt.verify(token, JWT_SECRET)
  ├── req.userId = decoded.userId
  └── next() → controller
```

---

## Matching Workflow

```
Like Flow
─────────
User A sends  POST /imageLiked  { likedUserId: B, imageId: X, comment: "..." }
  → Creates   Likes row  (liked_by=A, liked_to=B, image_id=X)
  → Updates   A's bloom_filter  (marks B as seen — won't appear in /matches again)

Accept Flow  (creates mutual Match)
─────────────────────────────────
User B sends  POST /accept  { acceptedUserId: A, message: "Hey!" }
  → Prisma transaction:
      DELETE Likes WHERE liked_by=A AND liked_to=B
      UPDATE User SET bloom_filter=... WHERE id=B
      INSERT Matches (first_person_id=A, second_person_id=B)
      INSERT Chats   (sender_id=B, receiver_id=A, message="Hey!")

Reject Flow
───────────
User B sends  POST /reject  { rejectedUserId: A }
  → UPDATE B's bloom_filter  (marks A as seen)
  → DELETE any pending Like from A to B
```

---

## Bloom Filter — Seen Profile Tracking

Every user has a `bloom_filter` column — a serialised BitSet string. When a user likes, accepts, or rejects someone, that person's ID is hashed into the filter. The discovery query then excludes anyone already in the filter, guaranteeing users never see the same profile twice.

```
Configuration (via .env):
  BLOOM_FILTER_SIZE = 28,755,175 bits  (~3.5 MB)
  HASH_SIZE         = 10 hash functions

Properties:
  False positive rate  < 0.01% at 10M unique entries
  Lookup time          O(k) constant — independent of how many profiles seen
  Auto-reset           when cardinality reaches BLOOM_FILTER_SIZE
```

```typescript
// After like/reject/accept — mark userId 42 as seen
const updated = addToBloomFilter(user.bloom_filter, 42);

// In discovery — skip profiles already seen
if (!existsInBloomFilter(user.bloom_filter, candidate.id)) {
  include(candidate);
}
```

---

## Real-time Chat Workflow

```
WebSocket server: ws://localhost:8080

1. Connect & Join (authentication)
   Client → { "type": "join", "payload": { "token": "<jwt>" } }
   Server → verifies JWT → adds socket to ChatManager.users Map

2. Send Message
   Client → { "type": "chat", "payload": { "token": "<jwt>",
                                            "receiverId": "5",
                                            "message": "Hey!" } }
   Server → ChatManager.sendMessage():
              ├── Validates both users exist in DB
              ├── INSERT into Chats table (persisted)
              └── Forwards to receiver's socket if online:
                  { "type": "chat", "payload": { "senderId": "2", "message": "Hey!" } }

3. Disconnect
   Server → ws.on('close') → ChatManager.clearUser(socket)
            removes user from in-memory registry
```

`ChatManager` is a **singleton** — all WebSocket connections share one registry. REST `GET /chats/:id` serves historical messages from the database for users coming back online.

---

## Recommendation Engine Logic

```
GET /matches — Discovery Pipeline

Step 1  Geohash pre-filter  (index scan, fast)
        4-char geohash ≈ 40×20km cell
        Expand to neighbors-of-neighbors → ~81 cells ≈ 600km² coverage
        WHERE geohash = ANY($geohashes)

Step 2  PostGIS precision filter  (geodesic accuracy)
        ST_DWithin with ::geography cast — accounts for Earth's curvature
        WHERE ST_DWithin(
          ST_MakePoint(user.lng, user.lat)::geography,
          ST_MakePoint($myLng, $myLat)::geography,
          100000   -- 100km in metres
        )

Step 3  Gender preference filter
        AND "User".gender = $preferredGender

Step 4  Aggregate related data
        LEFT JOIN Images  → json_agg(DISTINCT "Images")
        LEFT JOIN Behaviour → json_agg(DISTINCT "Behaviour")
        GROUP BY "User".id
        LIMIT 10

Step 5  Bloom filter dedup  (in memory, O(k))
        results.filter(r => !existsInBloomFilter(bloom_filter, r.id))

Output: up to 10 fresh, nearby, gender-matched profiles per request
```

---

## Logging & Observability

Every HTTP request receives a **UUID Correlation ID** via `AsyncLocalStorage`. The ID flows through the entire call stack — controllers, services, repositories — without explicit parameter passing. Every Winston log line includes it automatically.

```json
{
  "level": "info",
  "message": "Ping request Received!",
  "timestamp": "05-06-2026 18:45:12",
  "correlationId": "b3d2e1f4-9a0c-4b8e-a1d2-3e4f5a6b7c8d",
  "data": {}
}
```

**Log rotation** — `winston-daily-rotate-file`:
- Pattern: `logs/YYYY-MM-DD-app.log`
- Max file size: 20MB
- Retention: 14 days

---

## Security Practices

| Concern | Implementation |
|---------|---------------|
| Passwords | bcrypt, cost factor 10 |
| Tokens | JWT signed with `JWT_SECRET`, verified on every protected route |
| Input validation | Zod schemas on every endpoint — before any business logic runs |
| SQL injection | Prisma parameterised queries; raw SQL uses tagged template literals |
| Error leaking | Typed `AppError` classes — only `message` and `statusCode` returned to client |
| Unhandled rejections | `asyncHandler` wrapper catches all async errors → error middleware |
| CORS | `cors` middleware — configure `origin` per environment |
| Secrets | All credentials in `.env` — committed only as `.env.example` |
| AWS S3 | IAM credentials scoped to a single bucket; never exposed in responses |
| Profile access | `GET /profile/:id` requires the target user to have liked you first |

---

## Scalability Considerations

### Current Design Strengths

- **Prisma + pg Pool** — connection pooling handles concurrent requests without spawning new connections per request
- **Geohash + PostGIS two-level filter** — geohash narrows the candidate set to a few thousand rows before PostGIS applies the exact geodesic check; `@@index([age, geohash])` makes the first pass a fast index scan
- **Bloom filters** — O(k) constant-time profile deduplication regardless of how many profiles a user has seen; no growing `NOT IN` subquery
- **Singleton ChatManager** — zero-overhead online-user lookup via in-memory Map

### Path to Production Scale

```
                    ┌──────────────────────────┐
                    │   Load Balancer (ALB)     │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                                     │
       HTTP Pods (N)                         WS Pods (N)
       Express :3000                         ws :8080
              │                                     │
              └──────────────────┬──────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
  PostgreSQL                Redis Cache            Redis Pub/Sub
  Primary + Replica         bloom filters          WS fan-out across
  (pgbouncer in front)      discovery TTL 30s      all WS pods
```

**Scaling roadmap:**
1. **Redis** — cache `/matches` results (TTL 30s), bloom filters (write-through), pub/sub for multi-pod WebSocket delivery
2. **Read replicas** — route all `SELECT` queries to replica; writes to primary
3. **BullMQ** — offload S3 uploads, push notifications, bloom persistence to background workers
4. **Pgbouncer** — connection pooler to support 10k+ concurrent HTTP clients on a single DB node
5. **Horizontal WS pods** — replace in-memory `ChatManager.users` Map with Redis pub/sub so any pod can deliver a message to any connected socket

---

## Installation & Setup

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- AWS account with an S3 bucket (required only for `/register` with real image uploads)

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd dating-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables section)

# 4. Start the PostGIS database
docker compose up -d

# 5. Run migrations
npx prisma migrate dev --name init

# 6. Generate Prisma client
npx prisma generate

# 7. (Optional) Seed with test users
npx tsx prisma/seed.ts

# 8. Start the server
npm run dev
```

The server starts at:
- HTTP API → `http://localhost:3000`
- WebSocket  → `ws://localhost:8080`

---

## Environment Variables

```bash
# Server
PORT=3000

# Database (must match docker-compose.yml credentials)
DATABASE_URL="postgresql://hinge:hinge_secret@localhost:5432/hinge_db"

# Auth — use a long random string in production
JWT_SECRET="your_strong_secret_here"

# AWS S3 — required for photo uploads in /register
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION=""
AWS_BUCKET=""

# Bloom Filter Tuning
BLOOM_FILTER_SIZE=28755175   # bits (~3.5 MB per user, ~10M profile capacity)
HASH_SIZE=10                 # number of MurmurHash functions
```

---

## Running with Docker

The `docker-compose.yml` starts a PostGIS-enabled PostgreSQL instance with a named volume for persistent storage:

```bash
# Start database
docker compose up -d

# Check it's healthy
docker exec hinge_db psql -U hinge -d hinge_db -c "SELECT PostGIS_version();"

# Stop (data persists)
docker compose stop

# Destroy including all data
docker compose down -v
```

> **Why PostGIS and not plain PostgreSQL?**
> The `GET /matches` discovery endpoint uses `ST_DWithin` for geodesic distance calculations that account for Earth's curvature. Plain `postgres` images do not include this extension — you must use `postgis/postgis`.

---

## Seeding the Database

The seed script creates 4 users in the Delhi NCR area — 2 male (prefer female) and 2 female (prefer male) — all within 100km of each other so discovery results are returned immediately without any configuration.

```bash
npx tsx prisma/seed.ts
```

| Name | Email | Gender | Prefers | Location |
|------|-------|--------|---------|----------|
| Arjun Sharma | arjun@example.com | male | female | Delhi (28.61°N, 77.21°E) |
| Rohan Verma | rohan@example.com | male | female | Noida (28.54°N, 77.39°E) |
| Priya Kapoor | priya@example.com | female | male | Rohini (28.70°N, 77.10°E) |
| Sneha Mehta | sneha@example.com | female | male | Gurgaon (28.46°N, 77.03°E) |

**Password for all accounts:** `password123`

Check actual IDs after seeding:
```bash
docker exec hinge_db psql -U hinge -d hinge_db \
  -c 'SELECT i.id AS image_id, i.user_id, u.first_name FROM "Images" i JOIN "User" u ON i.user_id = u.id;'
```

---

## API Examples

### Register a new user
```http
POST /api/v1/users/register
Content-Type: multipart/form-data

Field: userData (Text)
Value: {
  "firstName": "John", "lastName": "Doe",
  "email": "john@example.com", "password": "password123",
  "gender": "male", "phoneNumber": "9876543210",
  "preferredGender": "female",
  "latitude": "28.6139", "longitude": "77.2090",
  "occupation": "Engineer", "region": "Delhi",
  "religion": "Hindu", "date_of_birth": "15-08-1998",
  "home_town": "Delhi", "dating_type": "serious",
  "behaviours": [
    { "question": "What are you looking for?", "answer": "Long term relationship" }
  ]
}
Field: images (File) → attach a photo

Response: { "token": "<jwt>" }
```

### Login
```http
POST /api/v1/users/login
Content-Type: application/json

{ "email": "arjun@example.com", "password": "password123" }

Response: { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### Discover nearby profiles
```http
GET /api/v1/users/matches
Authorization: <arjun_token>

Response: [
  {
    "id": 4,
    "first_name": "Priya",
    "age": 27,
    "occupation": "UX Designer",
    "images": [{ "id": 4, "url": "https://..." }],
    "behaviours": [{ "question": "...", "answer": "..." }]
  }
]
```

### Like a photo
```http
POST /api/v1/users/imageLiked
Authorization: <priya_token>
Content-Type: application/json

{ "likedUserId": 2, "imageId": 2, "comment": "Great profile!" }

Response: { "message": "Image liked" }
```

### Accept a like (creates a Match)
```http
POST /api/v1/users/accept
Authorization: <arjun_token>
Content-Type: application/json

{ "acceptedUserId": 4, "message": "Hey Priya! Great to match with you" }

Response: { "message": "Accepted successfully" }
```

### Get all matches
```http
GET /api/v1/users/allMatches
Authorization: <arjun_token>

Response: {
  "id": 2,
  "people": [
    { "id": 4, "first_name": "Priya", "images": [...], "chats_sent": [...] }
  ]
}
```

### WebSocket — Real-time chat
```javascript
const ws = new WebSocket('ws://localhost:8080');

// 1. Authenticate and join
ws.send(JSON.stringify({
  type: 'join',
  payload: { token: '<jwt>' }
}));

// 2. Send a message to a matched user
ws.send(JSON.stringify({
  type: 'chat',
  payload: { token: '<jwt>', receiverId: '4', message: 'Hey Priya!' }
}));

// 3. Receive incoming messages
ws.onmessage = (event) => {
  const { type, payload } = JSON.parse(event.data);
  if (type === 'chat') {
    console.log(`${payload.senderId}: ${payload.message}`);
  }
};
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with hot-reload (tsx watch) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npx prisma migrate dev` | Create and apply a new migration |
| `npx prisma generate` | Regenerate Prisma client after schema changes |
| `npx tsx prisma/seed.ts` | Seed database with test users |
| `docker compose up -d` | Start PostGIS database |
| `docker compose down -v` | Destroy database + volume |

---

## Future Improvements

### Short Term
- [ ] **Refresh tokens** — short-lived access tokens + long-lived refresh tokens stored in Redis
- [ ] **Pagination** — cursor-based pagination on `/matches`, `/allLikes`, `/chats/:id`
- [ ] **Seen/read receipts** — `is_read` flag + timestamp on Chats
- [ ] **Typing indicators** — WebSocket `typing` event type
- [ ] **Unread message count** — aggregate per match on `GET /allMatches`
- [ ] **Super likes** — separate interaction with higher visibility and limited daily quota

### Medium Term
- [ ] **Redis caching** — discovery results (TTL 30s), bloom filters (write-through), user sessions
- [ ] **Redis pub/sub** — fan-out WebSocket messages across horizontally scaled pods
- [ ] **BullMQ job queues** — async S3 processing, push notification dispatch, email delivery
- [ ] **Rate limiting** — `express-rate-limit` per IP and per `userId`
- [ ] **OTP / phone auth** — SMS-based login with Twilio
- [ ] **Report & block** — Report model; blocked user IDs added to bloom filter

### Long Term
- [ ] **Compatibility scoring** — weighted algorithm (age gap, interest overlap, activity score, response rate)
- [ ] **Premium subscriptions** — Stripe integration, feature flags per tier (super likes, rewinds, boosts)
- [ ] **Admin panel APIs** — moderation dashboard, ban/unban, analytics endpoints
- [ ] **Push notifications** — Firebase FCM for match alerts and message delivery
- [ ] **Pgbouncer** — connection pooler for 10k+ concurrent users on a single DB node
- [ ] **Read replicas** — route all `SELECT` to replica, writes to primary
- [ ] **CI/CD pipeline** — GitHub Actions → Docker build → push to ECR → ECS/Kubernetes deploy
- [ ] **Monitoring** — Prometheus metrics, Grafana dashboards, error alerting via PagerDuty

---

## License

ISC

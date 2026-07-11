# 🏆 Real-Time Sports Dashboard

A production-grade, highly resilient real-time sports dashboard that broadcasts live match scores and ball-by-ball commentary to connected clients over WebSockets. The system features a selective subscribe/unsubscribe protocol, a type-safe database layer, strict validation schemas, bot protection, and uptime/APM monitoring.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[React Client] <-->|WebSockets & REST API| Gateway[Arcjet Security Gateway]
    Gateway <-->|Filtered Traffic| Express[Express Server]
    Express <-->|Auth & Router| WS[WS Server]
    Express <-->|Drizzle ORM| DB[(PostgreSQL)]
    WS <-->|Heartbeats & Broadcasts| Client
    Site24x7[Site24x7 APM] -.->|Uptime & Perf Monitoring| Express
```

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React | Responsive, interactive, and dynamic user interface |
| **Backend** | Node.js + Express | REST API and HTTP server orchestration |
| **Real-time** | `ws` (WebSockets) | High-performance, low-overhead bi-directional communication |
| **Database** | PostgreSQL | Robust relational storage for matches, commentary, and users |
| **ORM** | Drizzle ORM | Modern, type-safe database queries and migrations |
| **Validation** | Zod | Dynamic validation for both API payloads and WebSocket messages |
| **Security** | Arcjet | Bot detection, rate limiting, and API abuse prevention |
| **Monitoring** | Site24x7 APM | Uptime checks and end-to-end performance tracing |

---

## ⚡ Key Features & Engineering Highlights

### 1. Selective WebSocket Subscription Protocol
Clients connect to a single WebSocket gateway and use a custom JSON-based protocol to subscribe and unsubscribe to specific match rooms. The server maintains room lists dynamically and broadcasts updates *only* to clients viewing that specific match.

### 2. Production-Grade WebSocket Resilience
Designed to handle high-frequency concurrent broadcasts without degrading system stability:
*   **Heartbeat / Ping-Pong**: Automatically detects and prunes dead connections (zombie sockets) every 30 seconds.
*   **Per-Socket Subscription Caps**: Prevents rogue clients from subscribing to too many matches and exhausting memory.
*   **Backpressure Handling**: Safely handles slow clients by monitoring buffered amount and temporarily pausing or dropping frames before the socket crashes.
*   **Rate Limiting**: Rate limits client messages over the WebSocket protocol (e.g., subscription requests) using a token-bucket algorithm.

### 3. Comprehensive Security with Arcjet
Protected against modern web threats:
*   **Bot Detection**: Blocks automated scrapers and bad actors attempting to siphon live match data.
*   **Rate Limiting**: Defends against DDoS attacks and brute-force attempts on REST endpoints.
*   **Abuse Prevention**: Validates incoming request headers and prevents common exploits.

---

## 🗄️ Database Schema & Models

Below is a representation of the relational schema modeled using **Drizzle ORM**:

```typescript
// db/schema.ts
import { pgTable, uuid, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  homeTeam: varchar("home_team", { length: 256 }).notNull(),
  awayTeam: varchar("away_team", { length: 256 }).notNull(),
  status: varchar("status", { length: 50 }).default("scheduled").notNull(), // scheduled, live, completed
  scoreHome: integer("score_home").default(0).notNull(),
  scoreAway: integer("score_away").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const commentaries = pgTable("commentaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  overs: varchar("overs", { length: 10 }).notNull(), // e.g., "14.2"
  runs: integer("runs").notNull(),
  event: varchar("event", { length: 50 }).notNull(), // run, wicket, extra, boundary
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

## 🚦 REST API Specifications

### Matches Endpoint

#### `GET /api/v1/matches`
Retrieve all matches with optional filters (e.g., active, completed).
*   **Response (200 OK)**:
    ```json
    [
      {
        "id": "a9b8c7d6-e5f4-3210-abcd-ef0123456789",
        "homeTeam": "India",
        "awayTeam": "Australia",
        "status": "live",
        "scoreHome": 240,
        "scoreAway": 210,
        "createdAt": "2026-07-11T10:48:35.000Z",
        "updatedAt": "2026-07-11T10:48:35.000Z"
      }
    ]
    ```

#### `POST /api/v1/matches` (Admin)
Create a new match. Payloads are validated via Zod.
*   **Request Body**:
    ```json
    {
      "homeTeam": "India",
      "awayTeam": "Australia",
      "status": "scheduled"
    }
    ```

### Commentary Endpoint

#### `POST /api/v1/matches/:matchId/commentary` (Admin)
Post a ball-by-ball commentary update. Writing to this endpoint triggers a WebSocket broadcast to all subscribed clients.
*   **Request Body**:
    ```json
    {
      "overs": "14.3",
      "runs": 4,
      "event": "boundary",
      "text": "Beautiful cover drive by the batsman for a boundary!"
    }
    ```

---

## 🔌 WebSocket Protocol

All communication over WebSocket messages must adhere to the structured JSON payloads validated by Zod schemas.

### Client Messages

#### Subscribe to Match
```json
{
  "action": "subscribe",
  "matchId": "a9b8c7d6-e5f4-3210-abcd-ef0123456789"
}
```

#### Unsubscribe from Match
```json
{
  "action": "unsubscribe",
  "matchId": "a9b8c7d6-e5f4-3210-abcd-ef0123456789"
}
```

### Server Broadcasts

#### Match Score Update
```json
{
  "type": "score_update",
  "matchId": "a9b8c7d6-e5f4-3210-abcd-ef0123456789",
  "data": {
    "scoreHome": 244,
    "scoreAway": 210,
    "status": "live"
  }
}
```

#### Commentary Update
```json
{
  "type": "commentary_update",
  "matchId": "a9b8c7d6-e5f4-3210-abcd-ef0123456789",
  "data": {
    "overs": "14.3",
    "runs": 4,
    "event": "boundary",
    "text": "Beautiful cover drive by the batsman for a boundary!"
  }
}
```

---

## 🛡️ Validation & Security (Zod & Arcjet)

Both HTTP requests and WebSocket payloads are validated strictly via Zod to avoid malformed data injection.

```typescript
// schemas/validation.ts
import { z } from "zod";

export const clientMessageSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("subscribe"),
    matchId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("unsubscribe"),
    matchId: z.string().uuid(),
  }),
]);

export const commentaryPayloadSchema = z.object({
  overs: z.string().regex(/^\d+\.[1-6]$/, "Invalid overs format"),
  runs: z.number().int().min(0).max(6),
  event: z.enum(["run", "wicket", "extra", "boundary"]),
  text: z.string().min(1).max(500),
});
```

---

## 📈 Monitoring & Site24x7 APM

The application incorporates comprehensive APM and uptime metrics:
*   **Synthetic Uptime Monitors**: Configured in Site24x7 to hit `/health` every 1 minute.
*   **APM Agent**: Tracks latency distributions, database query execution times (via Drizzle hooks), and HTTP request flows.
*   **WebSocket Metric Exporter**: Exposes real-time active connections, subscription counts, and dropped-frame rates.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   PostgreSQL
*   Arcjet Account & API Key

### Local Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/yourusername/score-dashboard.git
    cd score-dashboard
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Environment Variables (`.env`)**:
    Create a `.env` file in the root directory:
    ```env
    PORT=3000
    DATABASE_URL=postgresql://user:password@localhost:5432/score_db
    ARCJET_KEY=ajkey_xxxxxxxxxxxxxxxxxxxxxxxxxx
    NODE_ENV=development
    ```

4.  **Database Migrations**:
    ```bash
    npm run db:generate
    npm run db:migrate
    ```

5.  **Run Development Server**:
    ```bash
    npm run dev
    ```

6.  **Run Tests**:
    ```bash
    npm test
    ```

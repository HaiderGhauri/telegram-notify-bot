# Telegram Notify Bot

A Telegram bot that watches customer / merchant groups for mentions of your team members, tracks whether they replied, and nags them in an internal staff group if they go silent.

Built for support and ops teams that work across many Telegram chats and need a safety net so tagged messages don’t get missed.

## Use case

1. Register the **public / merchant groups** you care about.
2. Register an **internal staff group** (or forum topic) where reminders should land.
3. Add the team members you want monitored.
4. When someone `@mentions` a tracked member (or replies to them) in a registered group, the bot opens a mention record.
5. If that member replies in the same group, the mention is closed automatically.
6. If they don’t reply in time, the bot posts a reminder in the internal group with **Yes / No** buttons so they (or the owner) can confirm.

```
Merchant group                     Internal staff group
─────────────────                  ────────────────────
@alice please check this    →      ⚠️ alice was mentioned
                                   in Merchant Chat X
                                   Did you reply?  [Yes] [No]
```

## Features

- Track `@username` mentions and `text_mention` entities
- Treat replies to a tracked member as a mention
- Auto-close mentions when the member posts again in that group
- Timed reminders to one or more internal groups (including forum topics)
- Inline Yes/No confirmation on reminders
- Owner-only admin commands
- Member verification flow when adding someone by `@username` only
- PostgreSQL persistence via Prisma

## Tech stack

- **Node.js** + **TypeScript**
- **Telegraf** — Telegram Bot API
- **Prisma** + **PostgreSQL**

## Prerequisites

- Node.js 18+
- A PostgreSQL database
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (for `OWNER_ID`) — e.g. via [@userinfobot](https://t.me/userinfobot)

## Setup

```bash
git clone https://github.com/HaiderGhauri/telegram-notify-bot.git
cd telegram-notify-bot
npm install
```

Create a `.env` file in the project root:

```env
BOT_TOKEN=123456:ABC-DEF...
OWNER_ID=123456789
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
```

Generate the Prisma client and apply migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Running

Development (hot reload, entry: `src/bot.ts`):

```bash
npm run dev
```

Production build:

```bash
npm run build
node dist/bot.js
```

> Note: `npm start` currently points at `dist/index.js`, which is a stub. Use `node dist/bot.js` after building.

Make sure env vars are available to the process (export them, use a process manager, or load `.env` yourself). `.env` is gitignored.

## Bot setup in Telegram

1. Create the bot with BotFather and copy the token into `BOT_TOKEN`.
2. Disable privacy mode (or make the bot an admin) in every group it must read, so it can see messages and mentions.
3. Add the bot to each **merchant / customer** group and to your **internal staff** group.
4. Run owner commands from your Telegram account (the one matching `OWNER_ID`).

## Commands

All of these are **owner-only** (`OWNER_ID`).

| Command | Where | Description |
|---------|--------|-------------|
| `/init` | Any chat | Health check — confirms the bot is running and you are the owner |
| `/register_group` | Merchant / customer group | Start tracking mentions in this group |
| `/register_internal` | Staff group (or forum topic) | Register where reminders are sent. In a forum, run it inside the target topic to store `threadId` |
| `/add_member @user1 @user2` | Internal group | Add members to monitor. Text-mentions are added immediately; plain `@username` gets a Verify button |

There is also an `/all_pending` handler in the codebase to list open mentions for an internal group; wire it in `src/bot.ts` if you want it live.

## How mentions work

| Event | Result |
|-------|--------|
| Someone `@mentions` a tracked member in a registered group | Creates a `PENDING` mention (if none is already open) |
| Someone replies to a tracked member’s message | Same as above |
| That member sends a message in the same group | Open mention → `REPLIED` |
| Mention stays open past the reminder window | Bot notifies every registered internal group; status → `NOTIFIED` |
| Member/owner taps **Yes** on the reminder | → `REPLIED` |
| Member/owner taps **No** | Stays `NOTIFIED`; reminder can fire again |

Reminder timing is configured in `src/services/notifier.ts` (currently ~3 minutes for testing; comments note a 20-minute production target). The poll interval is also set there.

## Project structure

```
src/
  bot.ts                         # Bot bootstrap + owner ID
  db.ts                          # Prisma client
  handlers/
    mentionListener.ts           # Detect mentions & replies
    command/
      init_command.ts
      register_group_command.ts
      register_internal_command.ts
      add_member_command.ts
      all_pending_command.ts
  services/
    notifier.ts                  # Reminder loop + Yes/No actions
prisma/
  schema.prisma
  migrations/
```

## Data model (short)

- **Group** — tracked merchant/customer chats  
- **InternalGroup** — staff chat(s) that receive reminders (`threadId` optional for topics)  
- **Member** — monitored teammates (linked to internal groups)  
- **Mention** — open/closed mention lifecycle: `PENDING` → `NOTIFIED` → `REPLIED`

## License

ISC

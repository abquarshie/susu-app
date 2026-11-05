# Susu Savings — Next.js + Neon

The Streamlit Susu tracker rebuilt as a Next.js 16 app on Neon Postgres, with Prisma 7 and Server Actions.
Same pages (Overview, Record, Members, Share, Settings), same rules, same WhatsApp messages, same dark glass look.

## Set up

1. **Create a Neon project** at neon.tech. From *Connect*, copy two strings: the **pooled** one (host has `-pooler`) and the **direct** one.
2. **Configure**
   ```bash
   cp .env.example .env      # fill in DATABASE_URL (pooled), DIRECT_URL (direct), SESSION_SECRET, ADMIN_PASSCODE
   npm install
   npm run db:migrate        # creates or updates the tables in Neon (prisma/migrations)
   npm run dev               # http://localhost:3000
   ```
   On an empty database the app creates the group with sample members, and `ADMIN_PASSCODE` becomes the passcode.

## Move your data across from Google Sheets

1. Copy `scripts/export_blob.py` into the old Streamlit folder (the one with `.streamlit/secrets.toml`) and run
   `python export_blob.py`. It only reads the Sheet and writes `blob.json`.
2. Copy `blob.json` here, then:
   ```bash
   npm run import:sheets -- blob.json            # dry run: shows what will be imported and any warnings
   npm run import:sheets -- blob.json --write    # import (add --replace if the database already has data)
   ```
   Your existing passcode carries over. Old ticked weeks become payment records, as the Convert button used to do.
   If a turn's recorded total doesn't match its payout receipts (the old form edited a running total), the import
   adds one balancing row and says so.

## Deploy to Vercel

Import the repo, add `DATABASE_URL`, `SESSION_SECRET` and `ADMIN_PASSCODE` as environment variables, and deploy.
Neon's Vercel integration can fill in `DATABASE_URL` for you. Also add:

- `DIRECT_URL`: Neon's direct (unpooled) connection string, used for migrations. If it's missing,
  `DATABASE_URL_UNPOOLED` (set by the Neon integration) or `DATABASE_URL` is used.
- `CRON_SECRET`: any long random string. Vercel sends it with the daily job in `vercel.json`, which saves each
  week's opening cash for the "+GHS this week" figure on Overview.

`npm run build` runs `prisma generate`, then `scripts/migrate.mjs`, then `next build`. On **production** builds only,
the migrate step applies any new files in `prisma/migrations`, so a merged schema change reaches the database before
the new code goes live. Preview builds never touch the database. The first time it runs it records `0_init` as already
applied, because the tables were made with `db push` before this repo had migrations.

## Changing the tables

Edit `prisma/schema.prisma`, then add a migration with
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<n>_<name>/migration.sql`,
check the SQL, and merge. Never run `prisma db push` against Neon.

## Backups

`.github/workflows/backup.yml` saves a full copy of the database every night, kept for 30 days on the workflow's run
page. It needs one GitHub secret, `BACKUP_DATABASE_URL` (Neon's direct connection string); the file says where to add it.

## How it fits together

| File | Role |
|---|---|
| `prisma/schema.prisma` | Tables: Group (settings + `rev`), Member, Payment, Payout, TurnLock, Snapshot, Reconciliation, Activity |
| `lib/model.ts` | Every derived figure (weeks, owing, streaks, pools, funded %), ported line for line from `class Group` |
| `lib/commit.ts` | The old `commit()`: one transaction that bumps `rev` only if it still matches the page, re-checks, writes, logs |
| `app/actions.ts` | All Server Actions: sign-in, payments, payouts, corrections, settings, swap, rename, passcode, export |
| `lib/messages.ts` | WhatsApp update, reminder, onboarding, history and receipts |
| `proxy.ts` + `lib/session.ts` | Signed cookie, 30-minute idle timeout |
| `app/(app)/*` | Pages (Server Components) · `components/*` forms and dialogs (Client Components) |

## What changed from the Streamlit version

- **Payouts** take the amount handed over *now*, not a running total. Part payments add up; to reduce one, use Correction → Payout.
- **Backups**: the backups worksheet is gone. Each save is a single Postgres transaction, Neon keeps restore history
  (length depends on plan), and Settings → Data downloads a full JSON copy.
- **Rename** is a one-row update, because records point at member IDs rather than names.
- **Cycles**: Settings → Cycles closes a finished cycle and starts the next with the same members. The closed cycle
  is kept in the `Cycle` table as JSON (summary plus every record) and can be downloaded from the same screen.
- **WhatsApp numbers**: saved per member under Settings → Members. Reminders on Overview and Share, and receipts on
  Share, then open straight in that member's chat.
- **Sign-in lockout** (5 tries, 60 s) is stored in the database, so it holds across devices and server restarts.

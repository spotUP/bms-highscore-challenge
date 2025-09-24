### Storage Ops

For storage setup, policies, and verification:

- Run one-click verification:

```
npm run verify-storage
```

- See `SECURITY_UPDATES.md` section "Storage Verification: Status and How-To" for current status, RLS policies, and smoke test steps.
- See `docs/STORAGE_OPS.md` for quick troubleshooting and common tasks (upload tests, signed URLs, SDK download).

# RetroRanks - Arcade Highscore Challenge

## Project info

**URL**: https://retroranks.com

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Visit RetroRanks at https://retroranks.com to experience the ultimate arcade gaming leaderboard platform.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

### Storage Ops

For storage setup, policies, and verification:

- Run one-click verification:

```
npm run verify-storage
```

- See `SECURITY_UPDATES.md` section "Storage Verification: Status and How-To" for current status, RLS policies, and smoke test steps.
- See `docs/STORAGE_OPS.md` for quick troubleshooting and common tasks (upload tests, signed URLs, SDK download).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Edge Functions: Secrets & Health

### Project-level secrets (recommended)

Set these as project-level environment variables in the Supabase Dashboard (Settings → Configuration). Functions read them at runtime, redeploy not required.

- `FUNCTION_SUPABASE_URL` = your project URL (e.g., `https://<project-ref>.supabase.co`)
- `FUNCTION_SERVICE_ROLE_KEY` = your Service Role Key (from Dashboard → Settings → API)
- `PUBLIC_SITE_URL` or `SITE_URL` = your site URL for invite redirects (e.g., `https://retroranks.com`)

Both Edge Functions (`manage-users`, `invite-user`) will also fall back to `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` if present, but `FUNCTION_*` is preferred.

### Health endpoints

Each function supports a non-destructive health check:

- `GET|POST /functions/v1/manage-users?action=health`
- `GET|POST /functions/v1/invite-user?action=health`

When calling from the app, include an `Authorization: Bearer <access_token>` header.

### Admin UI checks

The Admin → Users header includes buttons:

- Check All Functions
- Check Function Status (manage-users)
- Check Invite Function (invite-user)

These use the current session token and display inline status badges (OK/ERR) and toasts with results.

## How can I deploy this project?

The project is deployed at https://retroranks.com using Vercel with custom domain configuration.

## I want to use a custom domain - is that possible?

This project uses a custom domain (retroranks.com) deployed on Vercel for optimal performance and reliability.

Deployment test: 2025-09-12T17:16:28+02:00

Deployment test: 2025-09-12T18:30:40+02:00

Deployment test: 2025-09-12T18:56:10+02:00

Deployment test: 2025-09-12T19:04:40+02:00

Deployment test with updated git author: Fri Sep 12 19:52:17 CEST 2025

Final deployment trigger with correct author email: Fri Sep 12 19:54:18 CEST 2025
# Redeploy trigger for RAWG API key

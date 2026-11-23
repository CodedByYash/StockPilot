# Deploying to Vercel

Three Vercel projects from this one repo, each with its own **Root Directory**:

| Project         | Root Directory | What it is                           | URL                                         |
| --------------- | -------------- | ------------------------------------ | ------------------------------------------- |
| `inventory-api` | `api`          | Express API as a serverless function | `https://inventory-api-xxxx.vercel.app`     |
| `inventory-web` | `web`          | Next.js frontend                     | `https://inventory-web-xxxx.vercel.app`     |
| `inventory-mcp` | `mcp-server`   | Remote (HTTP) MCP server             | `https://inventory-mcp-xxxx.vercel.app/mcp` |

Deploy in that order: the web app and the MCP server both need the API's URL.

## 0. MongoDB Atlas (once)

1. Create a free **M0** cluster at https://cloud.mongodb.com (transactions work on it).
2. Database Access: create a user with a password.
3. Network Access: add `0.0.0.0/0`. Vercel functions have no fixed IPs, so an IP allowlist can't work; the database user and password are the protection.
4. Copy the connection string (`mongodb+srv://...`) and put a database name in it, e.g. `.../inventory?retryWrites=true&w=majority`.

## 1. API

1. https://vercel.com/new, import the GitHub repo, set **Root Directory = `api`**. Framework preset: Other. Vercel reads `api/vercel.json` (build command, rewrites, cron jobs).
2. Environment variables:

   | Name          | Value                                       |
   | ------------- | ------------------------------------------- |
   | `MONGO_URI`   | your Atlas string                           |
   | `JWT_SECRET`  | long random string (`openssl rand -hex 32`) |
   | `CRON_SECRET` | another long random string                  |

3. Deploy, then open `https://<api>.vercel.app/health`. It should return `{"status":"ok"}`.
   If other routes return "Server failed to start", `MONGO_URI` is wrong or Atlas network access isn't open.

**Seed data / first user.** Run these from your own machine against the production database:

```bash
cd api
MONGO_URI="<atlas string>" npm run seed      # WIPES the database, then loads demo data
```

The seed creates `admin@example.com` / `Password123!`. Change that password, or skip seeding and register yourself right away: **the first account registered becomes admin**, so don't leave a live API with no users.

**Service-account token for the MCP server** (use the same `JWT_SECRET` as the deployed API):

```bash
MONGO_URI="<atlas string>" JWT_SECRET="<same as Vercel>" npm run create-service-account
```

Copy the printed token.

**Scheduled jobs.** `node-cron` can't run on serverless, so `vercel.json` registers Vercel Cron jobs that call `/cron/reorder` (02:00 UTC) and `/cron/low-stock` (03:00 UTC). Vercel sends `CRON_SECRET` as a Bearer token automatically. On the Hobby plan cron jobs can run at most once a day; on Pro you can change low-stock to hourly (`0 * * * *`) in `api/vercel.json`. You can also trigger both from the Alerts page ("Run checks now").

**Region.** In `api/vercel.json` you can add `"regions": ["bom1"]` (example: Mumbai) to put the function next to your Atlas region and cut latency.

## 2. Web

1. New Vercel project, same repo, **Root Directory = `web`** (Next.js is detected).
2. Environment variables:

   | Name                  | Value                                          |
   | --------------------- | ---------------------------------------------- |
   | `NEXT_PUBLIC_API_URL` | `/api`                                         |
   | `API_ORIGIN`          | `https://<api>.vercel.app` (no trailing slash) |

   The browser calls `/api/*` on the web domain and Vercel forwards it to the API (`web/next.config.ts`). This keeps the login cookie first-party, which a separate API domain would not (Safari and strict Chrome block third-party cookies). Both values are read at **build** time, so redeploy the web project after changing them.

3. Deploy and log in. The camera scanner needs HTTPS, which Vercel provides.

## 3. MCP server

The local setup uses stdio, which can't run on Vercel. `mcp-server/src/http.ts` serves the same 8 tools over MCP's Streamable HTTP transport instead (stateless, so it suits serverless).

1. New Vercel project, same repo, **Root Directory = `mcp-server`**, framework Other.
2. Environment variables:

   | Name                | Value                                         |
   | ------------------- | --------------------------------------------- |
   | `API_BASE_URL`      | `https://<api>.vercel.app`                    |
   | `MCP_SERVICE_TOKEN` | the service-account token from step 1         |
   | `MCP_AUTH_TOKEN`    | a new long random string clients must present |

3. Deploy. The endpoint is `https://<mcp>.vercel.app/mcp`.

**Keep `MCP_AUTH_TOKEN` secret.** Anyone who has it can call the write tools (create POs, record stock movements) as the service account. The endpoint refuses all requests if it isn't set.

Connecting a client:

```bash
# Claude Code
claude mcp add --transport http inventory https://<mcp>.vercel.app/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

```jsonc
// Claude Desktop (claude_desktop_config.json), via the mcp-remote bridge
{
  "mcpServers": {
    "inventory": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<mcp>.vercel.app/mcp",
        "--header",
        "Authorization: Bearer <MCP_AUTH_TOKEN>",
      ],
    },
  },
}
```

claude.ai's "custom connector" UI uses OAuth rather than a fixed bearer header, so this endpoint isn't meant for it as-is; the stdio setup in `mcp-server/README.md` still works for local use.

## Troubleshooting

- **A Vercel login page instead of JSON from the API or MCP URL:** Deployment Protection is on for that deployment. Project Settings > Deployment Protection, and use the production domain or turn it off for those two projects.
- **Login works but the next page says unauthorized:** the web project is calling the API directly. Check `NEXT_PUBLIC_API_URL=/api` and redeploy.
- **`502`/`ENOTFOUND` from `/api/...`:** `API_ORIGIN` was missing or wrong at build time. Fix it and redeploy.
- **Cron shows 401:** `CRON_SECRET` isn't set on the API project.

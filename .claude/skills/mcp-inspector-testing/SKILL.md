---
name: mcp-inspector-testing
description: How to correctly test MCP servers using `npx @modelcontextprotocol/inspector`, covering both basic (unprotected) and OAuth-protected servers. Includes the exact UI flow, common traps, and how to diagnose connection failures. Use this skill whenever the user wants to test, debug, or verify an MCP server with the inspector — especially when OAuth is involved, since the correct flow is non-obvious and easy to get wrong.
---

# MCP Inspector Testing

The MCP Inspector (`npx @modelcontextprotocol/inspector`) is the standard tool for testing MCP servers interactively. It lets you browse tools, call them manually, and verify authentication. The UI is a bit quirky — especially for OAuth — so follow these steps carefully.

## Starting the Inspector

```bash
npx @modelcontextprotocol/inspector
```

Opens at `http://localhost:6274`. Keep the terminal open; closing it kills the inspector.

---

## Testing a Basic (Unprotected) Server

1. Enter the server URL in the **Server URL** field (e.g., `https://your-worker.workers.dev/mcp`)
2. Click **Connect**
3. Verify: green dot appears, server name shows in the header
4. Go to **Tools** tab → click **List Tools** to confirm your tools are registered

That's it for unprotected servers.

---

## Testing an OAuth-Protected Server

This is where most people get tripped up. The main Connect button does **not** trigger the OAuth popup — you have to use a separate flow.

### Step 1: Set Connection Type to Direct

Change **Connection Type** from "Via Proxy" to **"Direct"**. This is critical for OAuth-protected remote servers — the proxy mode re-initiates its own OAuth flow on every Connect attempt, hitting `localhost:6277/authorize` which doesn't exist and will fail with "Cannot GET /authorize".

### Step 2: Enter credentials

In the inspector UI, fill in:
- **Server URL**: your MCP endpoint (e.g., `https://your-worker.workers.dev/mcp`)
- **Client ID**: the client ID you registered with your OAuth provider
- **Client Secret**: the matching secret

### Step 3: Trigger the OAuth flow (the non-obvious part)

Do **not** click the main Connect button yet. Instead:

1. Click **"Open Auth Settings"** (near the server URL field)
2. Click **"Quick OAuth Flow"**
3. A browser popup opens to your server's `/authorize` page
4. Complete authentication (e.g., enter your admin password)
5. The popup closes automatically on success

### Step 4: Connect

Now click the main **Connect** button. It will use the token obtained from the OAuth flow.

### Step 5: Verify

- Green dot = connected
- Go to **Tools** tab → **List Tools** to confirm tools are available

---

## Common Errors and Fixes

### `invalid_token` / `401 Unauthorized`

**Most likely cause**: The Client ID/Secret you entered don't match what's stored in the OAuth provider's database (KV, Redis, etc.). This happens when:
- You re-registered the client (which creates new credentials and invalidates the old ones)
- You're using credentials from a previous registration that got wiped
- The KV/storage was reset

**Fix**: Re-register the client with your OAuth provider to get fresh credentials, then update the inspector fields with the new values. Any other place using those credentials (e.g., Claude.ai connector) also needs updating.

### OAuth redirect URI mismatch

**Cause**: Your OAuth provider only has some redirect URIs registered, but the inspector uses a specific one.

The MCP Inspector uses **two** redirect URIs:
- `http://localhost:6274/oauth/callback`
- `http://localhost:6274/oauth/callback/debug`

Both must be registered with your OAuth provider when you create the client. If only one is registered, the other will fail with a redirect URI mismatch error.

**Fix**: Re-register the client with all required redirect URIs.

### No popup / nothing happens after "Quick OAuth Flow"

**Cause**: Browser popup blocker. The inspector opens the auth page in a new popup window.

**Fix**: Allow popups from `localhost:6274` in your browser settings, then retry.

### "Cannot GET /authorize" after clicking Connect

**Cause**: Connection Type is set to "Via Proxy". The proxy server at `localhost:6277` intercepts the OAuth flow and tries to redirect to its own `/authorize` endpoint, which doesn't exist.

**Fix**: Change Connection Type to **"Direct"** before connecting.

### Auth succeeds but Connect still fails

**Cause**: The token was issued before the Connect button was clicked, or the inspector's token state is stale.

**Fix**: Refresh the inspector page, re-enter credentials, redo the Quick OAuth Flow, then Connect.

---

## Important: Re-registration invalidates old credentials

Every time you re-register an OAuth client, a **new** Client ID and Secret are generated. The old ones stop working immediately. This means:

- Update the inspector with new credentials
- Update any external connectors (Claude.ai custom connector, etc.) with the same new credentials
- Don't reuse old credentials even if they look valid — they won't work

---

## Local Development

For testing against a local Wrangler dev server (`bun run dev` / `npx wrangler dev`, default `http://localhost:8787`):

1. Set URL to `http://localhost:8787/mcp`
2. **Leave Client ID and Client Secret empty** — the inspector will auto-register via `/oauth/register`
3. Open Auth Settings → **Clear OAuth State** (to drop any cached production token) → **Quick OAuth Flow**
4. On the authorize page, enter the password from your `.dev.vars` file
5. Connect

No pre-registration step needed. The local KV is ephemeral — tokens reset when you restart the dev server.

---

## Quick Reference

| Scenario | Action |
|---|---|
| Basic server | Enter URL → Connect → verify green dot |
| OAuth server (production) | Set Connection Type to **Direct** → enter URL + Client ID + Secret → Open Auth Settings → Quick OAuth Flow → authenticate → Connect |
| OAuth server (local dev) | Set Connection Type to **Direct** → enter local URL → leave credentials empty → Clear OAuth State → Quick OAuth Flow → enter `.dev.vars` password → Connect |
| `invalid_token` | Re-register client → get new credentials → update inspector + all other connectors |
| Redirect URI mismatch | Re-register client with all required redirect URIs |
| No popup | Allow popups from `localhost:6274` |
| "Cannot GET /authorize" | Change Connection Type from "Via Proxy" to "Direct" |

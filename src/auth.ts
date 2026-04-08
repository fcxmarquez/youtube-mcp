import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { Hono } from 'hono';

type Bindings = Env & { OAUTH_PROVIDER: OAuthHelpers; ADMIN_PASSWORD: string };

const app = new Hono<{ Bindings: Bindings }>();

app.get('/authorize', async (c) => {
	const params = new URL(c.req.url).searchParams;
	return c.html(`
		<html><body>
        <h2>YouTube MCP — Authorize</h2>
        <form method="POST" action="/authorize?${params}">
          <label>Password: <input type="password" name="password" /></label>
          <button type="submit">Approve</button>
        </form>
      </body></html>
		`);
});

app.post('/authorize', async (c) => {
	const body = await c.req.parseBody();

	if (body.password !== c.env.ADMIN_PASSWORD) {
		return c.html('<h2>Wrong password</h2>', 403);
	}

	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);

	const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
		request: oauthReqInfo,
		userId: 'owner',
		metadata: { label: 'Youtube MCP' },
		scope: oauthReqInfo.scope,
		props: {},
	});

	return Response.redirect(redirectTo);
});

export { app as AuthHandler };

import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';
import { AuthHandler } from './auth';
import { extractVideoId, getTranscript } from './transcript';

function createServer() {
	const server = new McpServer({
		name: 'youtube-mcp',
		version: '1.0.0',
	});

	server.registerTool(
		'get_transcript',
		{
			description: 'Get the transcript of a YouTube video',
			inputSchema: { url: z.url().describe('Youtube video URL') },
		},
		async ({ url }) => {
			const transcript = await getTranscript(extractVideoId(url));
			const content = transcript.map((snippet) => ({
				type: 'text' as const,
				text: snippet.text,
			}));

			return {
				content,
			};
		},
	);

	return server;
}

const apiHandler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		return createMcpHandler(createServer())(request, env, ctx);
	},
};

export default new OAuthProvider({
	apiRoute: '/mcp',
	apiHandler,
	defaultHandler: AuthHandler,
	authorizeEndpoint: '/authorize',
	tokenEndpoint: '/oauth/token',
	clientRegistrationEndpoint: '/oauth/register',
});

import { McpAgent } from 'agents/mcp';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export class YoutubeMCP extends McpAgent {
	server = new McpServer({
		name: 'youtube-mcp',
		version: '1.0.0',
	});

	async init() {
		this.server.registerTool(
			'tool_name',
			{
				description: 'what the tool does',
				inputSchema: { url: z.string().url().describe('Youtube video URL') },
			},
			async ({ url }) => {
				return {
					content: [{ type: 'text', text: 'Youtube video URL' }],
				};
			},
		);
	}
}

export default YoutubeMCP.serve('/mcp') satisfies ExportedHandler<Env>;

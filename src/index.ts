import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { z } from 'zod';

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
					content: [{ type: 'text', text: url }],
				};
			},
		);
	}
}

export default YoutubeMCP.serve('/mcp') satisfies ExportedHandler<Env>;

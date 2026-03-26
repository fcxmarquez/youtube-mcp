export function extractApiKey(html: string): string {
	const match = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
	if (!match) {
		throw new Error('Failed to extract INNERTUBE_API_KEY from page');
	}
	return match[1];
}

export const extractVideoId = (url: string) => {
	const pattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;

	const match = url.match(pattern);

	if (match) {
		return match[1];
	}

	throw new Error(`Invalid YouTube URL: ${url}`);
};

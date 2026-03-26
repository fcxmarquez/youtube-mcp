export const WATCH_URL = 'https://www.youtube.com/watch?v=';
export const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?key=';
export const BASE_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept-Language': 'en-US',
} as const;
export const INNERTUBE_CONTEXT = {
	client: { clientName: 'ANDROID', clientVersion: '20.10.38' },
} as const;

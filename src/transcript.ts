const WATCH_URL = 'https://www.youtube.com/watch?v=';
const INNERTUBE_API_URL = 'https://www.youtube.com/youtubei/v1/player?key=';
const BASE_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept-Language': 'en-US',
} as const;
const INNERTUBE_CONTEXT = {
	client: { clientName: 'ANDROID', clientVersion: '20.10.38' },
} as const;

import { extractApiKey } from './lib/trascript';

export interface TranscriptSnippet {
	text: string;
	start: number;
	duration: number;
}

function collectCookies(response: Response, existing: string[] = []): string[] {
	const cookies = [...existing];
	const setCookieHeader = response.headers.get('set-cookie');
	if (setCookieHeader) {
		// set-cookie headers may be comma-joined; split on cookie boundaries
		for (const part of setCookieHeader.split(/,(?=\s*\w+=)/)) {
			const kv = part.split(';')[0].trim();
			if (kv.includes('=')) {
				cookies.push(kv);
			}
		}
	}
	return cookies;
}

async function fetchVideoPage(videoId: string): Promise<{ html: string; cookies: string[] }> {
	const cookies = ['PREF=hl=en&tz=UTC', 'SOCS=CAI'];

	const response = await fetch(`${WATCH_URL}${videoId}`, {
		headers: { ...BASE_HEADERS, Cookie: cookies.join('; ') },
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch video page: ${response.status}`);
	}

	const allCookies = collectCookies(response, cookies);

	let html = await response.text();

	// Handle GDPR consent wall
	if (html.includes('action="https://consent.youtube.com/s"')) {
		const consentMatch = html.match(/name="v" value="(.*?)"/);
		if (consentMatch) {
			allCookies.push(`CONSENT=YES+${consentMatch[1]}`);
		}

		const retryResponse = await fetch(`${WATCH_URL}${videoId}`, {
			headers: { ...BASE_HEADERS, Cookie: allCookies.join('; ') },
		});

		if (!retryResponse.ok) {
			throw new Error(`Failed to fetch video page after consent: ${retryResponse.status}`);
		}

		const retryCookies = collectCookies(retryResponse, allCookies);
		html = await retryResponse.text();
		return { html, cookies: retryCookies };
	}

	return { html, cookies: allCookies };
}

async function fetchCaptionTracks(
	videoId: string,
	apiKey: string,
	cookies: string[],
): Promise<{ tracks: CaptionTrack[]; cookies: string[] }> {
	const response = await fetch(`${INNERTUBE_API_URL}${apiKey}`, {
		method: 'POST',
		headers: {
			...BASE_HEADERS,
			'Content-Type': 'application/json',
			Cookie: cookies.join('; '),
		},
		body: JSON.stringify({
			context: INNERTUBE_CONTEXT,
			videoId,
		}),
	});

	if (!response.ok) {
		throw new Error(`Innertube API request failed: ${response.status}`);
	}

	const allCookies = collectCookies(response, cookies);
	const data = (await response.json()) as InnertubeResponse;

	const status = data.playabilityStatus?.status;

	if (status && status !== 'OK') {
		const reason = data.playabilityStatus?.reason ?? 'unknown';
		throw new Error(`Video not playable: ${status} - ${reason}`);
	}

	const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
	if (!tracks || tracks.length === 0) {
		throw new Error('No caption tracks found for this video');
	}

	return { tracks, cookies: allCookies };
}

interface CaptionTrack {
	baseUrl: string;
	languageCode: string;
	kind?: string;
	name?: { runs?: Array<{ text: string }> };
}

interface InnertubeResponse {
	playabilityStatus?: { status?: string; reason?: string };
	captions?: {
		playerCaptionsTracklistRenderer?: {
			captionTracks?: CaptionTrack[];
		};
	};
}

function parseTranscriptXml(xml: string): TranscriptSnippet[] {
	const textRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
	const matches = xml.matchAll(textRegex);

	const snippets: TranscriptSnippet[] = [];
	for (const match of matches) {
		const text = decodeHtmlEntities(match[3].replace(/<[^>]*>/g, ''));
		if (text) {
			snippets.push({
				text,
				start: Number.parseFloat(match[1]),
				duration: Number.parseFloat(match[2] ?? '0'),
			});
		}
	}

	return snippets;
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)));
}

/**
 * Fetches the transcript for a YouTube video.
 *
 * Uses the same approach as youtube-transcript-api (Python):
 * 1. Fetch the video page to get cookies + INNERTUBE_API_KEY
 * 2. POST to innertube with ANDROID client to get caption track URLs
 * 3. Fetch the caption URL (XML format) with accumulated cookies
 * 4. Parse XML into structured snippets
 */
export async function getTranscript(videoId: string, language = 'en'): Promise<TranscriptSnippet[]> {
	const { html, cookies: pageCookies } = await fetchVideoPage(videoId);
	const apiKey = extractApiKey(html);

	const { tracks, cookies: allCookies } = await fetchCaptionTracks(videoId, apiKey, pageCookies);


	const track =
		tracks.find((t) => t.languageCode === language && t.kind !== 'asr') ||
		tracks.find((t) => t.languageCode.startsWith(language) && t.kind !== 'asr') ||
		tracks.find((t) => t.languageCode === language) ||
		tracks.find((t) => t.languageCode.startsWith(language)) ||
		tracks[0];

	const captionUrl = track.baseUrl.replace('&fmt=srv3', '');
	const captionResponse = await fetch(captionUrl, {
		headers: { ...BASE_HEADERS, Cookie: allCookies.join('; ') },
	});

	if (!captionResponse.ok) {
		throw new Error(`Failed to fetch captions: ${captionResponse.status}`);
	}

	const xml = await captionResponse.text();
	if (!xml) {
		throw new Error('Caption response was empty');
	}

	return parseTranscriptXml(xml);
}

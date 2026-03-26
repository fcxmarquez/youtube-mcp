import type { TranscriptSnippet } from './lib/transcript';
import { BASE_HEADERS, extractApiKey, fetchCaptionTracks, fetchVideoPage, parseTranscriptXml } from './lib/transcript';

export type { TranscriptSnippet } from './lib/transcript';
export { extractVideoId } from './lib/transcript';

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

	// Prefer official captions over auto-generated (ASR)
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

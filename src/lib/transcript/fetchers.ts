import { BASE_HEADERS, INNERTUBE_API_URL, INNERTUBE_CONTEXT, WATCH_URL } from './constants';
import type { CaptionTrack, InnertubeResponse } from './types';

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

export async function fetchVideoPage(videoId: string): Promise<{ html: string; cookies: string[] }> {
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

export async function fetchCaptionTracks(
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

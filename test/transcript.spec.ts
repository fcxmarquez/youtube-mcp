import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCaptionTracks, fetchVideoPage } from '../src/lib/transcript';
import { getTranscript } from '../src/transcript';
import { CAPTION_XML } from './lib/transcript/mocks';

// Mock only the async I/O functions — keep pure functions (extractApiKey, parseTranscriptXml) real
vi.mock('../src/lib/transcript', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../src/lib/transcript')>();
	return {
		...actual,
		fetchVideoPage: vi.fn(),
		fetchCaptionTracks: vi.fn(),
	};
});

const VIDEO_ID = 'test123';
const FAKE_HTML = '"INNERTUBE_API_KEY": "fake_api_key"';
const CAPTION_URL_OFFICIAL = 'https://caption.url/official';
const CAPTION_URL_ASR = 'https://caption.url/asr';

function makeResponse(body: string, status = 200): Response {
	return new Response(body, { status });
}

describe('getTranscript', () => {
	let mockFetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.mocked(fetchVideoPage).mockResolvedValue({ html: FAKE_HTML, cookies: [] });
		mockFetch = vi.fn().mockResolvedValue(makeResponse(CAPTION_XML));
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	describe('language track selection', () => {
		it('prefers official track over ASR when both match exact language', async () => {
			const tracks = [
				{ baseUrl: CAPTION_URL_ASR, languageCode: 'en', kind: 'asr' },
				{ baseUrl: CAPTION_URL_OFFICIAL, languageCode: 'en' },
			];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });

			await getTranscript(VIDEO_ID);

			expect(mockFetch.mock.calls[0][0]).toBe(CAPTION_URL_OFFICIAL);
		});

		it('prefers official prefix match over ASR exact match', async () => {
			const tracks = [
				{ baseUrl: CAPTION_URL_ASR, languageCode: 'es', kind: 'asr' },
				{ baseUrl: CAPTION_URL_OFFICIAL, languageCode: 'es-MX' },
			];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });

			await getTranscript(VIDEO_ID, 'es');

			expect(mockFetch.mock.calls[0][0]).toBe(CAPTION_URL_OFFICIAL);
		});

		it('falls back to ASR when no official track exists', async () => {
			const tracks = [{ baseUrl: CAPTION_URL_ASR, languageCode: 'en', kind: 'asr' }];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });

			await getTranscript(VIDEO_ID);

			expect(mockFetch.mock.calls[0][0]).toBe(CAPTION_URL_ASR);
		});

		it('falls back to first track when requested language not found', async () => {
			const FRENCH_URL = 'https://caption.url/fr';
			const tracks = [{ baseUrl: FRENCH_URL, languageCode: 'fr' }];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });

			await getTranscript(VIDEO_ID, 'en');

			expect(mockFetch.mock.calls[0][0]).toBe(FRENCH_URL);
		});
	});

	describe('error handling', () => {
		it('propagates error when video is not playable', async () => {
			vi.mocked(fetchCaptionTracks).mockRejectedValue(new Error('Video not playable: LOGIN_REQUIRED - Sign in required'));

			await expect(getTranscript(VIDEO_ID)).rejects.toThrow('Video not playable');
		});

		it('propagates error when no caption tracks exist', async () => {
			vi.mocked(fetchCaptionTracks).mockRejectedValue(new Error('No caption tracks found for this video'));

			await expect(getTranscript(VIDEO_ID)).rejects.toThrow('No caption tracks found');
		});

		it('throws when caption fetch fails', async () => {
			const tracks = [{ baseUrl: CAPTION_URL_OFFICIAL, languageCode: 'en' }];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });
			mockFetch.mockResolvedValue(makeResponse('', 500));

			await expect(getTranscript(VIDEO_ID)).rejects.toThrow('Failed to fetch captions');
		});

		it('throws when caption response is empty', async () => {
			const tracks = [{ baseUrl: CAPTION_URL_OFFICIAL, languageCode: 'en' }];
			vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });
			mockFetch.mockResolvedValue(makeResponse(''));

			await expect(getTranscript(VIDEO_ID)).rejects.toThrow('Caption response was empty');
		});
	});

	it('returns parsed snippets for a valid video', async () => {
		const tracks = [{ baseUrl: CAPTION_URL_OFFICIAL, languageCode: 'en' }];
		const xml = `<transcript>
			<text start="1.0" dur="2.0">Hello world</text>
			<text start="3.0" dur="1.5">How are you</text>
		</transcript>`;

		vi.mocked(fetchCaptionTracks).mockResolvedValue({ tracks, cookies: [] });
		mockFetch.mockResolvedValue(makeResponse(xml));

		const result = await getTranscript(VIDEO_ID);

		expect(result).toEqual([
			{ text: 'Hello world', start: 1.0, duration: 2.0 },
			{ text: 'How are you', start: 3.0, duration: 1.5 },
		]);
	});
});

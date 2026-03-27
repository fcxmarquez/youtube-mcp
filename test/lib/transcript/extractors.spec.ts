import { describe, expect, it } from 'vitest';
import { extractVideoId } from '../../../src/lib/transcript/extractors';

describe('extractVideoId', () => {
	it('extracts id from standard watch URL', () => {
		expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('extracts id from short URL', () => {
		expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('extracts id from embed URL', () => {
		expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
	});

	it('throws on invalid URL', () => {
		expect(() => extractVideoId('https://not-youtube.com/foo')).toThrow('Invalid YouTube URL');
	});
});

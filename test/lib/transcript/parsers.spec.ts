import { describe, expect, it } from 'vitest';
import { parseTranscriptXml } from '@/lib/transcript/parsers';
import { CAPTION_XML, CAPTION_XML_WITH_MULTIPLE_TEXT_TAGS, EMPTY_XML, INVALID_XML } from './mocks';

// Test parses the transcript
// Test when receiving empty string
// Test when receiving invalid XML

describe('parseTranscriptXml', () => {
	it('parses the transcript XML', () => {
		const snippets = parseTranscriptXml(CAPTION_XML);
		expect(snippets).toEqual([{ text: 'Hello world', start: 1.0, duration: 2.0 }]);
	});

	it('parses the transcript XML with multiple text tags', () => {
		const snippets = parseTranscriptXml(CAPTION_XML_WITH_MULTIPLE_TEXT_TAGS);
		expect(snippets).toEqual([
			{ text: 'Hello world', start: 1.0, duration: 2.0 },
			{ text: 'How are you', start: 3.0, duration: 1.0 },
		]);
	});

	it('returns an empty array when receiving empty string', () => {
		const snippets = parseTranscriptXml(EMPTY_XML);
		expect(snippets).toEqual([]);
	});

	it('returns an empty array when receiving invalid XML', () => {
		expect(() => parseTranscriptXml(INVALID_XML)).toThrow('Invalid XML');
	});
});

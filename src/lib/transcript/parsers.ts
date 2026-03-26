import type { TranscriptSnippet } from './types';

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

export function parseTranscriptXml(xml: string): TranscriptSnippet[] {
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

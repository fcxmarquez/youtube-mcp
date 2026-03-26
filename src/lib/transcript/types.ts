export interface TranscriptSnippet {
	text: string;
	start: number;
	duration: number;
}

export interface CaptionTrack {
	baseUrl: string;
	languageCode: string;
	kind?: string;
	name?: { runs?: Array<{ text: string }> };
}

export interface InnertubeResponse {
	playabilityStatus?: { status?: string; reason?: string };
	captions?: {
		playerCaptionsTracklistRenderer?: {
			captionTracks?: CaptionTrack[];
		};
	};
}

/**
 * @file Lightweight WAV-header peek utility.
 *
 * Used by the file uploader to determine whether a `.wav` being added
 * is longer than an hour, so the upload progress UI can warn the user
 * that processing will take noticeably longer. Runs *before* the full
 * `AudioContext.decodeAudioData` call — necessary because
 * `decodeAudioData` has a hard memory cap on multi-hour audio and
 * waiting for it to complete (or fail) before warning would defeat
 * the purpose.
 *
 * Reads only the first 64 KB of the file, walks the RIFF chunk list
 * to find `fmt ` and `data`, and computes
 * `duration = dataChunkSize / byteRate`. PCM/float WAV only; returns
 * `null` for anything we can't confidently parse (let the regular
 * decode path own those).
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-05-06
 * @version 0.2.0
 * @license MIT
 */

/** Files longer than this trigger the "may take a while" warning. */
export const LONG_DURATION_THRESHOLD_SEC = 3600;

export function isLongDuration(seconds: number | undefined | null): boolean {
	return typeof seconds === 'number' && seconds > LONG_DURATION_THRESHOLD_SEC;
}

export async function peekWavDuration(file: File): Promise<number | null> {
	const slice = await file.slice(0, 65536).arrayBuffer();
	const view = new DataView(slice);
	const ascii = new TextDecoder('ascii');
	const tagAt = (offset: number) =>
		offset + 4 <= view.byteLength ? ascii.decode(new Uint8Array(slice, offset, 4)) : '';

	if (tagAt(0) !== 'RIFF' || tagAt(8) !== 'WAVE') return null;

	let byteRate = 0;
	let dataSize = 0;
	let cursor = 12;

	while (cursor + 8 <= view.byteLength) {
		const chunkId = tagAt(cursor);
		const chunkSize = view.getUint32(cursor + 4, true);

		if (chunkId === 'fmt ' && cursor + 20 <= view.byteLength) {
			// fmt layout: format(2) channels(2) sampleRate(4) byteRate(4) ...
			byteRate = view.getUint32(cursor + 16, true);
		} else if (chunkId === 'data') {
			const remaining = file.size - (cursor + 8);
			dataSize = chunkSize === 0 || chunkSize > remaining ? remaining : chunkSize;
			break;
		}

		// Chunks are word-aligned: pad odd sizes by 1.
		cursor += 8 + chunkSize + (chunkSize % 2);
	}

	if (!byteRate || !dataSize) return null;
	return dataSize / byteRate;
}

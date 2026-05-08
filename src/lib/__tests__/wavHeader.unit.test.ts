/**
 * @file Unit tests for wavHeader.ts.
 *
 * Verifies the lightweight WAV-header peek utility used by the file
 * uploader to determine duration before the full
 * `AudioContext.decodeAudioData` call. Three tests:
 *   1. `isLongDuration` threshold semantics (3600s boundary, plus
 *      null/undefined handling).
 *   2. `peekWavDuration` reads a real 1-second fixture as ~1.0s.
 *   3. `peekWavDuration` returns null for non-WAV bytes (graceful
 *      fallback to the regular decode path).
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-05-08
 * @version 0.2.0
 * @license MIT
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
	isLongDuration,
	LONG_DURATION_THRESHOLD_SEC,
	peekWavDuration
} from '../utils/wavHeader';

const FIXTURE_DIR = resolve(__dirname, '../../../tests/fixtures');

function loadFixtureAsFile(relPath: string): File {
	const buffer = readFileSync(resolve(FIXTURE_DIR, relPath));
	return new File([buffer], relPath.split('/').pop() ?? 'fixture.wav', {
		type: 'audio/wav'
	});
}

describe('wavHeader — isLongDuration threshold semantics', () => {
	it('returns false at/below threshold, true above, false for null/undefined', () => {
		expect(isLongDuration(LONG_DURATION_THRESHOLD_SEC)).toBe(false);
		expect(isLongDuration(LONG_DURATION_THRESHOLD_SEC - 1)).toBe(false);
		expect(isLongDuration(LONG_DURATION_THRESHOLD_SEC + 1)).toBe(true);
		expect(isLongDuration(null)).toBe(false);
		expect(isLongDuration(undefined)).toBe(false);
	});
});

describe('wavHeader — peekWavDuration on real fixtures', () => {
	it('reads a 1-second WAV header as ~1.0 seconds', async () => {
		const file = loadFixtureAsFile('1_second_files/sine_440hz_1s.wav');
		const duration = await peekWavDuration(file);
		expect(duration).not.toBeNull();
		expect(duration!).toBeCloseTo(1.0, 2);
	});

	it('returns null for non-WAV bytes', async () => {
		const fakeFile = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], 'not-a-wav.bin');
		expect(await peekWavDuration(fakeFile)).toBeNull();
	});
});

/**
 * @file Downsampled time/amplitude extraction from an AudioBuffer for plotting.
 *
 * Single-purpose utility used by waveform.svelte and miniwaveform.svelte.
 * Extracted from the waveform components on 2026-05-03 so the data-reduction
 * step can be exercised in isolation by `waveformData.unit.test.ts` and
 * `waveformData.integration.test.ts`.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-05-03
 * @version 0.2.0
 * @license MIT
 */

/**
 * Reduces a slice `[start, end]` of an `AudioBuffer` to a plot-friendly
 * `{time, amplitude}` series and reports the sample's amplitude extent.
 *
 * Output is capped at ~5000 points by striding — enough resolution for
 * typical screen widths while keeping rendering responsive on long
 * clips. Only the first channel is read; for stereo input this is
 * effectively the left channel.
 */
export function extractWaveformData(
	audioBuffer: AudioBuffer,
	start: number,
	end: number,
	debug = false
) {
	const sampleRate = audioBuffer.sampleRate;
	const startSample = Math.max(0, Math.floor(start * sampleRate));
	const endSample = Math.min(Math.floor(end * sampleRate), audioBuffer.length);
	const channelData = audioBuffer.getChannelData(0);
	const maxPoints = 5000;
	const totalSamples = endSample - startSample;
	const step = totalSamples > maxPoints ? Math.ceil(totalSamples / maxPoints) : 1;
	const waveform = [];

	let minAmplitude = Infinity;
	let maxAmplitude = -Infinity;

	for (let i = startSample; i < endSample; i += step) {
		waveform.push({
			time: i / sampleRate,
			amplitude: channelData[i]
		});

		minAmplitude = Math.min(minAmplitude, channelData[i]);
		maxAmplitude = Math.max(maxAmplitude, channelData[i]);
	}

	if (debug) {
		console.log(`Extracted waveform data from ${start}s to ${end}s: ${waveform.length} points`);
		console.log(`Amplitude range: ${minAmplitude} to ${maxAmplitude}`);
	}

	if (waveform.length === 0) {
		return { waveform: [], minAmp: 0, maxAmp: 0 };
	}

	return {
		waveform: waveform,
		minAmp: minAmplitude,
		maxAmp: maxAmplitude
	};
}

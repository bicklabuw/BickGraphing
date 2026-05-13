/**
 * @file Svelte writable store that flips true while any spectrogram component
 * is mid-render.
 *
 * Waveform and miniwaveform components subscribe and skip their own D3 redraws
 * during this window, so the page doesn't churn out dozens of redundant renders
 * triggered by layout reflows and parent prop reassignments while the
 * spectrogram is busy.
 *
 * @author K. Seow <kseow@wisc.edu>
 * @created 2026-05-05
 * @version 0.2.0
 * @license MIT
 */
import { writable } from 'svelte/store';

// Whoever sets this to true is responsible for clearing it (use try /
// finally) — leaving it stuck-true would freeze waveform updates.
export const spectrogramBusy = writable(false);

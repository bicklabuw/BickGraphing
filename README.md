# Bick Graphing

[![Svelte](https://img.shields.io/badge/svelte-%23f23f55.svg?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![DOI](https://zenodo.org/badge/1134403659.svg)](https://doi.org/10.5281/zenodo.19381867)
[![arXiv](https://img.shields.io/badge/arXiv-2601.17014-b31b1b.svg)](https://arxiv.org/abs/2601.17014)
[![MIT License](https://img.shields.io/github/license/bicklabuw/BickGraphing)](LICENSE)

**Browser-based audio visualization tool** for rapid inspection of .wav recordings. Drag-and-drop waveforms + spectrograms. Client-side only.

[Check out our Live Demo](https://bicklabuw.github.io/BickGraphing/)

## Features

- **Multi-file upload** — Drag multiple large .wav files
- **Dual visualization** — Waveform + spectrogram views
- **Interactive controls** — Amplitude range, zoom, color scale
- **Offline-first** — No server, processes ~10x real-time
- **Responsive** — Mobile/desktop optimized
- **Export ready** — PNG waveforms/spectrograms

## Background

Built for **insect bioacoustics research**—rapid quality checks on field .wav recordings. Designed for non-technical users (farmers, field techs) needing instant visual feedback during remote fieldwork.

**Key motivations:**

- Offline capability for field use
- Handles hours-long recordings (~500MB peak memory)
- No coding required—drag, adjust sliders, export PNGs

## Usage

1. Open the [live demo](https://bicklabuw.github.io/BickGraphing/) or run locally with `npm run dev`.
2. Drag and drop one or more `.wav` files into the browser window.
3. Select a visualization type: **Waveform**, **Spectrogram**, or both.
4. Explore your audio:
   - **Show/Hide Details** — displays rendering metadata including start time, end time, amplitude range, and audio length.
   - **Show/Hide Sliders** — reveals interactive controls:
     - Vertical sliders to adjust the amplitude range.
     - Horizontal slider to adjust the start and end time window.
     - Reset button to restore all sliders to defaults.
   - **Download .svg** — exports the current visualization as an SVG file.
5. To view additional files, drag more `.wav` files — they appear as thumbnail waveforms in a grid for quick comparison.

No account, login, or coding required.

## Expected Output

After loading the included `test.wav` file, you should see:

**Waveform view:**

- A waveform plot showing approximately 442 seconds of audio.
- Amplitude values displayed on the y-axis (range approximately -0.01 to 0.016).
- Time displayed on the x-axis in seconds.
- Rendering details showing start time, end time, amplitude range, and audio length.

![Waveform view of test.wav](docs/images/waveform-output.png)

**Spectrogram view:**

- A spectrogram showing frequency content up to 22 kHz.
- Time on the x-axis, frequency on the y-axis.
- Turbo colormap rendering (blue = low energy, red = high energy).
- Insect vocalizations visible as distinct horizontal or harmonic bands.

![Spectrogram view of test.wav](docs/images/spectrogram-output.png)

If your output matches the screenshots above, the software is operating correctly.

For a side-by-side reference of additional example fixtures (pure tone, sweep, siren, musical scale, layered harmonics), see [`tests/outputs/README.md`](tests/outputs/README.md). Use it to compare what you're seeing in the app against known-good outputs.

## Architecture (4 Layers)

```
┌─ File I/O           FileSelector.svelte, FileList.svelte
│
├─ Signal Processing  ├─ FFmpeg.wasm (.wav decode)
│                     └─ fft.ts (512pt STFT)
│
├─ Visualization      ├─ graph.svelte (orchestrator)
│                     ├─ waveform.svelte
│                     └─ spectrogram.svelte
│
└─ Controls           RangeSlider.svelte, ViewSelector.svelte
```

## Tech Stack

| Layer     | Tech                                     |
| --------- | ---------------------------------------- |
| Framework | SvelteKit 2.16+, TypeScript, Vite        |
| Audio     | FFmpeg.wasm, Web Audio API               |
| Viz       | D3.js (scales), Canvas2D                 |
| Styling   | TailwindCSS 3.4, PostCSS, autoprefixer   |
| Controls  | noUiSlider, svelte-dnd-action            |
| Testing   | Vitest, librosa (Python, fixture parity) |

**Bundle:** ~30MB (FFmpeg + deps), loads in <5s modern browsers

## Dependencies

BickGraphing is implemented in TypeScript with SvelteKit and relies on the following main packages.

- **Core framework and tooling**
  - Svelte 5.0.0 or later
  - SvelteKit (`@sveltejs/kit`) 2.16.0 or later
  - `@sveltejs/adapter-static` 3.0.10 or later
  - `@sveltejs/vite-plugin-svelte` 5.0.0 or later
  - Vite 6.0.0 or later
- **Styling**
  - Tailwind CSS 3.4.17 or later
  - `@tailwindcss/forms` 0.5.9 or later
  - `@tailwindcss/typography` 0.5.15 or later
  - `@tailwindcss/vite` 4.0.0 or later
  - PostCSS 8.5.3 or later
  - autoprefixer 10.4.21 or later
- **Audio processing**
  - `@ffmpeg/core` 0.12.6 or later
  - `@ffmpeg/ffmpeg` 0.12.15 or later
  - `@ffmpeg/util` 0.12.2 or later
- **Visualisation and interaction**
  - D3 7.9.0 or later
  - `@types/d3` 7.4.3 or later
  - nouislider 15.8.1 or later
  - svelte-dnd-action 0.9.61 or later
- **Development and quality tools**
  - TypeScript 5.0.0 or later
  - svelte-check 4.0.0 or later
  - ESLint 9.18.0 or later, with `eslint-config-prettier` and `eslint-plugin-svelte`
  - typescript-eslint 8.20.0 or later
  - Prettier 3.4.2 or later, with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`
  - cross-env 10.1.0 or later
  - gh-pages 6.3.0 or later
- **Testing**
  - Vitest 4.1.5 or later
  - `@types/node` 25.6.0 or later

## Developer Installation Guide

These instructions are made for ubuntu machines:

Install Node:

```
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl software-properties-common
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Config your bash file:

```
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=$HOME/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

Check to see if Node exists

```
node -v
```

If you did this correctly - output should look like this:

```
v20.18.3
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Testing & Validation

The signal-processing pipeline is covered by a Vitest suite that includes
unit tests on the Hann window, integration tests on the composed STFT,
and characterization tests that compare our output bin-for-bin against
[librosa](https://librosa.org/) as a reference implementation.

```bash
npm test
```

Python fixtures (committed under `tests/fixtures/`) only need to be
regenerated if you change test parameters:

```bash
pip install -r tests/requirements.txt
npm run test:fixtures
```

For full documentation — test categories, librosa parameters, fixture
reproducibility notes, and instructions for extending the suite — see
[`tests/README.md`](tests/README.md).

## Deployment

BickGraphing is hosted on **GitHub Pages** at <https://bicklabuw.github.io/BickGraphing/>.

### How a release is deployed

The deploy is automated through a single npm script:

```bash
npm run deploy
```

Under the hood, this runs:

1. `cross-env GITHUB_PAGES=true npm run build` — produces a static build under `build/` with the GitHub Pages base path (`/BickGraphing`) baked into all asset URLs.
2. `npx gh-pages -d build` — pushes the contents of `build/` to the `gh-pages` branch of the repository, which GitHub Pages then serves.

### How the base path works

Because GitHub Pages serves the site from `/BickGraphing/` rather than the domain root, every internal URL must respect that base. This is handled by:

- `svelte.config.js` setting `paths.base = '/BickGraphing'` whenever `GITHUB_PAGES=true` is set in the environment.
- All Svelte templates using SvelteKit's `asset()` and `base` helpers from `$app/paths` for static assets and internal links.
- `app.html` using the `%sveltekit.assets%` placeholder for the favicon.

### SPA routing on GitHub Pages

GitHub Pages doesn't natively support client-side routing — it returns a `404` for any path that isn't an actual file. To work around this, the build emits `build/404.html` (configured via `fallback: '404.html'` in `svelte.config.js`). GitHub Pages serves this file for any unknown route, and the SvelteKit shell inside it takes over and renders the correct page client-side. This is why every route resolves through the same `404.html` entry point.

### Earlier deployment

Version 0.1.0 was originally hosted on UW–Madison's GitLab Pages at <https://ie-graphing-709865.pages.doit.wisc.edu> (still online for archival purposes).

## Citation

If you use BickGraphing in your research, please cite our preprint:

> Seow, K., Arovas, A., Steinmetz, G., & Bick, E. (2026). _BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings_. arXiv:2601.17014 [eess.AS]. https://arxiv.org/abs/2601.17014

**BibTeX:**

```bibtex
@misc{seow2026bickgraphing,
  title         = {BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings},
  author        = {Seow, Kayley and Arovas, Alexander and Steinmetz, Grace and Bick, Emily},
  year          = {2026},
  eprint        = {2601.17014},
  archivePrefix = {arXiv},
  primaryClass  = {eess.AS},
  url           = {https://arxiv.org/abs/2601.17014}
}
```

For citing a specific software release, see [`CITATION.cff`](CITATION.cff) or use the Zenodo DOI badge above.

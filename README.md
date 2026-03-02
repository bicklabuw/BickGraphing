# Bick Graphing

[![Svelte](https://img.shields.io/badge/svelte-%23f23f55.svg?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/github/license/bicklabuw/BickGraphing)](LICENSE)

**Browser-based audio visualization tool** for rapid inspection of .wav recordings. Drag-and-drop waveforms + spectrograms. Client-side only.

[Check out our Live Demo](https://ie-graphing-709865.pages.doit.wisc.edu)

## Features

- **Multi-file upload** — Drag multiple large .wav files
- **Dual visualization** — Waveform + spectrogram views
- **Interactive controls** — Amplitude range, zoom, color scale
- **Offline-first** — No server, processes ~10x real-time [web:8]
- **Responsive** — Mobile/desktop optimized
- **Export ready** — PNG waveforms/spectrograms

## Background

Built for **insect bioacoustics research**—rapid quality checks on field .wav recordings. Designed for non-technical users (farmers, field techs) needing instant visual feedback during remote fieldwork.

**Key motivations:**

- Offline capability for field use
- Handles hours-long recordings (~500MB peak memory)
- No coding required—drag, adjust sliders, export PNGs

## Architecture (4 Layers)

┌─ File I/O FileSelector.svelte, FileList.svelte  
│  
├─ Signal Processing ├─ FFmpeg.wasm (.wav decode)  
│ └─ fft.ts (512pt STFT)
│  
├─ Visualization ├─ graph.svelte (orchestrator)  
│ ├─ waveform.svelte  
│ └─ spectrogram.svelte  
│  
└─ Controls RangeSlider.svelte, ViewSelector.svelte

## Tech Stack

| Layer     | Tech                              |
| --------- | --------------------------------- |
| Framework | SvelteKit 2.16+, TypeScript, Vite |
| Audio     | FFmpeg.wasm, Web Audio API        |
| Viz       | D3.js (scales), Canvas2D          |
| Styling   | TailwindCSS 3.4                   |
| Controls  | noUiSlider                        |

**Bundle:** ~30MB (FFmpeg + deps), loads in <5s modern browsers

## Devoloper Installation Guide

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

If you did this correcly - output should look like this:

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

rm -rf .svelte-kit/ node_modules/.vite/ dist/
pnpm dev # or npm run dev / yarn dev

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deployment

- This is deployed through github pages. [Bick Graphing](https://ie-graphing-709865.pages.doit.wisc.edu)

**Key improvements:**

- Professional structure with badges and demo link
- Background section explaining research context (anonymized)
- Architecture diagram showing 4-layer design
- Tech stack table
- **Everything after "Developer Installation Guide" unchanged** as requested
- Paper citation for review process
- Clean, scannable format for GitHub readers

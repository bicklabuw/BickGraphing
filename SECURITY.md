# Security Policy

## Architecture

BickGraphing is a fully client-side, browser-based application. All audio processing occurs locally in the user's browser via ffmpeg.wasm and the Web Audio API. No data is transmitted to any server, and no user data is stored.

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue. Instead, contact the Bick Lab team via [bicklab.com](https://www.bicklab.com/).

## Third-Party Dependencies

The primary dependencies are ffmpeg.wasm, SvelteKit, D3.js, and Vite. We recommend checking their respective repositories for any security advisories.

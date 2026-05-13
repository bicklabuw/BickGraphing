# Contributing to BickGraphing

Thanks for taking the time to contribute. BickGraphing is a small, single-purpose tool for visually inspecting `.wav` recordings in the browser, maintained by the Bick Lab at UW–Madison. This guide explains how to ask questions, report bugs, and submit changes.

## Contents

- [Asking questions and reporting bugs](#asking-questions-and-reporting-bugs)
- [Getting set up locally](#getting-set-up-locally)
- [Development workflow](#development-workflow)
- [Pull requests](#pull-requests)
- [Tests and fixtures](#tests-and-fixtures)
- [Code style](#code-style)
- [File headers](#file-headers)
- [Code of Conduct](#code-of-conduct)

## Asking questions and reporting bugs

The best place to start is a [GitHub issue](https://github.com/bicklabuw/BickGraphing/issues). Please search existing issues first so we can keep related discussion in one thread.

For questions that are not a good fit for a public issue (private datasets, unpublished research context, collaboration requests), the preferred contact route is the **Bick Lab website** at <https://bicklab.com>. The contact form there reaches the same inbox.

If you specifically need to email, you can reach out via the email on the [website](https://bicklab.com).

When reporting a bug, please include:

- A short description of what you expected and what you saw.
- The browser and OS you reproduced it on (Chromium-based browsers are best supported).
- A sample `.wav` file, or the duration and sample rate of the file that triggered the issue, if you cannot share it.
- Any error messages from the browser DevTools console.

## Getting set up locally

The full local setup, build, and deploy instructions live in the [README](../README.md#local-setup). The short version:

```bash
npm install
npm run dev -- --open
```

Node 24+ is required. Python (with the packages in `tests/requirements.txt`) is only needed if you plan to regenerate the librosa fixtures.

## Development workflow

A typical change goes:

1. Create a topic branch off `main`. Use a short, descriptive name (`feat/spectrogram-cache`, `fix/decode-cap`).
2. Make focused commits. One logical change per commit makes review easier.
3. Run the project's checks before opening a PR:
   ```bash
   npm run check    # svelte-check, type errors
   npm run lint     # prettier --check + eslint
   npm run test     # vitest, including the librosa parity tests
   npm run build    # production build
   ```
   The shortcut `npm run commit` runs all of the above and opens a preview of the production build.
4. Open a pull request against `main` with a brief summary and a link to the related issue if one exists.

Because this repository is also the artifact for a JORS submission, please leave a brief paper-friendly note in the PR description when a change affects user-facing behavior, the signal-processing pipeline, or test parity with librosa. A reviewer reading the repo a year from now should be able to understand _why_ a change happened, not just _what_ changed.

## Pull requests

- Keep PRs scoped. Small, single-purpose PRs are reviewed faster than large ones.
- Update the README, FAQ, or `tests/README.md` when you change behavior that those documents describe.
- Include a screenshot or short clip for any visible UI change.
- If you touch STFT parameters, the FFT, or the windowing logic, please confirm the librosa parity tests still pass and call that out in the PR description.
- Do not introduce client-side persistent storage (localStorage, IndexedDB, cookies) without discussing it first. The tool intentionally runs entirely in memory.

## Tests and fixtures

Vitest covers the Hann window, the composed STFT, and a characterization test that compares our output bin-for-bin against [librosa](https://librosa.org/). Run the suite with `npm test`.

The Python fixtures committed under `tests/fixtures/` only need to be regenerated if you change the test parameters:

```bash
pip install -r tests/requirements.txt
npm run test:fixtures
```

See [`tests/README.md`](../tests/README.md) for full details on test categories, parameters, and how to extend the suite.

## Code style

- TypeScript and Svelte 5 across the app, Tailwind for styling.
- Formatting is enforced by Prettier (with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`); linting by ESLint. Run `npm run format` to auto-fix.
- Prefer adding to existing components and utilities under `src/lib/` over creating parallel implementations.
- Keep changes minimal and targeted. Avoid unrelated refactors in the same PR.

## File headers

Most source files in `src/` carry a small JSDoc-style header that identifies who wrote the file and when. The convention is:

- `@author` is the current primary maintainer or implementer of the file. Update this when authorship has materially shifted, typically when a new author owns the majority of remaining lines.
- `@contributors` lists substantial historical or original contributors. Add a name here when someone has contributed meaningful work that does not warrant `@author` status, or when authorship has changed and the previous author should still be credited.
- Include `@contributors` only when there is at least one actual contributor to list. Omit the tag entirely if the file has a sole author.

Svelte components use the `@component` form inside an HTML comment block; TypeScript files use `@file` inside a JSDoc block. Look at `src/lib/components/spectrogram.svelte` or `src/lib/utils/wavHeader.ts` for the exact shape.

Some files intentionally have no header:

- Framework boilerplate (`src/app.d.ts`, `src/lib/index.ts`).
- Source-derived utilities adapted from textbook algorithms or external code (`src/lib/utils/fft.ts`, `src/lib/utils/audioProcessing.ts`).

## Code of Conduct

This project follows a Code of Conduct. By participating, you agree to abide by its terms. See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

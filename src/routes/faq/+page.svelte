<script lang="ts">
	let faqs = [
		{
			question: 'Is this tool free to use?',
			answer: 'Yes. Bick Graphing is completely free and runs entirely in your browser.'
		},
		{
			question: 'Can I use this offline?',
			answer:
				'Absolutely. The tool works offline after the initial load, and no data ever leaves your device.'
		},
		{
			question: 'What file types are supported?',
			answer: 'Currently, only .wav files are supported for visualization.'
		},
		{
			question: 'What kinds of recordings is this designed for?',
			answer: `Bick Graphing was originally built to support insect bioacoustics research as part of the <a href="https://www.insecteavesdropper.com/home" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">Insect Eavesdropper</a> project, but it works for any .wav recording you'd like to inspect visually.`
		},
		{
			question: 'Where can I learn more about the tool and the research behind it?',
			answer: `We've written a preprint that goes into the design and motivation in more detail — you can read it on <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv</a>.`
		},
		{
			question: 'Is the source code available?',
			answer: `Yes! Bick Graphing is open source under the MIT license. You can browse the source, file issues, or contribute on <a href="https://github.com/bicklabuw/BickGraphing" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">GitHub</a>.`
		},
		{
			question: 'How should I cite Bick Graphing in my research?',
			answer: `If you end up using Bick Graphing in academic work, please cite our <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">arXiv preprint</a>:<blockquote class="my-3 border-l-4 border-purple-300 bg-gray-50 px-4 py-2 text-xs italic text-gray-700">Seow, K., Arovas, A., Steinmetz, G., &amp; Bick, E. (2026). <em>BickGraphing: Web-Based Application for Visual Inspection of Audio Recordings</em>. arXiv:2601.17014 [eess.AS]. <a href="https://arxiv.org/abs/2601.17014" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://arxiv.org/abs/2601.17014</a></blockquote>The repository's README includes a ready-to-paste BibTeX entry, and a <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">CITATION.cff</code> file is available for citation managers.`
		},
		{
			question: 'Where can I find the original version of Bick Graphing?',
			answer: `The original v0.1.0 was designed by Grace Steinmetz and Alex Arovas, and is still hosted on UW–Madison's GitLab Pages at <a href="https://ie-graphing-709865.pages.doit.wisc.edu" target="_blank" rel="noopener noreferrer" class="text-purple-600 underline hover:text-purple-800">https://ie-graphing-709865.pages.doit.wisc.edu</a>.`
		}
	];
</script>

<section class="min-h-screen px-3 py-7 text-gray-900">
	<div class="mx-auto max-w-3xl">
		<h1 class="mb-12 text-center text-4xl font-bold text-gray-900">Frequently Asked Questions</h1>

		<div class="space-y-6">
			{#each faqs as faq (faq.question)}
				<div class="rounded-xl bg-white p-6 shadow-md transition hover:shadow-lg">
					<h2 class="mb-2 text-lg font-semibold text-purple-700">{faq.question}</h2>
					<p class="text-sm text-gray-600">{@html faq.answer}</p>
				</div>
			{/each}
		</div>

		<div class="mt-12 text-center">
			<p class="text-sm text-gray-500">
				Still have questions?
				<a
					href="https://www.bicklab.com/"
					class="text-purple-600 underline hover:text-purple-800"
					target="_blank"
					rel="noopener noreferrer"
				>
					Contact us
				</a>
			</p>
		</div>
	</div>
</section>

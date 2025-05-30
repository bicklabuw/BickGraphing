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
					<p class="text-sm text-gray-600">{faq.answer}</p>
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

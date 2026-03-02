import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const isProd = process.env.NODE_ENV === 'production';
const isGitHub = process.env.GITHUB_PAGES === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			// fallback: 'index.html' // <-- This is the key fix
			fallback: isGitHub ? '404.html' : 'index.html'
		}),
		paths: {
			base: isGitHub ? '/BickGraphing' : '',
			relative: false
		},
		prerender: {
			// entries: ['*']
			entries: [],
			handleUnseenRoutes: 'ignore' // just for gh pages
		}
	}
};

export default config;

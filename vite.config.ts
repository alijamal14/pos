
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$routes: path.resolve('./src/routes'),
		}
	},
	css: {
		preprocessorOptions: {
			// Tailwind handled via postcss.config.js
		}
	}
});

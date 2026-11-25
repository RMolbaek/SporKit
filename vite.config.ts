import { defineConfig } from 'vite';

// base './' gør at bygget virker både på GitHub Pages (/sporkit/) og lokalt.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});

import { defineConfig } from 'vitest/config';
export default defineConfig({test:{environment:'jsdom'},server:{proxy:{'/api':'http://127.0.0.1:8000'}},build:{rollupOptions:{output:{manualChunks:{graph:['cytoscape'],react:['react','react-dom']}}}}});

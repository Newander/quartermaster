import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({command, mode}) => {
    // Загружаем переменные из .env файлов, если нужно
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080';

    const isDev = command === 'serve'; // true при локальном запуске (npm run dev)

    return {
        base: '/hema-crm/',
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            host: false,
            port: 8123,
            strictPort: true,
            allowedHosts: ['historycznesztukiwalki.pl', 'localhost'],
            proxy: {
                // Используем регулярное выражение, чтобы поймать запрос с любого места
                '^/hema-crm/api/.*': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                    secure: false,
                    // Если бэкенд НЕ ожидает /hema-crm в начале пути, оставляем rewrite:
                    rewrite: (path) => {
                        if (isDev) {
                            return path.replace(/^\/hema-crm\/api/, '/api');
                        }
                        return path;
                    },
                },
                '/api': {
                    target: apiProxyTarget,
                    changeOrigin: true,
                },
            },
        },
        test: {
            environment: 'jsdom',
            globals: true,
            setupFiles: ['src/tests/setup.ts'],
        },
    }
})

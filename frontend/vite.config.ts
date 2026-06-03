import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function getVendorChunk(id: string): string | undefined {
    if (!id.includes('node_modules')) {
        return undefined
    }

    if (
        id.includes('/node_modules/react/') ||
        id.includes('/node_modules/react-dom/') ||
        id.includes('/node_modules/scheduler/')
    ) {
        return 'vendor-react'
    }

    if (id.includes('/node_modules/@radix-ui/')) {
        return 'vendor-radix'
    }

    if (
        id.includes('/node_modules/@dnd-kit/') ||
        id.includes('/node_modules/@tanstack/react-table/')
    ) {
        return 'vendor-table-dnd'
    }

    if (
        id.includes('/node_modules/recharts/') ||
        id.includes('/node_modules/d3-') ||
        id.includes('/node_modules/victory-vendor/')
    ) {
        return 'vendor-charts'
    }

    if (
        id.includes('/node_modules/@hookform/') ||
        id.includes('/node_modules/react-hook-form/') ||
        id.includes('/node_modules/zod/')
    ) {
        return 'vendor-forms'
    }

    if (
        id.includes('/node_modules/@remixicon/') ||
        id.includes('/node_modules/class-variance-authority/') ||
        id.includes('/node_modules/clsx/') ||
        id.includes('/node_modules/cmdk/') ||
        id.includes('/node_modules/lucide-react/') ||
        id.includes('/node_modules/radix-ui/') ||
        id.includes('/node_modules/react-resizable-panels/') ||
        id.includes('/node_modules/sonner/') ||
        id.includes('/node_modules/tailwind-merge/') ||
        id.includes('/node_modules/vaul/')
    ) {
        return 'vendor-ui'
    }

    return 'vendor'
}

// https://vitejs.dev/config/
export default defineConfig(({command, mode}) => {
    // Загружаем переменные из .env файлов, если нужно
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080';

    const isDev = command === 'serve'; // true при локальном запуске (npm run dev)

    return {
        base: '/hema-crm/',
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            rollupOptions: {
                output: {
                    manualChunks: getVendorChunk,
                },
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

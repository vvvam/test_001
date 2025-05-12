import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { UserConfig } from 'vite'

// 获取__dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Vite在ESM环境中运行，不支持__dirname和require，使用import替代
const host = process.env.TAURI_DEV_HOST

// 默认端口
const DEFAULT_PORT = 3007

// 动态端口设置
async function findFreePort(startPort: number): Promise<number> {
  try {
    const net = await import('net')
    return new Promise<number>((resolve, reject) => {
      const server = net.default.createServer()
      server.on('error', (err: { code: string }) => {
        if (err.code === 'EADDRINUSE') {
          // 当前端口被占用，尝试下一个端口
          findFreePort(startPort + 1).then(resolve).catch(reject)
        } else {
          reject(err)
        }
      })
      server.listen(startPort, () => {
        server.close(() => {
          resolve(startPort)
        })
      })
    })
  } catch (error) {
    console.error('获取可用端口失败:', error)
    return startPort // 出错时返回原始端口
  }
}

// 更新Tauri配置文件
async function updateTauriConfig(port: number): Promise<void> {
  const tauriConfigPath = path.resolve(__dirname, 'src-tauri/tauri.conf.json')
  if (fs.existsSync(tauriConfigPath)) {
    try {
      const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf-8'))
      tauriConfig.build.devUrl = `http://localhost:${port}`
      fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2))
      console.log(`已更新Tauri配置，使用端口: ${port}`)
    } catch (error) {
      console.error('更新Tauri配置失败:', error)
    }
  }
}

// 动态配置Vite
const dynamicConfig = async () => {
  // 寻找可用端口
  const port = await findFreePort(DEFAULT_PORT)
  
  // 如果找到的端口不是默认端口，更新Tauri配置
  if (port !== DEFAULT_PORT) {
    await updateTauriConfig(port)
  }
  
  return {
    plugins: [react()],
    clearScreen: false,
    server: {
      port,
      strictPort: false, // 允许端口回退
    },
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
      target: ['es2021', 'chrome100', 'safari13'],
      minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
      sourcemap: !!process.env.TAURI_DEBUG,
    },
    optimizeDeps: {
      include: ['@tauri-apps/api'],
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  } as UserConfig
}

// https://vitejs.dev/config/
export default defineConfig(dynamicConfig())

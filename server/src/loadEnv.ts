import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

/** Всегда грузим server/.env, даже если npm запущен из корня репозитория */
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(serverRoot, '.env') })

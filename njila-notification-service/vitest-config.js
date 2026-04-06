import { defineConfig } from 'vitest/config'
import dotenv from 'dotenv'

export default defineConfig({
  test: {
    environment: 'node',
    // On force le chargement du .env avant de lancer les tests
    env: dotenv.config().parsed 
  },
})
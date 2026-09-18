import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import AuthGate from '@/Components/auth/AuthGate'

export default function App({ Component, pageProps }: AppProps) {
  return <AuthGate><Component {...pageProps} /></AuthGate>
}

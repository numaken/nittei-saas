import type { AppProps } from 'next/app'
import 'uikit/dist/css/uikit.min.css'  // ← UIkitのCSSはここで一括読み込み

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

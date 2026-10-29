import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        {/* Apply a saved light theme before first paint so it doesn't flash dark */}
        <script
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

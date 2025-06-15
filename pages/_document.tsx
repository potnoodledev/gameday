import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@400;600;700&display=swap" rel="stylesheet" />
        <style>{`body, html, * { font-family: 'Darker Grotesque', sans-serif !important; }`}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 
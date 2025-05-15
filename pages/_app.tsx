import React from 'react'; // Add React import for JSX
import type { AppProps } from 'next/app';
import '../styles/globals.css'; // Import global styles from the original index.html

// Providers from wallet-example
import { ChakraProvider } from "@chakra-ui/react";
import WalletContextProvider from "../contexts/WalletContextProvider";
import SessionProvider from "../contexts/SessionProvider"; // Adjusted path
import { GameStateProvider } from "../contexts/GameStateProvider"; // Adjusted path
import { NftProvider } from "../contexts/NftProvider"; // Adjusted path

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider>
      <WalletContextProvider>
        <SessionProvider>
          <GameStateProvider>
            <NftProvider>
              <Component {...pageProps} />
            </NftProvider>
          </GameStateProvider>
        </SessionProvider>
      </WalletContextProvider>
    </ChakraProvider>
  );
}

export default MyApp; 
import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { io } from 'socket.io-client'; // Assuming socket.io-client is a dependency or using CDN version
import WalletMultiButton from '../components/WalletMultiButton'; // Import the wallet button
import { useRouter } from 'next/router';
import Layout, { games } from '../components/Layout'; // Import games from Layout

// If specific components from wallet-example are needed here, they would be imported.
// For now, this focuses on migrating index.html content.

// Games array - can be imported from a shared file or Layout if it exports it
// For simplicity here, duplicating it. Ideally, share from one source.
// const games = [...]; // Remove this duplicate definition

export default function GameSelectionPage() {
  const router = useRouter();

  const handleGameSelect = (gameId) => {
    router.push(`/game/${gameId}`);
  };

  return (
    <Layout currentGameIdFromProp={null}>
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#181a1b] z-40">
        <div className="text-3xl font-bold mb-8 text-[#b5e3ff]">Select a Game</div>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => handleGameSelect(game.id)}
              className="w-full px-6 py-4 rounded-xl bg-[#b5e3ff] text-[#181a1b] font-bold text-xl hover:bg-[#ffe082] transition"
            >
              {game.name}
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
} 
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet
import WalletMultiButton from '../components/WalletMultiButton'; // Import the wallet button
import { useRouter } from 'next/router';
import Layout from '../components/Layout'; // Removed games import from Layout as we'll use mock data here

// Mock data for "All Community Games" - can be replaced with a separate API call later
const mockUsersWithGames = [
  {
    userId: 'user2', // Different from a potential logged-in user
    userName: 'Bob',
    games: [
      { gameId: 'gameC', gameName: 'Racing Mania', lastUpdated: '2024-07-29T08:45:00Z', status: 'Paused' },
    ],
  },
  {
    userId: 'user3',
    userName: 'Charlie',
    games: [
      { gameId: 'gameD', gameName: 'Puzzle World', lastUpdated: '2024-07-28T12:15:00Z', status: 'In Progress' },
    ],
  },
];

// Helper function to create a URL-friendly slug from a game name
const createSlug = (name) => {
  if (!name) return 'game'; // Fallback for undefined or null names
  return name
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Trim hyphen from start of text
    .replace(/-+$/, ''); // Trim hyphen from end of text
};

// Add this utility function near the top of the file, after the imports
const truncateWalletAddress = (address) => {
  if (!address) return '';
  if (address.length <= 12) return address; // Don't truncate if already short
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Updated GameList component for better UX and creator info
const GameList = ({ games, onGameSelect, isMyGames = false }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
    {games.map((game) => (
      <div
        key={game.gameId}
        className="bg-slate-800 p-6 rounded-xl shadow-lg hover:shadow-pink-500/30 transition-all duration-300 ease-in-out transform hover:-translate-y-1 flex flex-col justify-between"
      >
        <div>
          <div className="flex flex-col sm:flex-row justify-between sm:items-start mb-3">
            <h2 className="text-2xl font-semibold text-pink-400 mb-2 sm:mb-0 pr-2">
              {game.gameName || 'Untitled Game'}
            </h2>
            <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full whitespace-nowrap">
              Updated: {new Date(game.lastUpdated).toLocaleDateString()}
            </span>
          </div>

          {!isMyGames && game.userName && (
            <div className="flex items-center mb-4 text-sm">
              {game.creatorProfilePicUrl ? (
                <img
                  src={game.creatorProfilePicUrl}
                  alt={game.userName}
                  className="w-8 h-8 rounded-full mr-2.5 object-cover border-2 border-slate-600"
                />
              ) : (
                <div className="w-8 h-8 rounded-full mr-2.5 bg-slate-700 flex items-center justify-center text-slate-400 text-xs border-2 border-slate-600">
                  {game.userName?.substring(0,1).toUpperCase() || 'U'}
                </div>
              )}
              <div>
                <span className="text-slate-500">Creator: </span>
                <span className="font-medium text-sky-400 hover:text-sky-300 transition-colors">{truncateWalletAddress(game.userName)}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onGameSelect(game.gameId, game.gameName)}
          className="mt-4 w-full px-5 py-2.5 rounded-lg bg-pink-500 text-white font-bold text-md hover:bg-pink-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-opacity-75"
        >
          View Game
        </button>
      </div>
    ))}
  </div>
);

export default function UserGameListPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [myGames, setMyGames] = useState([]);
  const [allCommunityGames, setAllCommunityGames] = useState([]);
  const [loadingMyGames, setLoadingMyGames] = useState(false);
  const [loadingCommunityGames, setLoadingCommunityGames] = useState(false);

  useEffect(() => {
    // Fetch user's games
    const fetchMyGames = async () => {
      if (connected && publicKey) {
        setLoadingMyGames(true);
        try {
          const response = await fetch(`/api/get-user-games?walletAddress=${publicKey.toBase58()}`);
          if (response.ok) {
            const data = await response.json();
            const formattedGames = data.games.map(game => ({
              gameId: game.id, 
              gameName: game.game_name, 
              lastUpdated: game.updated_at,
            }));
            setMyGames(formattedGames);
          } else {
            console.error('Failed to fetch my games:', await response.text());
            setMyGames([]);
          }
        } catch (error) {
          console.error('Error fetching my games:', error);
          setMyGames([]);
        }
        setLoadingMyGames(false);
      } else {
        setMyGames([]);
      }
    };

    // Fetch all community games
    const fetchAllCommunityGames = async () => {
      setLoadingCommunityGames(true);
      try {
        const response = await fetch('/api/get-all-games');
        if (response.ok) {
          const data = await response.json();
          // Data from API is now: { gameId, gameName, userId, userName, lastUpdated, creatorProfilePicUrl }
          setAllCommunityGames(data.games || []); 
        } else {
          console.error('Failed to fetch all community games:', await response.text());
          setAllCommunityGames([]);
        }
      } catch (error) {
        console.error('Error fetching all community games:', error);
        setAllCommunityGames([]);
      }
      setLoadingCommunityGames(false);
    };

    if (connected && publicKey) {
        fetchMyGames();
    } else {
        setMyGames([]); // Clear my games if wallet disconnects
    }
    fetchAllCommunityGames(); // Fetch community games regardless of wallet status

  }, [connected, publicKey]);

  const handleGameSelect = (gameId, gameName) => {
    const gameSlug = createSlug(gameName || 'game');
    router.push(`/game/${gameId}/${gameSlug}`);
  };

  return (
    <Layout currentGameIdFromProp={null}>
      <Head>
        <title>Game Hub | Noods.cc</title>
        <meta name="description" content="Your games and community games on Noods.cc" />
      </Head>
      <div className="bg-slate-900 pb-8 px-4 sm:px-6 lg:px-8 text-slate-100">
        <div className="max-w-7xl mx-auto">
          <header className="mb-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-sky-500 pb-2">
              Noods.cc Game Hub
            </h1>
            <p className="text-slate-400 text-md sm:text-lg mt-2">
              Make and play games with <a href="https://x.com/potnoodledev" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 underline">PotNoodleDev</a> and help build the future of agentic games!
            </p>
          </header>

          {/* Container for the two columns. */}
          <div className="flex flex-col md:flex-row md:space-x-8 lg:space-x-12">
            {/* Aside (Tweet card) - Restored visibility for mobile (w-full, mb-8) */}
            <aside className="w-full md:w-1/3 lg:w-1/4 mb-8 md:mb-0 md:sticky md:top-[92px] md:max-h-[calc(100vh-116px)] md:overflow-y-auto">
              <div className="border border-slate-700 rounded-lg p-3 sm:p-4 bg-slate-800 shadow-lg">
                <div className="flex items-start mb-2.5">
                  <div className="w-10 h-10 rounded-full mr-2.5 bg-pink-500 flex-shrink-0"><img src="/potnoodledev.jpg" alt="PotNoodleDev" className="w-10 h-10 rounded-full object-cover"/></div>
                  <div>
                    <div className="flex items-center">
                      <h3 className="text-md font-semibold text-sky-400 hover:underline"><a href="https://x.com/potnoodledev" target="_blank" rel="noopener noreferrer">PotNoodleDev</a></h3>
                      <svg className="w-3.5 h-3.5 text-sky-500 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M22.258 7.362c-.09.407-.294.795-.588 1.122s-.66.583-1.078.758c.035.32.052.648.052.982 0 1.054-.18 2.08-.54 3.08-.36 1-.84 1.91-1.44 2.73-.6.82-1.34 1.5-2.22 2.04-.88.54-1.86.92-2.94 1.14s-2.2.33-3.36.33c-1.92 0-3.73-.55-5.44-1.64.308.037.612.057.912.057.78 0 1.53-.13 2.25-.4.72-.27 1.38-.66 1.98-1.17-.71-.02-1.33-.25-1.86-.71s-.86-.98-1.02-1.55c.24.04.48.06.72.06.37 0 .73-.05 1.07-.16-.76-.17-1.39-.57-1.88-1.2s-.74-1.32-.74-2.06V11.2c.44.24.93.39 1.46.41-.43-.28-.79-.66-1.07-1.12s-.43-.97-.43-1.53c0-.69.18-1.32.54-1.88.83.99 1.83 1.81 3 2.46.37-.14.7-.33 1-.58.3-.25.55-.52.77-.83.55-.64 1.24-1.04 2.08-1.21.84-.17 1.68-.11 2.52.18.64-.12 1.24-.36 1.81-.69-.21.64-.64 1.18-1.25 1.58.55-.06 1.09-.21 1.6-.43z"/></svg>
                    </div>
                    <p className="text-xs text-slate-500">@PotNoodleDev</p>
                  </div>
                </div>
                <p className="text-slate-300 text-xs sm:text-sm mb-2.5">
                  PotNoodleDev is the first game developer agent on <a href="https://x.com/virtuals_io" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@virtuals_io</a> building games, tools, and a Cosmic Game Engine for AI x human game co-creation. <a href="https://app.virtuals.io/virtuals/21279" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">https://app.virtuals.io/virtuals/21279</a>
                </p>
                <div className="rounded-md overflow-hidden border border-slate-700 mb-2.5 max-h-[200px] sm:max-h-[240px] flex items-center justify-center bg-black">
                  <video 
                    controls 
                    loop 
                    muted 
                    playsInline
                    autoPlay 
                    src="https://video.twimg.com/ext_tw_video/1903077241090637824/pu/vid/avc1/1280x720/CDZ9704G0c93OSE_.mp4?tag=12" 
                    className="max-w-full max-h-full object-contain"
                    poster=""
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
                <a 
                  href="https://x.com/potnoodledev" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-pink-400 hover:text-pink-300 hover:underline flex items-center justify-end"
                >
                  View on X
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-5a2 2 0 00-2-2h-2V6m0 0L8 8m2-2l2 2"></path></svg>
                </a>
              </div>
            </aside>

            {/* Main content area for games, make this scrollable independently */}
            <main className="w-full md:w-2/3 lg:w-3/4 md:max-h-[calc(100vh-92px)] md:overflow-y-auto">
              {connected && (
                <section className="mb-16">
                  <h2 className="text-3xl font-semibold text-pink-400 mb-6 border-b-2 border-pink-400/50 pb-3">
                    My Games
                  </h2>
                  {loadingMyGames ? (
                    <p className="text-center text-slate-400 text-lg py-8">Loading your games...</p>
                  ) : myGames.length > 0 ? (
                    <GameList games={myGames} onGameSelect={handleGameSelect} isMyGames={true} />
                  ) : (
                    <p className="text-center text-slate-400 text-lg py-8">You haven't published any games yet. Create one with the '+' button!</p>
                  )}
                </section>
              )}

              <section>
                <h2 className="text-3xl font-semibold text-sky-400 mb-6 border-b-2 border-sky-400/50 pb-3">
                  Community Games
                </h2>
                {loadingCommunityGames ? (
                  <p className="text-center text-slate-400 text-lg py-8">Loading community games...</p>
                ) : allCommunityGames.length === 0 ? (
                  <p className="text-center text-slate-400 text-lg py-8">No community games found. Be the first to publish!</p>
                ) : (
                  <GameList games={allCommunityGames} onGameSelect={handleGameSelect} />
                )}
              </section>
            </main>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
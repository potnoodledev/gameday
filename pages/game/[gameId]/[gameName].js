import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Layout from '../../../components/Layout'; // Adjust path based on actual location

const GameDisplayPage = () => {
  const router = useRouter();
  const { gameId, gameName } = router.query; // gameName is for display/SEO, gameId for fetch
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (gameId) {
      const fetchGameDetails = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/get-game-details?gameId=${gameId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.game) {
              setGameData(data.game);
            } else {
              setError('Game not found or an error occurred while fetching.');
            }
          } else {
            const errorData = await response.json().catch(() => ({ message: 'Failed to fetch game details' }));
            setError(errorData.message || `Server error: ${response.status}`);
          }
        } catch (err) {
          console.error('Error fetching game details:', err);
          setError(err.message || 'An unexpected error occurred.');
        }
        setLoading(false);
      };
      fetchGameDetails();
    }
  }, [gameId]);

  useEffect(() => {
    // If gameData with html_content is loaded, set it to the iframe
    if (iframeRef.current && gameData && gameData.html_content) {
      iframeRef.current.srcdoc = gameData.html_content;
    }
  }, [gameData]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-[#181a1b] text-white">
          <p className="text-2xl">Loading game...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <Head>
            <title>Error Loading Game | Noods.cc</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#181a1b] text-white p-4">
          <h1 className="text-3xl text-red-500 mb-4">Error</h1>
          <p className="text-xl mb-2">Could not load the game.</p>
          <p className="text-md bg-red-700 bg-opacity-50 p-3 rounded">Details: {error}</p>
        </div>
      </Layout>
    );
  }

  if (!gameData) {
    // This case should ideally be covered by error state if game not found
    return (
        <Layout>
             <Head>
                <title>Game Not Found | Noods.cc</title>
            </Head>
            <div className="min-h-screen flex items-center justify-center bg-[#181a1b] text-white">
                <p className="text-2xl">Game not found.</p>
            </div>
        </Layout>
    );
  }

  const pageTitle = `${gameData.game_name || 'Game'} | Noods.cc`;

  return (
    <Layout 
      currentGameIdFromProp={gameId ? String(gameId) : null} // Pass the actual gameId
      currentGameHtmlForEditor={gameData?.html_content} // Pass HTML content to Layout
      currentSavedGameName={gameData?.game_name} // Pass current game's name
    >
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={`Play ${gameData.game_name} on Noods.cc`} />
        {/* Add other meta tags like Open Graph for sharing if desired */}
      </Head>
      {/* Game Display Area - Full screen iframe */}
      <div className="fixed inset-0 w-full h-full top-[68px] ">
        {/* The 68px top might need adjustment based on your header's actual height */}
        {/* Or make header position relative on this page and iframe takes full screen */}
        <iframe 
          ref={iframeRef} 
          title={gameData.game_name}
          className="w-full h-full border-none bg-gray-800" 
          // srcdoc will be set by useEffect to avoid issues with large HTML strings directly in JSX
          // sandbox="allow-scripts allow-same-origin" // Consider security implications and what the game needs
        ></iframe>
      </div>
    </Layout>
  );
};

export default GameDisplayPage; 
import React from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout'; // Adjust path as necessary

// This page will display the game within the main layout
export default function GamePage() {
  const router = useRouter();
  const { gameId } = router.query; // Get gameId from URL query parameters

  // The Layout component will handle loading the game into the iframe based on this gameId
  // No specific children are needed here for now, unless we want to display game-specific info outside the iframe
  return (
    <Layout currentGameIdFromProp={gameId}>
      {/* Children can be empty or display game title, etc. */}
      {/* For example: <h1 style={{textAlign: 'center', marginTop: '20px'}}>Playing: {gameId}</h1> */}
    </Layout>
  );
} 
import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from '../components/WalletMultiButton';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

// Helper function to create a URL-friendly slug from a game name
const createSlug = (name) => {
  if (!name) return 'game';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

// Utility function to truncate wallet addresses
const truncateWalletAddress = (address) => {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Default template for new games
const DEFAULT_GAME_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Generated Game</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            background-color: #1a202c;
            color: #e2e8f0;
            margin: 0;
            padding: 0;
            min-height: 100vh;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div id="game-container">
        <!-- Game content will be generated here -->
    </div>
</body>
</html>`;

export default function SandboxPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [myGames, setMyGames] = useState([]);
  const [allCommunityGames, setAllCommunityGames] = useState([]);
  const [loadingMyGames, setLoadingMyGames] = useState(false);
  const [loadingCommunityGames, setLoadingCommunityGames] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');
  const [iframeSrcDoc, setIframeSrcDoc] = useState(null);
  const [activeTab, setActiveTab] = useState('CODE');
  const [loadingIframe, setLoadingIframe] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGameCode, setCurrentGameCode] = useState(null);
  const [showLiveGameEditor, setShowLiveGameEditor] = useState(false);
  
  // Add refs for game editor functionality
  const liveGameEditorModalRef = useRef(null);
  const closeLiveGameEditorRef = useRef(null);
  const llmChatHistoryRef = useRef(null);
  const llmChatFormRef = useRef(null);
  const llmChatInputRef = useRef(null);
  const publishLiveGameBtnRef = useRef(null);
  const resetLiveGameBtnRef = useRef(null);
  const viewLiveGameCodeBtnRef = useRef(null);
  const liveGamePreviewRef = useRef(null);
  const deleteLiveGameBtnRef = useRef(null);
  const liveGameEditorTitleRef = useRef(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [editorCode, setEditorCode] = useState('');
  const highlightedCodeRef = useRef(null);
  const codeEditorTextareaRef = useRef(null);
  const highlightedCodeContainerRef = useRef(null);

  // $NOODS price state
  const [noodsPrice, setNoodsPrice] = useState(null);
  const [noodsAmount, setNoodsAmount] = useState(null);
  const agentCostUSD = 0.0646;
  const tokenAddress = '0x43e837F554Bf72177538D1bFB770cDE911d0b9Ee';

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
        const response = await fetch('/api/proxy?endpoint=get-all-games');
        if (response.ok) {
          const data = await response.json();
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
      setMyGames([]);
    }
    fetchAllCommunityGames();
  }, [connected, publicKey]);

  useEffect(() => {
    async function fetchNoodsPrice() {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
        const data = await res.json();
        // Find the first pair with a priceUsd
        const pair = data.pairs && data.pairs.find(p => p.priceUsd);
        if (pair && pair.priceUsd) {
          setNoodsPrice(Number(pair.priceUsd));
          setNoodsAmount(Number(agentCostUSD / Number(pair.priceUsd)));
        }
      } catch (e) {
        setNoodsPrice(null);
        setNoodsAmount(null);
      }
    }
    fetchNoodsPrice();
    const interval = setInterval(fetchNoodsPrice, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleResetGame = () => {
    if (!liveGamePreviewRef.current || !llmChatHistoryRef.current || !llmChatInputRef.current) return;
    if (window.confirm("Are you sure? This will reset the game to the default version")) {
      localStorage.removeItem('liveGameDraftHTML');
      liveGamePreviewRef.current.removeAttribute('srcdoc');
      const originalSrc = '/games/livegame.html';
      liveGamePreviewRef.current.src = `${originalSrc}?t=${new Date().getTime()}`;
      llmChatHistoryRef.current.innerHTML = '';
      llmChatInputRef.current.value = '';
      setCurrentGameCode(null);
    }
  };

  const handlePublishGame = async () => {
    if (!liveGamePreviewRef.current || !publishLiveGameBtnRef.current) return;

    const draftHTML = liveGamePreviewRef.current.srcdoc || localStorage.getItem('liveGameDraftHTML') || '';
    if (!draftHTML || draftHTML.trim() === '' || draftHTML.trim() === '<!-- Start coding here -->') {
      alert('There is no game content to publish. Try editing the game first!');
      return;
    }
    if (!connected || !publicKey) {
      alert('Please connect your wallet to publish a game.');
      return;
    }

    let promptedName = prompt("Enter a name for your game:", `My Custom Game - ${new Date().toLocaleTimeString()}`);
    if (!promptedName) {
      alert('Publishing cancelled. A game name is required.');
      return;
    }
    promptedName = promptedName.trim();
    if (!promptedName) {
      alert('Invalid game name. Publishing cancelled.');
      return;
    }

    const payload = {
      walletAddress: publicKey.toBase58(),
      gameName: promptedName,
      htmlContent: draftHTML,
    };

    const publishButton = publishLiveGameBtnRef.current;
    try {
      publishButton.disabled = true;
      publishButton.textContent = 'Publishing...';
      const response = await fetch('/api/save-user-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to publish game. Server returned an error.' }));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }
      const result = await response.json();
      alert(result.message || 'Game published successfully! It should now appear in your "My Games" list.');
      // Refresh the games lists
      if (connected && publicKey) {
        fetchMyGames();
      }
      fetchAllCommunityGames();
    } catch (error) {
      console.error('Error publishing game:', error);
      alert(`Error publishing game: ${error.message}`);
    } finally {
      publishButton.disabled = false;
      publishButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 2.25A4.5 4.5 0 0118 19.5a4.5 4.5 0 01-3.75-3.75H9.75A4.5 4.5 0 016.75 19.5z" /></svg>`;
    }
  };

  const handleLlmFormSubmit = async (e) => {
    e.preventDefault();
    if (!llmChatFormRef.current || !llmChatHistoryRef.current || !llmChatInputRef.current || !liveGamePreviewRef.current) return;

    const llmChatInput = llmChatInputRef.current;
    const llmChatHistory = llmChatHistoryRef.current;
    const liveGamePreview = liveGamePreviewRef.current;
    const userMessage = llmChatInput.value.trim();
    if (!userMessage) return;

    const userMsgDiv = document.createElement('div');
    userMsgDiv.className = 'mb-2 p-2 rounded-lg self-end text-right text-xs text-white';
    userMsgDiv.textContent = `You: ${userMessage}`;
    llmChatHistory.appendChild(userMsgDiv);
    llmChatInput.value = '';

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'mb-2 p-2 rounded-lg self-start relative group text-xs text-sans text-white';
    const aiPre = document.createElement('pre');
    aiPre.className = 'whitespace-pre-wrap break-words';
    aiPre.textContent = 'PotNoodleDev: Now cooking up a game...';
    aiMsgDiv.appendChild(aiPre);
    llmChatHistory.appendChild(aiMsgDiv);
    llmChatHistory.scrollTop = llmChatHistory.scrollHeight;

    let accumulatedCode = "";
    try {
      const currentCodeBase = liveGamePreview.srcdoc || localStorage.getItem('liveGameDraftHTML') || '';
      const systemPrompt = `The user wants to make a new game. Create a new game based on this request: ${userMessage}`;
      
      const response = await fetch('/api/generate-game-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          currentCode: currentCodeBase || '<!-- Start coding here -->'
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      aiPre.textContent = "PotNoodleDev: ";
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkText = decoder.decode(value);
        aiPre.textContent += chunkText;
        accumulatedCode += chunkText;
        llmChatHistory.scrollTop = llmChatHistory.scrollHeight;
      }

      let cleanedCode = accumulatedCode.replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
      if (cleanedCode && liveGamePreview) {
        liveGamePreview.srcdoc = cleanedCode;
        setCurrentGameCode(cleanedCode);
        localStorage.setItem('liveGameDraftHTML', cleanedCode);
      }
    } catch (error) {
      console.error('Error calling LLM API:', error);
      if (aiPre) {
        aiPre.textContent = `Error: ${error.message}`;
        aiPre.style.color = 'red';
      }
    }
    llmChatHistory.scrollTop = llmChatHistory.scrollHeight;
  };

  // Handler for output click
  const handleOutputClick = async (gameId) => {
    setLoadingIframe(true);
    setLoadingCode(true);
    setActiveTab('GAME');
    try {
      const response = await fetch(`/api/proxy?endpoint=get-game-details&gameId=${gameId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.game && data.game.html_content) {
          // Store the HTML content for both code view and game preview
          setIframeSrcDoc(data.game.html_content);
          setCurrentGameCode(data.game.html_content);
        } else {
          setIframeSrcDoc('<div class="text-red-500 p-8">No HTML content found for this game.</div>');
          setCurrentGameCode('// No HTML content available for this game');
        }
      } else {
        setIframeSrcDoc('<div class="text-red-500 p-8">Failed to load game details.</div>');
        setCurrentGameCode('// Failed to load game details');
      }
    } catch (err) {
      setIframeSrcDoc('<div class="text-red-500 p-8">Error loading game.</div>');
      setCurrentGameCode('// Error loading game');
    }
    setLoadingIframe(false);
    setLoadingCode(false);
  };

  const handleRunAgent = async () => {
    if (!inputText.trim()) {
      alert('Please enter a game idea first!');
      return;
    }

    setIsGenerating(true);
    setLoadingCode(true);
    setLoadingIframe(true);

    try {
      // Create the system prompt
      const systemPrompt = `The user wants to make a new game. Create a new game based on this request: ${inputText}`;
      
      // Call the generate-game-update API endpoint
      const response = await fetch('/api/generate-game-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          currentCode: currentGameCode || DEFAULT_GAME_TEMPLATE
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Since the API streams the response, we need to read it as text
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let generatedHTML = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode and append the chunk
        const chunk = decoder.decode(value);
        generatedHTML += chunk;

        // Update the preview as we receive chunks
        setCurrentGameCode(generatedHTML);
        setIframeSrcDoc(generatedHTML);

        // Force iframe refresh by adding timestamp
        const timestamp = Date.now();
        setIframeSrcDoc(prev => prev ? `${prev}<!-- ${timestamp} -->` : prev);
      }

      // Final update with complete code
      setCurrentGameCode(generatedHTML);
      setIframeSrcDoc(generatedHTML);

      // Store in localStorage for persistence
      localStorage.setItem('liveGameDraftHTML', generatedHTML);

      // Switch to GAME tab to show the result
      setActiveTab('GAME');

    } catch (error) {
      console.error('Error generating game:', error);
      setCurrentGameCode('// Error generating game: ' + error.message);
      setIframeSrcDoc(`<div class="text-red-500 p-8">Error generating game: ${error.message}</div>`);
    } finally {
      setIsGenerating(false);
      setLoadingCode(false);
      setLoadingIframe(false);
    }
  };

  return (
    <div className="min-h-screen text-white font-sans relative" style={{ background: 'linear-gradient(135deg, #1E1D47 0%, #2E2C79 100%)' }}>
      {/* Grid background overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.18) 1px, transparent 1px),\n' +
            'linear-gradient(to bottom, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.18,
        }}
      />
      <Head>
        <title>ALPHA SANDBOX</title>
        <meta name="description" content="AI Game Sandbox" />
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet" />
        <script src="https://cdn.tailwindcss.com" async></script>
      </Head>
      
      {/* Top bar */}
      <div className="flex justify-between items-center border border-[#4B4A6C] px-5 py-2">
        <div>
          <span className="font-bold tracking-widest text-xs">ALPHA</span>
          <span className="ml-2 text-xs text-white/70">SANDBOX</span>
        </div>
        <div className="text-xs text-white/70">IS IN ALPHA MODE. EXPECT IT TO BREAK AND LEARN.</div>
        <WalletMultiButton />
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 px-4 md:px-8 py-8 max-w-[1800px] mx-auto">
        {/* Left Sidebar */}
        <div className="flex z-10 flex-col gap-1 w-full lg:w-[280px] xl:w-[280px]">
          {/* 1. LIVE SANDBOX */}
          <div className="border bg-[#1E1D47] border-[#4B4A6C] rounded-md p-2 flex items-center justify-between">
            <span className="font-bold tracking-wider text-xs">POTNOODLEDEV.SANDBOX</span>
            <span className="flex items-center ml-2">
              <span className="relative flex h-4 w-4 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
              </span>
              <span className="text-xs font-bold text-green-400 ml-1">LIVE</span>
            </span>
          </div>

          {/* 2. SANDBOX DETAILS */}
          <div className="border border-[#4B4A6C] rounded-lg p-4 bg-[#1E1D47]/80">
            <div className="font-bold text-xs mb-4">TOOLS</div>
            <div className="relative flex flex-col items-center gap-2">
              {/* Tool 1 */}
              <div className="w-full bg-[#2E2C79]/30 border border-[#4B4A6C] rounded-2xl p-2 flex items-center justify-between">
                <span className="text-xs text-white/90">Prompt Analysis</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-500">LIVE</span>
                  </div>
                </div>
              </div>
              {/* Dotted line 1 */}
              <div className="h-2 border-l border-dotted border-[#4B4A6C]"></div>
              {/* Tool 2 */}
              <div className="w-full bg-[#2E2C79]/30 border border-[#4B4A6C] rounded-2xl p-2 flex items-center justify-between">
                <span className="text-xs text-white/90">Game Concept Creator</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-500">LIVE</span>
                  </div>
                </div>
              </div>
              {/* Dotted line 2 */}
              <div className="h-2 border-l border-dotted border-[#4B4A6C]"></div>
              {/* Tool 3 */}
              <div className="w-full bg-[#2E2C79]/30 border border-[#4B4A6C] rounded-2xl p-2 flex items-center justify-between">
                <span className="text-xs text-white/90">Game Code Creator</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-500">LIVE</span>
                  </div>
                </div>
              </div>
                {/* Dotted line 2 */}
                <div className="h-2 border-l border-dotted border-[#4B4A6C]"></div>
              {/* TOOL ITEM*/}
              <div className="w-full bg-[#2E2C79]/30 border border-[#4B4A6C] rounded-2xl p-2 flex items-center justify-between">
                <span className="text-xs text-white/90">Add Tool </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-white/50">Coming Soon</span>
                  </div>
                </div>
              </div>
              <div className="w-full text-center">
                <span className="text-white/50 text-xs">Tool Marketplace Coming Soon</span>
              </div>
            </div>
          </div>

          {/* 3. INPUT */}
          <div className="border border-[#4B4A6C] rounded-lg p-4 bg-[#1E1D47]/80">
            <div className="font-bold text-xs mb-2">TRIGGER</div>
            <button 
              className="w-full rounded-full py-1 px-1 text-white text-md shadow-lg border border-white/30 transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-[#7F4BFF] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7F4BFF] focus:outline-none focus:ring-2 focus:ring-purple-400/60"
              onClick={() => setShowLiveGameEditor(true)}
            >
              Run Agent
            </button>
          </div>

          {/* Live Game Editor Modal */}
          <div 
            id="liveGameEditorModal" 
            ref={liveGameEditorModalRef} 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" 
            style={{display:'none'}}
          >
            <div className="bg-gray-800 text-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-pink-400">Live Game Editor</h2>
                <button 
                  id="closeLiveGameEditor" 
                  ref={closeLiveGameEditorRef} 
                  className="text-gray-400 hover:text-white transition"
                  onClick={() => {
                    if (liveGameEditorModalRef.current) {
                      liveGameEditorModalRef.current.style.display = 'none';
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body - Two Columns */}
              <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* Left Column: Chat and Controls */}
                <div className="w-full md:w-1/3 flex flex-col p-4 space-y-4 border-r border-gray-700 overflow-y-auto">
                  <div 
                    id="liveGameEditorTitle"
                    ref={liveGameEditorTitleRef}
                    className="text-lg font-semibold text-pink-300"
                  >
                    Ask PotNoodleDev to make a game
                  </div>
                  <div 
                    id="llmChatHistory" 
                    ref={llmChatHistoryRef} 
                    className="flex-grow min-h-[200px] bg-gray-900 rounded p-3 text-sm font-mono overflow-y-auto border border-gray-700 shadow-inner"
                  >
                    {/* Chat messages will appear here */}
                  </div>
                  <form id="llmChatForm" ref={llmChatFormRef} className="space-y-3" onSubmit={handleLlmFormSubmit}>
                    <textarea 
                      id="llmChatInput" 
                      ref={llmChatInputRef} 
                      className="w-full p-3 rounded bg-[#1E1D47] border border-gray-600 text-white text-xs placeholder-white focus:ring-white focus:border-white resize-none" 
                      placeholder="Describe the game or change you want..." 
                      rows="3"
                    ></textarea>
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        type="button" 
                        title="Reset Game"
                        id="resetLiveGameBtn" 
                        ref={resetLiveGameBtnRef} 
                        className="p-2.5 bg-[#1E1D47] text-white rounded-md shadow hover:bg-red-700 transition flex items-center justify-center"
                        onClick={handleResetGame}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        title="View Local Code"
                        id="viewLiveGameCodeBtn"
                        ref={viewLiveGameCodeBtnRef}
                        className="p-2.5 bg-sky-600 text-white rounded-md shadow hover:bg-sky-700 transition flex items-center justify-center"
                        onClick={() => setShowCodeEditor(true)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5-10.5L1.5 12l5.25 5.25" />
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        title="Publish Game"
                        id="publishLiveGameBtn" 
                        ref={publishLiveGameBtnRef} 
                        className="p-2.5 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition flex items-center justify-center"
                        onClick={handlePublishGame}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 2.25A4.5 4.5 0 0118 19.5a4.5 4.5 0 01-3.75-3.75H9.75A4.5 4.5 0 016.75 19.5z" />
                        </svg>
                      </button>
                      <button 
                        type="submit" 
                        title="Send Message"
                        className="p-2.5 bg-pink-600 text-white rounded-md shadow hover:bg-pink-700 transition flex items-center justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Right Column: Live Preview */}
                <div className="w-full md:w-2/3 flex flex-col">
                  <iframe 
                    id="liveGamePreview" 
                    ref={liveGamePreviewRef} 
                    className="w-full flex-grow" 
                    src="/games/livegame.html"
                  ></iframe>
                </div>
              </div>
            </div>
          </div>

          {/* 4. COST */}
          <div className="border border-[#4B4A6C] rounded-lg p-4 bg-[#1E1D47]/80">
            <div className="font-bold text-xs mb-2">AGENT COSTS</div>
            <div className="flex flex-col items-start gap-1 text-xs text-white/70">
              <div className="flex flex-col items-start gap-1">
                <span>~ ${agentCostUSD.toFixed(4)}</span>
                {noodsPrice ? (
                  <>
                    <span>~ {noodsAmount ? `${noodsAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} $NOODS` : '...'}</span>
                    <span className="text-[10px] text-white/40">1 $NOODS = ${noodsPrice.toFixed(6)} USD</span>
                  </>
                ) : (
                  <span>Loading $NOODS price...</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Center Sandbox */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 z-10">
          <div className="border border-[#4B4A6C] rounded-lg bg-[#1E1D47]/80 flex flex-col h-[600px] min-h-[400px]">
            {showLiveGameEditor ? (
              <div className="w-full h-full flex flex-col md:flex-row overflow-hidden">
                <div className="w-full md:w-1/3 flex flex-col p-4 space-y-4 border-r border-gray-700 overflow-y-auto">
                  <div className="flex justify-between items-center mb-2">
                    <button onClick={() => setShowLiveGameEditor(false)} className="text-gray-400 hover:text-white transition ml-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div id="liveGameEditorTitle" ref={liveGameEditorTitleRef} className="text-pink-300 mb-2" />
                  <div id="llmChatHistory" ref={llmChatHistoryRef} className="flex-grow min-h-[200px] bg-gray-900 rounded p-3 text-sm font-mono overflow-y-auto border border-gray-700 shadow-inner" />
                  <form id="llmChatForm" ref={llmChatFormRef} className="space-y-3" onSubmit={handleLlmFormSubmit}>
                    <textarea id="llmChatInput" ref={llmChatInputRef} className="w-full p-3 rounded bg-[#1E1D47] border border-gray-600 text-xs text-white placeholder-gray-400 focus:ring-pink-500 focus:border-pink-500 resize-none" placeholder="Describe the game or change you want..." rows="3" />
                    <div className="flex items-center justify-end space-x-2">
                      <button type="button" title="Reset Game" id="resetLiveGameBtn" ref={resetLiveGameBtnRef} className="p-2.5 border border-white text-white rounded-md shadow hover:bg-red-700 transition flex items-center justify-center" onClick={handleResetGame}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>
                      <button type="button" title="View Local Code" id="viewLiveGameCodeBtn" ref={viewLiveGameCodeBtnRef} className="p-2.5 border border-white text-white rounded-md shadow hover:bg-sky-700 transition flex items-center justify-center" onClick={() => setShowCodeEditor(true)}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5-10.5L1.5 12l5.25 5.25" />
                        </svg>
                      </button>
                      <button type="button" title="Publish Game" id="publishLiveGameBtn" ref={publishLiveGameBtnRef} className="p-2.5 border border-whit text-white rounded-md shadow hover:bg-green-700 transition flex items-center justify-center" onClick={handlePublishGame}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 2.25A4.5 4.5 0 0118 19.5a4.5 4.5 0 01-3.75-3.75H9.75A4.5 4.5 0 016.75 19.5z" />
                        </svg>
                      </button>
                      <button type="submit" title="Send Message" className="p-2.5 border border-white text-white rounded-md shadow hover:bg-pink-700 transition flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </div>
                <div className="w-full md:w-2/3 flex flex-col">
                  <iframe id="liveGamePreview" ref={liveGamePreviewRef} className="w-full flex-grow" src="/games/livegame.html"></iframe>
                </div>
              </div>
            ) : (
              <>
                {/* Sandbox Title Bar */}
                <div className="flex bg-[#1E1D47]/100 items-center justify-between border-b border-[#4B4A6C] px-4 py-2">
                  <span className="text-xs font-sans tracking-widest text-white/70">IFRAME.POTNOODLE.LIVECODEPREVIEW.GAME</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('CODE')} 
                      className={`px-4 py-1 rounded border text-xs font-bold ${activeTab==='CODE' ? 'bg-white/10 border-[#4B4A6C] text-white' : 'border-[#4B4A6C] text-white/70text-xs hover:bg-white/10'}`}
                    >
                      CODE
                    </button>
                    <button 
                      onClick={() => setActiveTab('GAME')} 
                      className={`px-4 py-1 rounded border text-xs font-bold ${activeTab==='GAME' ? 'bg-white/10 border-[#4B4A6C] text-white' : 'border-[#4B4A6C] text-white/70 hover:bg-white/10'}`}
                    >
                      GAME
                    </button>
                  </div>
                </div>
                {/* Main Sandbox Area */}
                <div className="flex-1 flex flex-col bg-[#1E1D47] h-[600px] min-h-[400px]">
                  {activeTab === 'GAME' ? (
                    loadingIframe || isGenerating ? (
                      <div className="text-white/70 text-lg flex items-center justify-center flex-1">
                        <div className="flex flex-col items-center gap-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          <div>{isGenerating ? 'Generating your game...' : 'Loading game...'}</div>
                        </div>
                      </div>
                    ) : iframeSrcDoc ? (
                      <iframe
                        title="Game Preview"
                        srcDoc={iframeSrcDoc}
                        className="w-full flex-1 rounded-b-lg border border-[#4B4A6C] bg-[#1E1D47]"
                        allowFullScreen
                      />
                    ) : (
                      <div className="text-white/70 text-lg flex items-center justify-center h-full">
                        Enter your game idea and click RUN AGENT to begin
                      </div>
                    )
                  ) : (
                    <div className="flex-1 overflow-hidden bg-[#1E1D47] font-sans text-sm">
                      {loadingCode || isGenerating ? (
                        <div className="text-white/70 text-lg flex items-center justify-center h-full">
                          <div className="flex flex-col items-center gap-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            <div>{isGenerating ? 'Generating code...' : 'Loading code...'}</div>
                          </div>
                        </div>
                      ) : currentGameCode ? (
                        <div className="h-full overflow-auto p-6">
                          <pre className="text-white/90 text-xs text-wrap whitespace-pre bg-[#2E2C79]/30 rounded-lg border border-[#4B4A6C] p-4">
                            <code className="language-html">
                              {currentGameCode}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <div className="text-white/70 text-lg flex items-center justify-center h-full">
                          Enter your game idea and click RUN AGENT to begin
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Outputs */}
        <div className="flex flex-col gap-2 w-full lg:w-[280px] xl:w-[280px] max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="font-bold text-xs text-white mb-2">OUTPUTS</div>
          {loadingCommunityGames ? (
            <div className="text-white/70 text-center py-8">Loading community games...</div>
          ) : allCommunityGames.length === 0 ? (
            <div className="text-white/70 text-center py-8">No community games found. Be the first to publish!</div>
          ) : (
            <>
              {allCommunityGames.map((game) => (
                <div
                  key={game.gameId}
                  className="relative bg-[#1E1D47]/80 border border-[#4B4A6C] rounded-2xl p-4 mb-1 cursor-pointer hover:bg-[#2E2C79]/50 transition-all duration-300 group"
                  onClick={() => handleOutputClick(game.gameId)}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#2E2C79] flex items-center justify-center text-xs font-bold border-2 border-[#4B4A6C]">
                      0
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-white mb-1 truncate">
                        {game.gameName || 'Untitled Game'}
                      </h3>
                      <div className="text-xs text-white/70 mb-1">
                        By {(game.userName || 'Anonymous').length > 13 ? (game.userName || 'Anonymous').slice(0, 13) + '…' : (game.userName || 'Anonymous')}
                      </div>
                      <div className="text-xs text-white/50">
                        Updated: {new Date(game.lastUpdated).toLocaleDateString()}
                      </div>
                      <button 
                    className="relative text-xs px-2 my-2 w-full py-1 bg-[#2E2C79]/50 hover:bg-[#2E2C79] text-white rounded-full border border-[#4B4A6C] transition-all duration-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOutputClick(game.gameId);
                    }}
                  >
                    View
                  </button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 


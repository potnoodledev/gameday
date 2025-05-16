import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from './WalletMultiButton'; // Assuming WalletMultiButton is in the same components folder

// Define UserProfile structure (as a comment for JS file)
// interface UserProfile {
//   wallet_address: string;
//   email?: string | null;
//   image_url?: string | null;
//   profilePictureBase64?: string | null;
//   created_at?: string;
//   updated_at?: string;
// }

export const games = [
  // { name: 'Bee Colony Simulator', path: 'bee-colony-simulator/index.html', id: 'bee-colony-simulator' },
  { name: 'Dice Race', path: 'dice-race/index.html', id: 'dice-race' },
  { name: 'Cell Tag', path: 'cell-tag/index.html', id: 'cell-tag' },
  { name: 'Live Game', path: 'livegame.html', id: 'livegame' }
];

export default function Layout({ children, currentGameIdFromProp }) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [userProfile, setUserProfile] = useState(null); // Added for profile image

  // const leaderboardListRef = useRef(null); // Removed leaderboard
  // const leaderboardListMobileRef = useRef(null); // Removed leaderboard
  // const leaderboardMobileBtnRef = useRef(null); // Removed leaderboard
  // const leaderboardMobileSheetRef = useRef(null); // Removed leaderboard
  // const closeLeaderboardMobileRef = useRef(null); // Removed leaderboard
  // gameMenuRef and gameMenuListRef will likely stay on index.js or be passed as children if needed
  const gameFrameRef = useRef(null);
  const editLiveGameBtnRef = useRef(null);
  const liveGameEditorModalRef = useRef(null);
  const closeLiveGameEditorRef = useRef(null);
  const llmChatHistoryRef = useRef(null);
  const llmChatFormRef = useRef(null);
  const llmChatInputRef = useRef(null);
  const publishLiveGameBtnRef = useRef(null);
  const resetLiveGameBtnRef = useRef(null);
  const liveGamePreviewRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const closeSettingsMenuRef = useRef(null);
  const gameSelectRef = useRef(null);
  const nameInputRef = useRef(null);
  const saveSettingsRef = useRef(null);

  // Store current game in state, to be derived from prop or router query
  const [currentGame, setCurrentGame] = useState(null);
  const [playerName, setPlayerName] = useState('');

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    if (!publicKey) {
      setUserProfile(null); // Clear profile if no public key
      return;
    }
    try {
      const response = await fetch(`/api/profile?walletAddress=${publicKey.toBase58()}`);
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      } else {
        setUserProfile(null); // Profile not found or error
        console.error('Failed to fetch user profile in Layout:', response.status);
      }
    } catch (err) {
      setUserProfile(null);
      console.error('Error fetching user profile in Layout:', err);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchUserProfile();
  }, [fetchUserProfile]);

  // Effect for initializing player name
  useEffect(() => {
    let storedPlayerName = localStorage.getItem('playerName') || '';
    if (!storedPlayerName) {
      const randomName = 'Player' + Math.floor(Math.random() * 1000);
      // Avoid prompt in useEffect if possible, or ensure it only runs client-side after hydration
      // For now, deferring direct prompt, consider a modal or input in settings
      storedPlayerName = randomName; 
      localStorage.setItem('playerName', storedPlayerName);
    }
    setPlayerName(storedPlayerName);
    if (nameInputRef.current) {
      nameInputRef.current.value = storedPlayerName;
    }
  }, []);

  // Update currentGame based on currentGameIdFromProp
  useEffect(() => {
    if (currentGameIdFromProp) {
      const game = games.find(g => g.id === currentGameIdFromProp);
      setCurrentGame(game);
    } else {
      setCurrentGame(null);
    }
  }, [currentGameIdFromProp]);


  const loadGameIntoIframe = useCallback(() => {
    const gameFrame = gameFrameRef.current;
    if (!gameFrame) return;

    if (currentGame) {
      const gamePath = `/games/${currentGame.path}`;
      gameFrame.src = gamePath;
      gameFrame.style.display = '';
      // Logic for sending player name is handled by gameFrame.onload in the main useEffect
      // Logic for showing edit button is handled by the main useEffect reacting to currentGame
    } else {
      gameFrame.style.display = 'none';
      gameFrame.src = 'about:blank';
    }
  }, [currentGame]);

  useEffect(() => {
    loadGameIntoIframe();
  }, [loadGameIntoIframe]);
  
  useEffect(() => {
    const LIVE_GAME_DRAFT_KEY = 'liveGameDraftHTML';
    
    const gameFrame = gameFrameRef.current;
    // const leaderboardList = leaderboardListRef.current; // Removed leaderboard
    // const leaderboardListMobile = leaderboardListMobileRef.current; // Removed leaderboard
    // const leaderboardMobileBtn = leaderboardMobileBtnRef.current; // Removed leaderboard
    // const leaderboardMobileSheet = leaderboardMobileSheetRef.current; // Removed leaderboard
    // const closeLeaderboardMobile = closeLeaderboardMobileRef.current; // Removed leaderboard
    const editLiveGameBtn = editLiveGameBtnRef.current;
    const liveGameEditorModal = liveGameEditorModalRef.current;
    const closeLiveGameEditor = closeLiveGameEditorRef.current;
    const llmChatHistory = llmChatHistoryRef.current;
    const llmChatForm = llmChatFormRef.current;
    const llmChatInput = llmChatInputRef.current;
    const publishLiveGameBtn = publishLiveGameBtnRef.current;
    const resetLiveGameBtn = resetLiveGameBtnRef.current;
    const liveGamePreview = liveGamePreviewRef.current;
    const settingsBtn = settingsBtnRef.current;
    const settingsMenu = settingsMenuRef.current;
    const closeSettingsMenu = closeSettingsMenuRef.current;
    const gameSelect = gameSelectRef.current;
    const nameInput = nameInputRef.current; // Ref already declared
    const saveSettings = saveSettingsRef.current;

    // Simplified check, assumes refs are available when this effect runs.
    // Consider more robust checks if issues arise.

    let socket;
    try {
        socket = io();
    } catch (e) {
        console.error("Failed to initialize socket.io:", e);
    }

    if (socket && currentGame && playerName) {
        socket.emit('playerJoined', { name: playerName, game: currentGame.name });
    }

    let onlineUsers = {};
    let playerEmojis = {};
    let playerPositions = {};
    // let lastLeaderboardData = []; // Removed leaderboard

    // const updateLeaderboard = (data) => { // Removed leaderboard
    //   lastLeaderboardData = data;
    //   if (!leaderboardList || !leaderboardListMobile) return;
    //   leaderboardList.innerHTML = '';
    //   leaderboardListMobile.innerHTML = '';
    //   data.forEach((entry, i) => {
    //     const li = document.createElement('li');
    //     li.className = 'flex justify-between items-center px-2 py-1 rounded gap-2';
    //     const statusDotSpan = document.createElement('span');
    //     statusDotSpan.className = 'inline-block w-3 h-3 rounded-full mr-2';
    //     statusDotSpan.style.background = onlineUsers[entry.name] ? '#22c55e' : '#888';
    //     const statusDot = statusDotSpan.outerHTML;
    //     let emoji = playerEmojis[entry.name] || '';
    //     let emojiSpan = emoji ? `<span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,EmojiOne,sans-serif;font-size:1.8em;line-height:1;">${emoji}</span>` : '';
    //     let pos = (typeof playerPositions[entry.name] === 'number' && !isNaN(playerPositions[entry.name])) ? playerPositions[entry.name] : ((typeof entry.pos === 'number' && !isNaN(entry.pos)) ? entry.pos : 0);
    //     let posText = `<span class='ml-1 text-xs text-gray-400'>(pos: ${pos})</span>`;
    //     let nameSpan = `<span class='flex items-center gap-1'>${statusDot}${emojiSpan}${entry.name}${posText}</span>`;
    //     if (entry.name === playerName) {
    //       li.className += ' bg-[#b5e3ff] text-[#181a1b] font-bold';
    //     } else {
    //       li.className += ' text-white';
    //     }
    //     li.innerHTML = `<span>${i + 1}. ${nameSpan}</span> <span>${entry.score ?? 0}</span>`;
    //     leaderboardList.appendChild(li);
    //     const liMobile = li.cloneNode(true);
    //     leaderboardListMobile.appendChild(liMobile);
    //   });
    // };

    if (socket) {
        // socket.on('leaderboard', (data) => { // Removed leaderboard
        //   onlineUsers = {};
        //   data.forEach(entry => { onlineUsers[entry.name] = true; });
        //   updateLeaderboard(data);
        // });
        // socket.on('onlineStatus', (status) => { // Removed leaderboard
        //   onlineUsers = status;
        //   updateLeaderboard(lastLeaderboardData);
        // });
    }

    const handleWindowMessage = (event) => {
      if (typeof event.data === 'object' && event.data.type === 'scoreUpdate') {
        if (event.data.name && event.data.emoji) {
          playerEmojis[event.data.name] = event.data.emoji;
          if (typeof event.data.pos === 'number') playerPositions[event.data.name] = event.data.pos;
        } else if (event.data.emoji) {
          playerEmojis[playerName] = event.data.emoji;
          if (typeof event.data.pos === 'number') playerPositions[playerName] = event.data.pos;
        }
        if (currentGame && socket) {
          socket.emit('scoreUpdate', { name: playerName, score: event.data.score, game: currentGame.name });
        }
      }
      if (typeof event.data === 'object' && event.data.type === 'liveGameCodeUpdate') {
        if (liveGamePreview && liveGamePreview.contentWindow) {
            liveGamePreview.contentWindow.postMessage({ type: 'loadHTML', html: event.data.htmlContent }, '*');
        }
        localStorage.setItem(LIVE_GAME_DRAFT_KEY, event.data.htmlContent);
      }
    };
    window.addEventListener('message', handleWindowMessage);

    const populateGameSelect = () => {
        if (!gameSelect) return;
        gameSelect.innerHTML = '';
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            if (currentGame && game.id === currentGame.id) {
                option.selected = true;
            }
            gameSelect.appendChild(option);
        });
    };

    // Action to open the Live Game Editor (used by new + button and old pencil button)
    const openLiveGameEditor = () => {
      if (liveGameEditorModalRef.current) liveGameEditorModalRef.current.style.display = 'flex';
      const draftHTML = localStorage.getItem(LIVE_GAME_DRAFT_KEY);
      if (draftHTML && liveGamePreviewRef.current) {
          liveGamePreviewRef.current.srcdoc = draftHTML;
      } else if (liveGamePreviewRef.current) {
          liveGamePreviewRef.current.removeAttribute('srcdoc');
          const currentSrc = liveGamePreviewRef.current.src.split('?')[0];
          liveGamePreviewRef.current.src = `${currentSrc}?t=${new Date().getTime()}`;
      }
    };

    // NEW: settingsBtn (now the + button) opens the live game editor
    if (settingsBtn) settingsBtn.onclick = openLiveGameEditor;

    if (closeSettingsMenu) closeSettingsMenu.onclick = () => {
        if(settingsMenu) settingsMenu.style.display = 'none';
    };
    if (saveSettings) saveSettings.onclick = () => {
        const newName = nameInput.value;
        if (newName) {
            setPlayerName(newName); // Update React state
            localStorage.setItem('playerName', newName);
        }
        const selectedGameIdInSettings = gameSelect.value;
        if (selectedGameIdInSettings && (!currentGame || selectedGameIdInSettings !== currentGame.id)) {
            router.push(`/game/${selectedGameIdInSettings}`);
        }
        if(settingsMenu) settingsMenu.style.display = 'none';
        if (socket && currentGame && newName) socket.emit('playerJoined', { name: newName, game: currentGame.name }); 
    };

    if (editLiveGameBtn) editLiveGameBtn.onclick = openLiveGameEditor; // Old pencil button also uses the same action

    if (closeLiveGameEditor) closeLiveGameEditor.onclick = () => {
      if (liveGameEditorModalRef.current) liveGameEditorModalRef.current.style.display = 'none';
    };

    if (liveGameEditorModal) {
      // Remove the radio button group for model selection
      const modelSelectionRadios = liveGameEditorModal.querySelectorAll('.model-selection-radios');
      modelSelectionRadios.forEach(radioGroup => radioGroup.remove());
    }

    // Ensure the llmChatForm onsubmit is correctly defined and prevents default page refresh
    if (llmChatFormRef.current && llmChatHistoryRef.current && llmChatInputRef.current && liveGamePreviewRef.current) {
      llmChatFormRef.current.onsubmit = async (e) => {
        e.preventDefault(); // Crucial: Prevents page refresh on form submission
        
        const llmChatInput = llmChatInputRef.current;
        const llmChatHistory = llmChatHistoryRef.current;
        const liveGamePreview = liveGamePreviewRef.current; // Corrected from liveGamePreviewRef.current.current

        const userMessage = llmChatInput.value.trim();
        if (!userMessage) return;

        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'mb-2 p-2 bg-blue-600 rounded-lg self-end text-right text-white'; // Added text-white for better contrast
        userMsgDiv.textContent = `You: ${userMessage}`;
        llmChatHistory.appendChild(userMsgDiv);
        llmChatInput.value = '';

        const aiMsgDiv = document.createElement('div');
        aiMsgDiv.className = 'mb-2 p-2 bg-gray-700 rounded-lg self-start relative group text-white'; // Added text-white
        const aiPre = document.createElement('pre');
        aiPre.className = 'whitespace-pre-wrap break-words';
        aiPre.textContent = 'AI: generating code...';
        aiMsgDiv.appendChild(aiPre);
        llmChatHistory.appendChild(aiMsgDiv);
        llmChatHistory.scrollTop = llmChatHistory.scrollHeight;

        let accumulatedCode = "";

        try {
          const response = await fetch('/api/generate-game-update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt: userMessage,
              currentCode: liveGamePreview.srcdoc || localStorage.getItem(LIVE_GAME_DRAFT_KEY) || '<!-- Start coding here -->',
            }),
          });

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/plain')) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            aiPre.textContent = "AI: "; // Clear placeholder, add prefix
            let firstChunk = true;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunkText = decoder.decode(value);
              if (firstChunk) {
                firstChunk = false;
              }
              aiPre.textContent += chunkText;
              accumulatedCode += chunkText;
              llmChatHistory.scrollTop = llmChatHistory.scrollHeight;
            }
          } else if (contentType && contentType.includes('application/json')) {
            const responseText = await response.text();
            if (!responseText) {
                throw new Error('AI returned an empty JSON response.');
            }
            try {
                const data = JSON.parse(responseText);
                if (response.ok) {
                    if (data.newCode) {
                        aiPre.textContent = "AI: " + data.newCode;
                        accumulatedCode = data.newCode;
                    } else {
                        throw new Error('AI response did not contain newCode.');
                    }
                } else {
                    throw new Error(data.error || 'Unknown error from AI (JSON)');
                }
            } catch (parseError) {
                throw new Error(`Failed to parse AI JSON response: ${parseError.message}. Response was: ${responseText}`);
            }
          } else {
            const textResponse = await response.text();
            aiPre.textContent = `Unexpected response type: ${contentType}\n${textResponse}`;
            throw new Error(`Unexpected response type: ${contentType}`);
          }

          if (accumulatedCode && liveGamePreview) {
            liveGamePreview.srcdoc = accumulatedCode;
            localStorage.setItem(LIVE_GAME_DRAFT_KEY, accumulatedCode);
          } else if (!aiPre.textContent.toLowerCase().includes('error') && !accumulatedCode) {
            aiPre.textContent += (aiPre.textContent.endsWith("AI: ") ? '' : '\n') + "(AI generated empty content)";
          }

        } catch (error) {
          console.error('Error calling LLM API:', error);
          if (aiPre) {
            aiPre.textContent = `Error: ${error.message}`;
            aiPre.style.color = 'red';
          } else {
            const errorMsgDiv = document.createElement('div');
            errorMsgDiv.textContent = `Error: ${error.message}`;
            errorMsgDiv.style.color = 'red';
            llmChatHistory.appendChild(errorMsgDiv);
          }
          llmChatHistory.scrollTop = llmChatHistory.scrollHeight;
        }
      };
    }

    if (resetLiveGameBtn && liveGamePreview && llmChatHistory) {
      resetLiveGameBtn.onclick = () => {
        // Add confirmation dialog
        if (window.confirm("Are you sure? This will reset the game to the default version")) {
          localStorage.removeItem(LIVE_GAME_DRAFT_KEY);
          if (liveGamePreview) {
            liveGamePreview.removeAttribute('srcdoc'); // Clear current srcdoc to ensure src reloads
            const originalSrc = '/games/livegame.html'; 
            liveGamePreview.src = `${originalSrc}?t=${new Date().getTime()}`;
          }
          if (llmChatHistory) {
            llmChatHistory.innerHTML = ''; // Clear chat history
          }
          if (llmChatInput) {
            llmChatInput.value = ''; // Clear the input field as well
          }
        }
      };
    }

    // Updated Publish button logic to save to DB
    if (publishLiveGameBtnRef.current && liveGamePreviewRef.current && llmChatInputRef.current) {
      publishLiveGameBtnRef.current.onclick = async () => {
        const liveGamePreview = liveGamePreviewRef.current;
        const draftHTML = liveGamePreview.srcdoc || localStorage.getItem(LIVE_GAME_DRAFT_KEY) || '<!-- Default game HTML or placeholder -->';

        if (!draftHTML || draftHTML.trim() === '<!-- Default game HTML or placeholder -->' || draftHTML.trim() === '') {
          alert('There is no game content to publish. Try editing the game first!');
          return;
        }

        if (!connected || !publicKey) {
          alert('Please connect your wallet to publish a game.');
          // Optionally, trigger wallet connection here
          return;
        }

        // Prompt for a game name, or use a default
        let gameName = prompt("Enter a name for your game:", `My Custom Game - ${new Date().toLocaleTimeString()}`);
        if (!gameName) { // User cancelled or entered nothing
          alert('Publishing cancelled. A game name is required.');
          return;
        }
        gameName = gameName.trim();
        if (!gameName) {
            alert('Invalid game name. Publishing cancelled.');
            return;
        }

        const payload = {
          walletAddress: publicKey.toBase58(),
          gameName: gameName,
          htmlContent: draftHTML,
          // You might want to add other metadata like a thumbnail, description, etc.
        };

        try {
          // Show some loading state on the button if desired
          publishLiveGameBtnRef.current.disabled = true;
          publishLiveGameBtnRef.current.textContent = 'Publishing...'; // Or change icon to a spinner

          const response = await fetch('/api/save-user-game', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Failed to publish game. Server returned an error.' }));
            throw new Error(errorData.message || `Server error: ${response.status}`);
          }

          const result = await response.json();
          alert(result.message || 'Game published successfully! It should now appear in your \"My Games\" list.');
          // Optionally, you could close the editor or refresh parts of the UI
          // For example, if the main page lists user games, you might want to trigger a refresh there.

        } catch (error) {
          console.error('Error publishing game:', error);
          alert(`Error publishing game: ${error.message}`);
        } finally {
          // Reset button state
          if (publishLiveGameBtnRef.current) {
            publishLiveGameBtnRef.current.disabled = false;
            // Restore icon if you changed it to text, or re-enable the SVG icon
            publishLiveGameBtnRef.current.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 2.25A4.5 4.5 0 0118 19.5a4.5 4.5 0 01-3.75-3.75H9.75A4.5 4.5 0 016.75 19.5z" /></svg>`;
          }
        }
      };
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      // window.removeEventListener('resize', updateLeaderboardButtonVisibility); // Removed leaderboard
      if (socket) socket.disconnect();
    };
  // Dependencies: `router` for navigation, `playerName` for emissions, `currentGame` for logic
  // `loadGameIntoIframe` is handled separately.
  }, [
    currentGame, 
    playerName, 
    router, 
    fetchUserProfile, 
    loadGameIntoIframe, 
    connected,
    publicKey
  ]); 

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{currentGame ? currentGame.name : 'noods.cc'}</title>
        <meta name="description" content={currentGame ? `Play ${currentGame.name}` : "Select a game to play"} />
        <script src="https://cdn.tailwindcss.com" async></script>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Fredoka:wght@400;600&display=swap" rel="stylesheet" />
      </Head>

      <header className="fixed top-0 left-0 right-0 bg-[#181a1b] text-white p-4 flex justify-between items-center z-50 shadow-lg">
        <div className="flex items-center">
          <Link href="/" legacyBehavior>
            <a className="text-2xl font-bold text-[#b5e3ff] hover:text-pink-400 transition duration-150">
              Noods.cc
            </a>
          </Link>
          <a 
            href="https://app.virtuals.io/virtuals/21279" 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-2 text-sm text-gray-400 hover:text-pink-300 transition duration-150 flex items-center"
          >
            by PotNoodleDev
            <img 
              src="/potnoodledev.jpg" 
              alt="PotNoodleDev" 
              className="w-6 h-6 rounded-full ml-1.5" 
            />
          </a>
          {currentGame && (
            <span className="ml-4 text-xl text-gray-300">| {currentGame.name}</span>
          )}
        </div>
        
        <nav className="flex items-center space-x-4">
          {connected && publicKey && (
            <Link href="/profile" legacyBehavior>
              <a className="hover:text-pink-400 transition duration-150 flex items-center space-x-2">
                {(userProfile?.profilePictureBase64 || userProfile?.image_url) && (
                  <img 
                    src={userProfile.profilePictureBase64 || userProfile.image_url}
                    alt="My Profile" 
                    className="w-8 h-8 rounded-full object-cover border-2 border-pink-400"
                  />
                )}
                <span>Profile</span>
              </a>
            </Link>
          )}
          <WalletMultiButton />
        </nav>
      </header>

      {children} {/* Page specific content will be rendered here */}

      <iframe id="gameFrame" ref={gameFrameRef} className="game-iframe" allowFullScreen style={{display:'none'}}></iframe>
      
      {/* Leaderboard, Modals, etc. - visibility controlled by JS within useEffect */}
      {/* <div className="leaderboard-overlay" id="leaderboardDesktop" ref={leaderboardListRef}>
        <div className="font-bold text-lg mb-2 text-[#b5e3ff]">Leaderboard</div>
        <ul id="leaderboardList" className="space-y-1"></ul>
      </div>
      <button id="leaderboardMobileBtn" ref={leaderboardMobileBtnRef} className="fixed top-3 right-3 z-50 bg-[#b5e3ff] text-[#181a1b] rounded-full p-3 shadow-lg md:hidden" style={{display:'none'}}>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 17l4 4 4-4m0-5l-4-4-4 4" /></svg>
      </button>
      <div id="leaderboardMobileSheet" ref={leaderboardMobileSheetRef} className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-40 md:hidden" style={{display:'none'}}>
        <div className="w-full max-w-md bg-[#23272a] rounded-t-2xl p-4 pb-8 shadow-2xl">
          <div className="flex justify-between items-center mb-2">
            <div className="font-bold text-lg text-[#b5e3ff]">Leaderboard</div>
            <button id="closeLeaderboardMobile" ref={closeLeaderboardMobileRef} className="text-2xl text-[#b5e3ff] hover:text-[#ffe082]">&times;</button>
          </div>
          <ul id="leaderboardListMobile" ref={leaderboardListMobileRef} className="space-y-1"></ul>
        </div>
      </div> */}

      <button id="editLiveGameBtn" ref={editLiveGameBtnRef} className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-pink-400 text-white text-3xl shadow-lg flex items-center justify-center z-50 hover:bg-pink-600 transition" style={{display:'none'}}>✏️</button>
      
      {/* Updated Live Game Editor Modal */}
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
              <div className="text-lg font-semibold text-pink-300">Chat to Build</div>
              <div 
                id="llmChatHistory" 
                ref={llmChatHistoryRef} 
                className="flex-grow min-h-[200px] bg-gray-900 rounded p-3 text-sm font-mono overflow-y-auto border border-gray-700 shadow-inner"
              >
                {/* Chat messages will appear here */}
              </div>
              <form id="llmChatForm" ref={llmChatFormRef} className="space-y-3">
                <textarea 
                  id="llmChatInput" 
                  ref={llmChatInputRef} 
                  className="w-full p-3 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-pink-500 focus:border-pink-500 resize-none" 
                  placeholder="Describe the game or change you want..." 
                  rows="3"
                ></textarea>
                <div className="flex items-center justify-end space-x-2">
                  <button 
                    type="button" 
                    title="Reset Game"
                    id="resetLiveGameBtn" 
                    ref={resetLiveGameBtnRef} 
                    className="p-2.5 bg-red-600 text-white rounded-md shadow hover:bg-red-700 transition flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                  <button 
                    type="button" 
                    title="Publish Game"
                    id="publishLiveGameBtn" 
                    ref={publishLiveGameBtnRef} 
                    className="p-2.5 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition flex items-center justify-center"
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
            <div className="w-full md:w-2/3 flex flex-col p-1 bg-gray-900">
              <div className="text-lg font-semibold text-pink-300 p-3">Live Preview</div>
              <iframe 
                id="liveGamePreview" 
                ref={liveGamePreviewRef} 
                className="w-full flex-grow border-2 border-gray-700 rounded-md shadow-inner" 
                src="/games/livegame.html"
              ></iframe>
            </div>
          </div>
        </div>
      </div>

      <button id="settingsBtn" ref={settingsBtnRef} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-green-500 text-white text-3xl shadow-lg flex items-center justify-center z-50 hover:bg-green-600 transition">
        {/* New Plus Icon SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      <div id="settingsMenu" ref={settingsMenuRef} className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50" style={{display:'none'}}>
        <div className="bg-[#23272a] rounded-2xl p-8 w-full max-w-xs shadow-2xl relative flex flex-col gap-6">
          <button id="closeSettingsMenu" ref={closeSettingsMenuRef} className="absolute top-4 right-4 text-2xl text-[#b5e3ff] hover:text-[#ffe082]">&times;</button>
          <div>
            <label className="block text-[#b5e3ff] font-bold mb-2" htmlFor="gameSelect">Change Game</label>
            <select id="gameSelect" ref={gameSelectRef} className="w-full p-2 rounded bg-[#181a1b] text-white border border-[#b5e3ff]"></select>
          </div>
          <div>
            <label className="block text-[#b5e3ff] font-bold mb-2" htmlFor="nameInput">Your Name</label>
            <input id="nameInput" ref={nameInputRef} className="w-full p-2 rounded bg-[#181a1b] text-white border border-[#b5e3ff]" maxLength="16" />
          </div>
          <button id="saveSettings" ref={saveSettingsRef} className="w-full py-3 rounded-xl bg-[#b5e3ff] text-[#181a1b] font-bold text-lg hover:bg-[#ffe082] transition">Save</button>
        </div>
      </div>
    </>
  );
} 
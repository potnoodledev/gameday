import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from './WalletMultiButton'; // Assuming WalletMultiButton is in the same components folder

export const games = [
  // { name: 'Bee Colony Simulator', path: 'bee-colony-simulator/index.html', id: 'bee-colony-simulator' },
  { name: 'Dice Race', path: 'dice-race/index.html', id: 'dice-race' },
  { name: 'Cell Tag', path: 'cell-tag/index.html', id: 'cell-tag' },
  { name: 'Live Game', path: 'livegame.html', id: 'livegame' }
];

export default function Layout({ children, currentGameIdFromProp }) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();

  const leaderboardListRef = useRef(null);
  const leaderboardListMobileRef = useRef(null);
  const leaderboardMobileBtnRef = useRef(null);
  const leaderboardMobileSheetRef = useRef(null);
  const closeLeaderboardMobileRef = useRef(null);
  // gameMenuRef and gameMenuListRef will likely stay on index.js or be passed as children if needed
  const gameFrameRef = useRef(null);
  const editLiveGameBtnRef = useRef(null);
  const liveGameEditorModalRef = useRef(null);
  const closeLiveGameEditorRef = useRef(null);
  const llmChatHistoryRef = useRef(null);
  const llmChatFormRef = useRef(null);
  const llmChatInputRef = useRef(null);
  const publishLiveGameBtnRef = useRef(null);
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
    const leaderboardList = leaderboardListRef.current;
    const leaderboardListMobile = leaderboardListMobileRef.current;
    const leaderboardMobileBtn = leaderboardMobileBtnRef.current;
    const leaderboardMobileSheet = leaderboardMobileSheetRef.current;
    const closeLeaderboardMobile = closeLeaderboardMobileRef.current;
    const editLiveGameBtn = editLiveGameBtnRef.current;
    const liveGameEditorModal = liveGameEditorModalRef.current;
    const closeLiveGameEditor = closeLiveGameEditorRef.current;
    const llmChatHistory = llmChatHistoryRef.current;
    const llmChatForm = llmChatFormRef.current;
    const llmChatInput = llmChatInputRef.current;
    const publishLiveGameBtn = publishLiveGameBtnRef.current;
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
    let lastLeaderboardData = [];

    const updateLeaderboard = (data) => {
      lastLeaderboardData = data;
      if (!leaderboardList || !leaderboardListMobile) return;
      leaderboardList.innerHTML = '';
      leaderboardListMobile.innerHTML = '';
      data.forEach((entry, i) => {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center px-2 py-1 rounded gap-2';
        const statusDotSpan = document.createElement('span');
        statusDotSpan.className = 'inline-block w-3 h-3 rounded-full mr-2';
        statusDotSpan.style.background = onlineUsers[entry.name] ? '#22c55e' : '#888';
        const statusDot = statusDotSpan.outerHTML;
        let emoji = playerEmojis[entry.name] || '';
        let emojiSpan = emoji ? `<span style="font-family:Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,EmojiOne,sans-serif;font-size:1.8em;line-height:1;">${emoji}</span>` : '';
        let pos = (typeof playerPositions[entry.name] === 'number' && !isNaN(playerPositions[entry.name])) ? playerPositions[entry.name] : ((typeof entry.pos === 'number' && !isNaN(entry.pos)) ? entry.pos : 0);
        let posText = `<span class='ml-1 text-xs text-gray-400'>(pos: ${pos})</span>`;
        let nameSpan = `<span class='flex items-center gap-1'>${statusDot}${emojiSpan}${entry.name}${posText}</span>`;
        if (entry.name === playerName) {
          li.className += ' bg-[#b5e3ff] text-[#181a1b] font-bold';
        } else {
          li.className += ' text-white';
        }
        li.innerHTML = `<span>${i + 1}. ${nameSpan}</span> <span>${entry.score ?? 0}</span>`;
        leaderboardList.appendChild(li);
        const liMobile = li.cloneNode(true);
        leaderboardListMobile.appendChild(liMobile);
      });
    };

    if (socket) {
        socket.on('leaderboard', (data) => {
          onlineUsers = {};
          data.forEach(entry => { onlineUsers[entry.name] = true; });
          updateLeaderboard(data);
        });
        socket.on('onlineStatus', (status) => {
          onlineUsers = status;
          updateLeaderboard(lastLeaderboardData);
        });
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

    if (settingsBtn) settingsBtn.onclick = () => {
        if(settingsMenu) settingsMenu.style.display = 'flex';
        populateGameSelect();
    };
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

    const showEditBtnIfLiveGame = () => {
      if (editLiveGameBtn) {
        if (currentGame && currentGame.id === 'livegame') {
          editLiveGameBtn.style.display = 'flex';
        } else {
          editLiveGameBtn.style.display = 'none';
        }
      }
    };
    showEditBtnIfLiveGame(); // Call on initial setup and when currentGame changes (handled by other effects)

    if (editLiveGameBtn) editLiveGameBtn.onclick = () => {
        if (liveGameEditorModal) liveGameEditorModal.style.display = 'flex';
        const draftHTML = localStorage.getItem(LIVE_GAME_DRAFT_KEY);
        if (draftHTML && liveGamePreviewRef.current) {
            liveGamePreviewRef.current.srcdoc = draftHTML;
        } else if (liveGamePreviewRef.current) {
            // If no draft, ensure the iframe reloads its original src to show the published version
            liveGamePreviewRef.current.removeAttribute('srcdoc'); // Remove srcdoc so src applies
            // Add a cache-busting query parameter to force reload
            const currentSrc = liveGamePreviewRef.current.src.split('?')[0]; // Get base src
            liveGamePreviewRef.current.src = `${currentSrc}?t=${new Date().getTime()}`;
        }
    };
    if (closeLiveGameEditor) closeLiveGameEditor.onclick = () => {
        if (liveGameEditorModal) liveGameEditorModal.style.display = 'none';
    };
    
    if (llmChatForm && llmChatHistory && llmChatInput && liveGamePreviewRef.current) {
      llmChatForm.onsubmit = async (e) => {
        e.preventDefault();
        const userMessage = llmChatInput.value.trim();
        if (!userMessage) return;

        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'mb-2 p-2 bg-blue-600 rounded-lg self-end text-right';
        userMsgDiv.textContent = `You: ${userMessage}`;
        llmChatHistory.appendChild(userMsgDiv);
        llmChatInput.value = '';

        const aiMsgDiv = document.createElement('div');
        aiMsgDiv.className = 'mb-2 p-2 bg-gray-700 rounded-lg self-start relative group';
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
              currentCode: liveGamePreviewRef.current.srcdoc || localStorage.getItem(LIVE_GAME_DRAFT_KEY) || '<!-- Start coding here -->',
            }),
          });

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/plain')) {
            // Streaming plaintext response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            aiPre.textContent = ""; // Clear placeholder
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
            // After stream is complete, final accumulatedCode is ready

          } else if (contentType && contentType.includes('application/json')) {
            // Non-streaming JSON response (OpenAI non-stream or error objects)
            const responseText = await response.text(); // Read as text first to avoid parsing errors on empty/malformed body
            if (!responseText) {
                throw new Error('AI returned an empty JSON response.');
            }
            try {
                const data = JSON.parse(responseText);
                if (response.ok) {
                    if (data.newCode) {
                        aiPre.textContent = data.newCode;
                        accumulatedCode = data.newCode;
                    } else {
                        throw new Error('AI response did not contain newCode.');
                    }
                } else {
                    throw new Error(data.error || 'Unknown error from AI (JSON)');
                }
            } catch (parseError) {
                // If JSON parsing fails, treat the responseText as a potential error message
                throw new Error(`Failed to parse AI JSON response: ${parseError.message}. Response was: ${responseText}`);
            }
          } else {
            const textResponse = await response.text();
            aiPre.textContent = `Unexpected response type: ${contentType}\n${textResponse}`;
            throw new Error(`Unexpected response type: ${contentType}`);
          }

          // Common logic after successful response (streamed or JSON)
          if (accumulatedCode && liveGamePreviewRef.current) {
            liveGamePreviewRef.current.srcdoc = accumulatedCode;
            localStorage.setItem(LIVE_GAME_DRAFT_KEY, accumulatedCode);
          } else if (!aiPre.textContent.toLowerCase().includes('error') && !accumulatedCode) {
            aiPre.textContent += (aiPre.textContent ? '\n' : '') + "(AI generated empty content)";
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

    if (publishLiveGameBtn && liveGamePreviewRef.current) publishLiveGameBtn.onclick = async () => {
        const newCode = localStorage.getItem(LIVE_GAME_DRAFT_KEY);
        if (!newCode) { alert('No draft to publish.'); return; }
        try {
            const response = await fetch('/api/publish-live-game', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ htmlContent: newCode })
            });
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const result = await response.json();
            alert(result.message || 'Published successfully!');
        } catch (error) {
            console.error('Error publishing live game:', error);
            alert(`Error publishing: ${error.message}`);
        }
    };

    if (leaderboardMobileBtn) leaderboardMobileBtn.onclick = () => {
      if(leaderboardMobileSheet) leaderboardMobileSheet.style.display = 'flex';
    };
    if (closeLeaderboardMobile) closeLeaderboardMobile.onclick = () => {
      if(leaderboardMobileSheet) leaderboardMobileSheet.style.display = 'none';
    };

    const updateLeaderboardButtonVisibility = () => {
        if (leaderboardMobileBtn) {
            if (window.innerWidth < 768) { leaderboardMobileBtn.style.display = 'block'; }
            else { leaderboardMobileBtn.style.display = 'none'; }
        }
    };
    updateLeaderboardButtonVisibility();
    window.addEventListener('resize', updateLeaderboardButtonVisibility);

    // RESTORED: sendPlayerNameToGame definition and onload assignment
    const sendPlayerNameToGame = () => {
      if (gameFrameRef.current && gameFrameRef.current.contentWindow && playerName) {
        gameFrameRef.current.contentWindow.postMessage({ type: 'playerName', name: playerName }, '*');
      }
    };
    // Ensure gameFrameRef.current is available before assigning onload
    if (gameFrameRef.current) {
        gameFrameRef.current.onload = sendPlayerNameToGame;
    }
    // END RESTORED

    if (liveGameEditorModal) {
      // Remove the radio button group for model selection
      const modelSelectionRadios = liveGameEditorModal.querySelectorAll('.model-selection-radios');
      modelSelectionRadios.forEach(radioGroup => radioGroup.remove());
    }

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      window.removeEventListener('resize', updateLeaderboardButtonVisibility);
      if (socket) socket.disconnect();
    };
  // Dependencies: `router` for navigation, `playerName` for emissions, `currentGame` for logic
  // `loadGameIntoIframe` is handled separately.
  }, [router, playerName, currentGame]); 

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Vibe Game A Day</title>
        <script src="https://cdn.tailwindcss.com" async></script>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Fredoka:wght@400;600&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 100, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {connected && publicKey && (
          <Link href="/profile" passHref>
            <button 
              className="px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-md hover:bg-pink-600 transition-colors"
              style={{ height: '40px' }}
            >
              Profile
            </button>
          </Link>
        )}
        <WalletMultiButton />
      </div>

      {children} {/* Page specific content will be rendered here */}

      <iframe id="gameFrame" ref={gameFrameRef} className="game-iframe" allowFullScreen style={{display:'none'}}></iframe>
      
      {/* Leaderboard, Modals, etc. - visibility controlled by JS within useEffect */}
      <div className="leaderboard-overlay" id="leaderboardDesktop" ref={leaderboardListRef}>
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
      </div>

      <button id="editLiveGameBtn" ref={editLiveGameBtnRef} className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-pink-400 text-white text-3xl shadow-lg flex items-center justify-center z-50 hover:bg-pink-600 transition" style={{display:'none'}}>✏️</button>
      <div id="liveGameEditorModal" ref={liveGameEditorModalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" style={{display:'none'}}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl flex flex-col gap-4 relative">
          <button id="closeLiveGameEditor" ref={closeLiveGameEditorRef} className="absolute top-4 right-4 text-2xl text-pink-400 hover:text-pink-600">&times;</button>
          <div className="text-2xl font-bold text-pink-600 mb-2">Chat to Build Live Game</div>
          <div id="llmChatHistory" ref={llmChatHistoryRef} className="flex-1 min-h-[180px] max-h-64 overflow-y-auto bg-pink-50 rounded p-3 mb-2 text-gray-900 text-sm font-mono"></div>
          <form id="llmChatForm" ref={llmChatFormRef} className="flex gap-2 items-center mt-2">
            <input id="llmChatInput" ref={llmChatInputRef} className="flex-1 rounded border border-pink-300 p-2 text-gray-900 bg-white" placeholder="Describe the game or change you want..." autoComplete="off" />
            <button type="submit" className="px-4 py-2 bg-pink-500 text-white rounded-lg font-bold shadow hover:bg-pink-700 transition">Send</button>
            <button type="button" id="publishLiveGameBtn" ref={publishLiveGameBtnRef} className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold shadow hover:bg-green-700 transition">Publish</button>
          </form>
          <div className="mt-4">
            <div className="text-lg font-bold mb-1 text-pink-600">Live Preview</div>
            <iframe id="liveGamePreview" ref={liveGamePreviewRef} className="w-full h-64 border-2 border-pink-200 rounded-lg shadow" src="/games/livegame.html"></iframe>
          </div>
        </div>
      </div>

      <button id="settingsBtn" ref={settingsBtnRef} className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#b5e3ff] text-[#181a1b] text-3xl shadow-lg flex items-center justify-center z-50 hover:bg-[#ffe082] transition">⚙️</button>
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
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from './WalletMultiButton'; // Assuming WalletMultiButton is in the same components folder

const LIVE_GAME_DRAFT_KEY = 'liveGameDraftHTML'; // Moved to top-level constant

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

// Add this utility function near the top of the file, after the imports
const truncateWalletAddress = (address) => {
  if (!address) return '';
  if (address.length <= 12) return address; // Don't truncate if already short
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export default function Layout({ children, currentGameIdFromProp, currentGameHtmlForEditor, currentSavedGameName }) {
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
  const viewLiveGameCodeBtnRef = useRef(null);
  const liveGamePreviewRef = useRef(null);
  const deleteLiveGameBtnRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const liveGameEditorTitleRef = useRef(null); // Added ref for editor title
  const closeSettingsMenuRef = useRef(null);
  const gameSelectRef = useRef(null);
  const nameInputRef = useRef(null);
  const saveSettingsRef = useRef(null);

  // Store current game in state, to be derived from prop or router query
  const [currentGame, setCurrentGame] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [showCodeEditor, setShowCodeEditor] = useState(false); // State for editor visibility
  const [editorCode, setEditorCode] = useState(''); // State to hold code for the editor
  const highlightedCodeRef = useRef(null); // Ref for the <code> element for Prism
  const codeEditorTextareaRef = useRef(null); // Ref for the textarea
  const highlightedCodeContainerRef = useRef(null); // Ref for the <pre> container for scrolling

  // --- Handler Functions for Modal Buttons ---
  const openCodeEditor = () => {
    const savedHtml = localStorage.getItem(LIVE_GAME_DRAFT_KEY);
    if (savedHtml && savedHtml.trim() !== '') {
      setEditorCode(savedHtml);
    } else {
      setEditorCode('<!-- No code found in local storage. Start typing here! -->');
    }
    setShowCodeEditor(true);
  };

  const handleResetGame = () => {
    if (!liveGamePreviewRef.current || !llmChatHistoryRef.current || !llmChatInputRef.current) return;
    if (window.confirm("Are you sure? This will reset the game to the default version")) {
      localStorage.removeItem(LIVE_GAME_DRAFT_KEY);
      liveGamePreviewRef.current.removeAttribute('srcdoc');
      const originalSrc = '/games/livegame.html';
      liveGamePreviewRef.current.src = `${originalSrc}?t=${new Date().getTime()}`;
      llmChatHistoryRef.current.innerHTML = '';
      llmChatInputRef.current.value = '';
    }
  };

  const handlePublishGame = async () => {
    if (!liveGamePreviewRef.current || !publishLiveGameBtnRef.current) return;

    const draftHTML = liveGamePreviewRef.current.srcdoc || localStorage.getItem(LIVE_GAME_DRAFT_KEY) || '';
    if (!draftHTML || draftHTML.trim() === '' || draftHTML.trim() === '<!-- Start coding here -->') {
      alert('There is no game content to publish. Try editing the game first!');
      return;
    }
    if (!connected || !publicKey) {
      alert('Please connect your wallet to publish a game.');
      return;
    }
    let gameNameToPublish;
    if (currentGameIdFromProp && currentSavedGameName) {
      gameNameToPublish = currentSavedGameName;
    } else {
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
      gameNameToPublish = promptedName;
    }
    const payload = {
      walletAddress: publicKey.toBase58(),
      gameName: gameNameToPublish,
      htmlContent: draftHTML,
      username: userProfile?.username || publicKey.toBase58()
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
    } catch (error) {
      console.error('Error publishing game:', error);
      alert(`Error publishing game: ${error.message}`);
    } finally {
      publishButton.disabled = false;
      publishButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 2.25A4.5 4.5 0 0118 19.5a4.5 4.5 0 01-3.75-3.75H9.75A4.5 4.5 0 016.75 19.5z" /></svg>`;
    }
  };

  const handleDeleteGame = async () => {
    if (!deleteLiveGameBtnRef.current || !liveGamePreviewRef.current || !llmChatHistoryRef.current || !llmChatInputRef.current || !liveGameEditorModalRef.current) return;
    if (!currentGameIdFromProp || !publicKey) {
      alert('Cannot delete game: Missing game ID or wallet connection.');
      return;
    }
    if (window.confirm('Are you sure you want to permanently delete this game? This action cannot be undone.')) {
      try {
        const response = await fetch('/api/delete-user-game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId: currentGameIdFromProp,
            walletAddress: publicKey.toBase58(),
          }),
        });
        const result = await response.json();
        if (response.ok) {
          alert(result.message || 'Game deleted successfully.');
          localStorage.removeItem(LIVE_GAME_DRAFT_KEY);
          liveGamePreviewRef.current.removeAttribute('srcdoc');
          liveGamePreviewRef.current.src = `/games/livegame.html?t=${Date.now()}`;
          llmChatHistoryRef.current.innerHTML = '';
          llmChatInputRef.current.value = '';
          liveGameEditorModalRef.current.style.display = 'none';
          router.push('/');
        } else {
          throw new Error(result.error || 'Failed to delete game.');
        }
      } catch (error) {
        console.error('Error deleting game:', error);
        alert(`Error: ${error.message}`);
      }
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
    userMsgDiv.className = 'mb-2 p-2 rounded-lg self-end text-xs text-right text-white';
    userMsgDiv.textContent = `You: ${userMessage}`;
    llmChatHistory.appendChild(userMsgDiv);
    llmChatInput.value = '';

    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'mb-2 p-2 rounded-lg self-start relative group text-xs text-white';
    const aiPre = document.createElement('pre');
    aiPre.className = 'whitespace-pre-wrap break-words';
    aiPre.textContent = 'PotNoodleDev: Now cooking up a game...';
    aiMsgDiv.appendChild(aiPre);
    llmChatHistory.appendChild(aiMsgDiv);
    llmChatHistory.scrollTop = llmChatHistory.scrollHeight;

    let accumulatedCode = "";
    try {
      const currentCodeBase = liveGamePreview.srcdoc || localStorage.getItem(LIVE_GAME_DRAFT_KEY) || '';
      const isEditingExistingGame = currentCodeBase && currentCodeBase.trim() !== '' && currentCodeBase.trim() !== '<!-- Start coding here -->';
      let systemPrompt;
      if (isEditingExistingGame && currentGameHtmlForEditor) {
        systemPrompt = `The user wants to change their existing game. The current game code is provided. Apply the following change to the existing code: ${userMessage}`;
      } else if (isEditingExistingGame) {
        systemPrompt = `The user is continuing to edit their game. The current game code is provided. Apply the following change to the existing code: ${userMessage}`;
      } else {
        systemPrompt = `The user wants to make a new game. Create a new game based on this request: ${userMessage}`;
      }
      const response = await fetch('/api/generate-game-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: systemPrompt,
          currentCode: currentCodeBase || '<!-- Start coding here -->',
        }),
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/plain')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        aiPre.textContent = "PotNoodleDev: ";
        let firstChunk = true;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value);
          if (firstChunk) firstChunk = false;
          aiPre.textContent += chunkText;
          accumulatedCode += chunkText;
          llmChatHistory.scrollTop = llmChatHistory.scrollHeight;
        }
      } else if (contentType && contentType.includes('application/json')) {
        const responseText = await response.text();
        if (!responseText) throw new Error('AI returned an empty JSON response.');
        try {
          const data = JSON.parse(responseText);
          if (response.ok) {
            if (data.newCode) {
              aiPre.textContent = "PotNoodleDev: " + data.newCode;
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
      let cleanedCode = accumulatedCode.replace(/^```html\n?/i, '').replace(/\n?```$/, '').replace(/^```\n?/i, '').replace(/\n?```$/, '').trim();
      if (cleanedCode && liveGamePreview) {
        liveGamePreview.srcdoc = cleanedCode;
        localStorage.setItem(LIVE_GAME_DRAFT_KEY, cleanedCode);
      } else if (!aiPre.textContent.toLowerCase().includes('error') && !cleanedCode && accumulatedCode.length > 0) {
        aiPre.textContent += (aiPre.textContent.endsWith("PotNoodleDev: ") ? '' : '\n') + "(AI generated content that was cleaned to empty. Original might have been only markdown fences.)";
      } else if (!aiPre.textContent.toLowerCase().includes('error') && !cleanedCode) {
        aiPre.textContent += (aiPre.textContent.endsWith("PotNoodleDev: ") ? '' : '\n') + "(AI generated empty content)";
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
  // --- End Handler Functions ---

  useEffect(() => {
    // Effect for Prism.js highlighting and scroll synchronization
    if (showCodeEditor && highlightedCodeRef.current && typeof Prism !== 'undefined') {
      if (codeEditorTextareaRef.current) {
        highlightedCodeRef.current.textContent = codeEditorTextareaRef.current.value;
      }
      Prism.highlightElement(highlightedCodeRef.current);
    }

    // Scroll synchronization logic
    const textareaElement = codeEditorTextareaRef.current;
    const preElement = highlightedCodeContainerRef.current;

    const syncScroll = () => {
      if (textareaElement && preElement) {
        preElement.scrollTop = textareaElement.scrollTop;
        preElement.scrollLeft = textareaElement.scrollLeft;
      }
    };

    if (showCodeEditor && textareaElement) {
      textareaElement.addEventListener('scroll', syncScroll);
    }

    return () => {
      if (textareaElement) {
        textareaElement.removeEventListener('scroll', syncScroll);
      }
    };
  }, [editorCode, showCodeEditor]); // Re-run when editor is shown or code changes, or editor visibility changes

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
    const viewLiveGameCodeBtn = viewLiveGameCodeBtnRef.current;
    const liveGamePreview = liveGamePreviewRef.current;
    const deleteLiveGameBtn = deleteLiveGameBtnRef.current;
    const settingsBtn = settingsBtnRef.current;
    const settingsMenu = settingsMenuRef.current;
    const closeSettingsMenu = closeSettingsMenuRef.current;
    const gameSelect = gameSelectRef.current;
    const nameInput = nameInputRef.current;
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

    const openLiveGameEditor = () => {
      if (currentGameHtmlForEditor) { // Check if HTML content is passed
        localStorage.setItem(LIVE_GAME_DRAFT_KEY, currentGameHtmlForEditor);
      }
      // If not passed, localStorage remains as is (could be an old draft or nothing)
      // livegame.html will handle loading from localStorage or its default

      if (liveGameEditorModalRef.current) { // Directly use the ref.current
        liveGameEditorModalRef.current.style.display = 'flex'; // Revert to style.display to show
      }
      if (liveGamePreviewRef.current) { // Directly use the ref.current
        // Add cache-busting query param to ensure fresh load which reads localStorage
        liveGamePreviewRef.current.src = `/games/livegame.html?t=${Date.now()}`;
      }
      if (llmChatInputRef.current) { // Directly use the ref.current
        llmChatInputRef.current.focus();
      }
    };

    // Ensure settingsBtn (plus/pencil button) opens the live game editor
    if (settingsBtnRef.current) {
        settingsBtnRef.current.onclick = openLiveGameEditor;
    }

    // Logic for editLiveGameBtn (the old pencil icon, if it still exists and is used)
    if (editLiveGameBtnRef.current) {
        editLiveGameBtnRef.current.onclick = openLiveGameEditor;
    }

    // Logic for closing the editor modal
    if (closeLiveGameEditorRef.current && liveGameEditorModalRef.current) {
        closeLiveGameEditorRef.current.onclick = () => {
            if (liveGameEditorModalRef.current) liveGameEditorModalRef.current.style.display = 'none';
        };
    }
    
    // Remove model selection radios if they were part of a previous version
    if (liveGameEditorModalRef.current) {
      const modelSelectionRadios = liveGameEditorModalRef.current.querySelectorAll('.model-selection-radios');
      modelSelectionRadios.forEach(radioGroup => radioGroup.remove());
    }

    // Add keydown listener to chat input for Enter submission
    if (llmChatInputRef.current && llmChatFormRef.current) {
        llmChatInputRef.current.onkeydown = (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            // Directly call the handler, ensuring the event object is passed for preventDefault within the handler
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            llmChatFormRef.current.dispatchEvent(submitEvent);
          }
        };
    }

    // Update button appearance for settingsBtn based on currentGameHtmlForEditor
    if (settingsBtnRef.current) {
      const btn = settingsBtnRef.current;
      const plusIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
      const pencilIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" class="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>`;

      if (currentGameHtmlForEditor) {
        btn.innerHTML = pencilIconSvg;
        btn.classList.remove('bg-green-500', 'hover:bg-green-600');
        btn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
      } else {
        btn.innerHTML = plusIconSvg;
        btn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
        btn.classList.add('bg-green-500', 'hover:bg-green-600');
      }
    }

    // Update editor title text based on currentGameHtmlForEditor
    if (liveGameEditorTitleRef.current) {
      if (currentGameHtmlForEditor) {
        liveGameEditorTitleRef.current.textContent = "Ask PotNoodleDev to change the game";
      } else {
        liveGameEditorTitleRef.current.textContent = "Ask PotNoodleDev to make a game";
      }
    }

    // Conditionally show/hide delete button (this should use the handleDeleteGame which has its own internal logic now)
    if (deleteLiveGameBtnRef.current) {
      if (currentGameIdFromProp && currentGameHtmlForEditor) {
        deleteLiveGameBtnRef.current.style.display = 'flex';
      } else {
        deleteLiveGameBtnRef.current.style.display = 'none';
      }
    }
    
    // Setup for settings menu (close, save)
    if (closeSettingsMenuRef.current && settingsMenuRef.current) {
        closeSettingsMenuRef.current.onclick = () => {
            if(settingsMenuRef.current) settingsMenuRef.current.style.display = 'none';
        };
    }
    if (saveSettingsRef.current && nameInputRef.current && gameSelectRef.current && settingsMenuRef.current) {
        saveSettingsRef.current.onclick = () => {
            const newName = nameInputRef.current.value;
            if (newName) {
                setPlayerName(newName);
                localStorage.setItem('playerName', newName);
            }
            const selectedGameIdInSettings = gameSelectRef.current.value;
            if (selectedGameIdInSettings && (!currentGame || selectedGameIdInSettings !== currentGame.id)) {
                router.push(`/game/${selectedGameIdInSettings}`);
            }
            if(settingsMenuRef.current) settingsMenuRef.current.style.display = 'none';
            // if (socket && currentGame && newName) socket.emit('playerJoined', { name: newName, game: currentGame.name }); 
            // Socket emit for playerJoined is complex, ensure it's handled correctly if newName or currentGame changes
        };
    }

    // Original direct DOM manipulations for editLiveGameBtn, closeLiveGameEditor, etc., are now mostly handled by React state or direct JSX handlers.
    // The remaining ones like modelSelectionRadios.forEach(radioGroup => radioGroup.remove()); can stay if they are one-time setups.

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
    publicKey,
    currentGameHtmlForEditor,
    currentGameIdFromProp,
    currentSavedGameName,
    userProfile
  ]); 

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{currentGame ? currentGame.name : 'noods.cc'}</title>
        <meta name="description" content={currentGame ? `Play ${currentGame.name}` : "Select a game to play"} />
        <script src="https://cdn.tailwindcss.com" async></script>
        {/* Remove conflicting Google Fonts, only use Darker Grotesque loaded globally */}
        {/* Prism.js CSS (okaidia theme chosen for dark mode compatibility) */}
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css" rel="stylesheet" />
      </Head>

      {/* Prism.js Core and HTML language component - ensure they load after page content or are handled appropriately */}
      {/* It's often better to put scripts at the end of the body, but for Next.js Head, this is one way. */}
      {/* We might need to ensure Prism is available before calling its methods. */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" async></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup-templating.min.js" async></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-html.min.js" async></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js" async></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js" async></script>

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
            <span className="ml-4 text-xs text-gray-300">| {currentGame.name}</span>
          )}
        </div>
        
        <nav className="flex items-center bg-red-500 space-x-4">
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
                <span>{userProfile?.username ? truncateWalletAddress(userProfile.username) : truncateWalletAddress(publicKey.toBase58())}</span>
              </a>
            </Link>
          )}
          <WalletMultiButton className="rounded-full py-1 px-1 text-white text-md shadow-lg border border-white/30 transition-all duration-200 bg-gradient-to-r from-[#7F4BFF] to-[#6B21A8] hover:from-[#6B21A8] hover:to-[#7F4BFF] focus:outline-none focus:ring-2 focus:ring-purple-400/60" />
        </nav>
      </header>

      {/* Main content area: full screen height, scrolls internally, content starts below fixed header. Added bg-slate-900 */}
      <main className="w-full h-screen overflow-y-auto pt-20 bg-slate-900">
        {children} {/* Page specific content will be rendered here */}

        <footer className="w-full bg-slate-900 text-slate-400 text-sm py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-700 mt-12">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p>&copy; {new Date().getFullYear()} Noods.cc - All mischief managed.</p>
            <div className="flex space-x-6">
              <a href="https://npcday.substack.com" target="_blank" rel="noopener noreferrer" className="hover:text-pink-400 transition-colors">
                NPC Day Substack
              </a>
              <a href="https://engine.cosmiclabs.org" target="_blank" rel="noopener noreferrer" className="hover:text-sky-400 transition-colors">
                Cosmic Engine
              </a>
            </div>
          </div>
        </footer>
      </main>

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
              {showCodeEditor ? (
                // Code Editor View with Prism.js highlighting
                <div id="liveGameManualEditor" className="flex-grow flex flex-col space-y-3 relative h-full">
                  <div className="relative w-full flex-grow h-full">
                    <textarea 
                      ref={codeEditorTextareaRef}
                      className="absolute top-0 left-0 w-full h-full p-3 rounded bg-transparent border border-gray-700 text-transparent caret-pink-400 placeholder-gray-500 focus:ring-pink-500 focus:border-pink-500 resize-none font-mono text-xs leading-relaxed z-10 whitespace-pre overflow-auto"
                      value={editorCode}
                      onChange={(e) => setEditorCode(e.target.value)}
                      placeholder="Enter your HTML game code here..."
                      spellCheck="false"
                    />
                    <pre 
                      ref={highlightedCodeContainerRef}
                      className="absolute top-0 left-0 w-full h-full p-3 rounded bg-gray-900 border border-gray-700 text-xs leading-relaxed m-0 overflow-auto pointer-events-none whitespace-pre-wrap"
                      aria-hidden="true"
                    >
                      <code ref={highlightedCodeRef} className="language-html whitespace-pre-wrap">
                        {/* Code will be injected here by useEffect and Prism */}
                        {editorCode} {/* Initial content before Prism runs */}
                      </code>
                    </pre>
                  </div>
                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button 
                      type="button" 
                      title="Cancel Edit"
                      className="p-2.5 bg-gray-600 text-white rounded-md shadow hover:bg-gray-700 transition"
                      onClick={() => setShowCodeEditor(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      title="Save and Update Preview"
                      className="p-2.5 bg-green-600 text-white rounded-md shadow hover:bg-green-700 transition"
                      onClick={() => {
                        localStorage.setItem(LIVE_GAME_DRAFT_KEY, editorCode);
                        if (liveGamePreviewRef.current) {
                          liveGamePreviewRef.current.srcdoc = editorCode;
                        }
                        setShowCodeEditor(false);
                      }}
                    >
                      Save & Update Preview
                    </button>
                  </div>
                </div>
              ) : (
                // Original Chat View
                <>
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
                    className="flex-grow min-h-[200px] bg-gray-900 rounded p-3 text-xs font-mono overflow-y-auto border border-gray-700 shadow-inner"
                  >
                    {/* Chat messages will appear here */}
                  </div>
                  <form id="llmChatForm" ref={llmChatFormRef} className="space-y-3" onSubmit={handleLlmFormSubmit}>
                    <textarea 
                      id="llmChatInput" 
                      ref={llmChatInputRef} 
                      className="w-full p-3 rounded bg-[#1E1D47] border border-gray-600 text-xs text-white placeholder-white focus:ring-white focus:border-white resize-none" 
                      placeholder="Describe the game or change you want..." 
                      rows="3"
                    ></textarea>
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        type="button" 
                        title="Delete Game"
                        id="deleteLiveGameBtn" 
                        ref={deleteLiveGameBtnRef} 
                        className="p-2.5 bg-gray-600 text-white rounded-md shadow hover:bg-gray-700 transition flex items-center justify-center"
                        style={{display: 'none'}} // Hidden by default
                        onClick={handleDeleteGame}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.56 0c1.153 0 2.243.096 3.298.286m7.096 0c.23.02.458.04.682.06M5.28 5.79A48.074 48.074 0 018.084 5.5H11m-5.72 0c-.04.166-.078.334-.114.504m11.422 0a48.074 48.074 0 00-3.306-.286m0 0L12.995 3.695A2.25 2.25 0 0010.996 2.25H9.004A2.25 2.25 0 007.005 3.695L6.28 5.79M12 12.25v4.5m0-4.5H12.06" />
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        title="Reset Game"
                        id="resetLiveGameBtn" 
                        ref={resetLiveGameBtnRef} 
                        className="p-2.5 bg-red-600 text-white rounded-md shadow hover:bg-red-700 transition flex items-center justify-center"
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
                        onClick={openCodeEditor}
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
                </>
              )}
            </div>

            {/* Right Column: Live Preview */}
            <div className="w-full md:w-2/3 flex flex-col bg-transparent">
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
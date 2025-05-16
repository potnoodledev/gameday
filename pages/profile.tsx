import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from '../components/WalletMultiButton'; // Assuming path is correct

interface UserProfile {
  wallet_address: string;
  email?: string | null;
  username?: string | null;
  image_url?: string | null;
  profilePictureBase64?: string | null;
  created_at?: string;
  updated_at?: string;
}

const ProfilePage = () => {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Redirect if not connected
  useEffect(() => {
    if (!connected && !publicKey) {
      // Give a moment for wallet to initialize, then redirect if still not connected
      const timer = setTimeout(() => {
        if (!connected && !publicKey) { // Re-check after timeout
          router.push('/');
        }
      }, 1000); // 1 second delay, adjust as needed
      return () => clearTimeout(timer);
    }
  }, [connected, publicKey, router]);

  const fetchProfile = useCallback(async () => {
    if (!publicKey) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/profile?walletAddress=${publicKey.toBase58()}`);
      if (response.ok) {
        const data: UserProfile = await response.json();
        setProfile(data);
        setEmail(data.email || '');
        setUsername(data.username || '');
        setImageUrl(data.image_url || '');
      } else if (response.status === 404) {
        // Profile not found, initialize with empty fields for creation
        setProfile(null); // Or set a default structure with walletAddress
        setEmail('');
        setUsername('');
        setImageUrl('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      fetchProfile();
    }
    // Clear preview when profile is fetched or publicKey changes, to avoid showing stale preview
    setPreviewUrl(null);
    setSelectedFile(null);
  }, [publicKey, fetchProfile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setImageUrl(''); // Clear existing imageUrl if a new file is selected
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('walletAddress', publicKey.toBase58());

    if (email.trim()) {
      formData.append('email', email.trim());
    }

    if (username.trim()) {
      formData.append('username', username.trim());
    }

    if (selectedFile) {
      formData.append('profileImage', selectedFile);
      // No need to append imageUrl if a file is being uploaded, 
      // as the backend will prioritize the file and nullify image_url.
    } else if (imageUrl.trim()) {
      formData.append('imageUrl', imageUrl.trim());
    }
    
    // If neither selectedFile nor imageUrl is provided, 
    // and you want to explicitly clear any existing image_url or profile_picture_data on the backend,
    // you might need to send a specific flag or handle it in the backend logic if no image field is present.
    // Current backend logic: if profilePictureData is null and imageUrl is null in formdata, it COALESCES to existing values.
    // If selectedFile is present, backend nullifies image_url.

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        // Headers are not explicitly set to Content-Type: multipart/form-data
        // The browser will do it automatically when FormData is used as body, along with the correct boundary.
        body: formData,
      });

      if (response.ok) {
        const updatedProfile: UserProfile = await response.json();
        setProfile(updatedProfile);
        setEmail(updatedProfile.email || '');
        setUsername(updatedProfile.username || '');
        setImageUrl(updatedProfile.image_url || ''); // This might be null if an image was just uploaded
        
        setSuccessMessage('Profile saved successfully!');
        setSelectedFile(null); // Clear selection
        setPreviewUrl(null); // Clear preview

        // Crucially, re-fetch the profile to get the latest state,
        // especially if the backend now has profile_picture_data that needs to be displayed.
        // The display logic might need adjustment if you serve the BYTEA data as base64 from the GET /api/profile endpoint.
        await fetchProfile(); 

      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!connected || !publicKey) {
    // Still show a loading or redirecting state, or return null if redirect is fast enough
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <p>Connecting to wallet or redirecting...</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>User Profile | Vibe Game A Day</title>
        <meta name="description" content="Manage your user profile." />
        <script src="https://cdn.tailwindcss.com" async></script>
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Fredoka:wght@400;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="fixed top-4 right-4 z-50 flex items-center space-x-4">
        {connected && publicKey && (
          <div 
            onClick={() => router.push('/profile')} 
            className="hover:text-pink-400 transition duration-150 flex items-center space-x-2 cursor-pointer text-white"
          >
            {(profile?.profilePictureBase64 || profile?.image_url) && (
              <img 
                src={profile.profilePictureBase64 || profile.image_url || ''}
                alt="My Profile" 
                className="w-8 h-8 rounded-full object-cover border-2 border-pink-400"
              />
            )}
            <span>Profile</span>
          </div>
        )}
        <WalletMultiButton />
      </div>

      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center pt-20 p-4">
        <div className="w-full max-w-2xl bg-gray-800 p-8 rounded-xl shadow-2xl">
          <button 
            onClick={() => router.back()}
            className="absolute top-4 left-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-150 ease-in-out text-sm"
          >
            &larr; Back
          </button>
          <h1 className="text-3xl font-bold mb-8 text-pink-400 text-center">Your Profile</h1>
          
          {(previewUrl || profile?.profilePictureBase64 || profile?.image_url) && (
            <div className="mb-6 flex justify-center">
              <img 
                src={previewUrl || profile?.profilePictureBase64 || profile?.image_url || ''} 
                alt="Profile" 
                className="w-32 h-32 rounded-full object-cover border-4 border-pink-400" 
              />
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm text-gray-400">Wallet Address:</p>
            <p className="text-lg font-mono break-all">{publicKey.toBase58()}</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-pink-300 mb-1">Username</label>
              <input 
                type="text" 
                id="username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_cool_username"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500" 
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_]+"
                title="Username can only contain letters, numbers, and underscores, and be 3-50 characters long."
              />
              <p className="mt-1 text-xs text-gray-400">Letters, numbers, and underscores only. 3-50 characters.</p>
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-pink-300 mb-1">Email Address</label>
              <input 
                type="email" 
                id="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500" 
              />
            </div>
            <div>
              <label htmlFor="profileImage" className="block text-sm font-medium text-pink-300 mb-1">Change Profile Picture</label>
              <input 
                type="file"
                id="profileImage"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
            <div>
              <label htmlFor="imageUrl" className="block text-sm font-medium text-pink-300 mb-1">Or enter Image URL</label>
              <input 
                type="url" 
                id="imageUrl" 
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/your-image.png"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-2 focus:ring-pink-500 focus:border-pink-500" 
              />
            </div>
            <div>
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3 px-4 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-md transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Save Profile'}
              </button>
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            {successMessage && <p className="text-green-400 text-sm text-center">{successMessage}</p>}
          </form>
        </div>
      </main>
    </>
  );
};

export default ProfilePage; 
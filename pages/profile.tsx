import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import WalletMultiButton from '../components/WalletMultiButton'; // Assuming path is correct

interface UserProfile {
  wallet_address: string;
  email?: string | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

const ProfilePage = () => {
  const router = useRouter();
  const { publicKey, connected } = useWallet();

  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setImageUrl(data.image_url || '');
      } else if (response.status === 404) {
        // Profile not found, initialize with empty fields for creation
        setProfile(null); // Or set a default structure with walletAddress
        setEmail('');
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
  }, [publicKey, fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toBase58(),
          email: email.trim() || null, // Send null if empty
          imageUrl: imageUrl.trim() || null, // Send null if empty
        }),
      });

      if (response.ok) {
        const updatedProfile: UserProfile = await response.json();
        setProfile(updatedProfile);
        setEmail(updatedProfile.email || '');
        setImageUrl(updatedProfile.image_url || '');
        setSuccessMessage('Profile saved successfully!');
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

      <div className="fixed top-4 right-4 z-50">
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
          
          {profile?.image_url && (
            <div className="mb-6 flex justify-center">
              <img src={profile.image_url} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-pink-400" />
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm text-gray-400">Wallet Address:</p>
            <p className="text-lg font-mono break-all">{publicKey.toBase58()}</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
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
              <label htmlFor="imageUrl" className="block text-sm font-medium text-pink-300 mb-1">Profile Image URL</label>
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
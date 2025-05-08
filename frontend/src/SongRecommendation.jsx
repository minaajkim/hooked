import React, { useState, useEffect } from 'react';
import { fetchRecommendations } from './spotifyService';

const SongRecommendation = () => {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiryTime = params.get('expiry_time');

    if (accessToken && refreshToken) {
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("expiry_time", expiryTime || (Date.now() + 3600 * 1000).toString());

      // Remove tokens from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setRecommendations([]);

    const trimmedSong = song.trim();
    const trimmedArtist = artist.trim();

    if (!trimmedSong || !trimmedArtist) {
      setError("Both song and artist are required.");
      setIsLoading(false);
      return;
    }

    try {
      const tracks = await fetchRecommendations(trimmedSong, trimmedArtist);
      if (!tracks || !tracks.length) {
        throw new Error('No recommendations found. Try different inputs.');
      }
      setRecommendations(tracks);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to get recommendations.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="recommendation-container">
      <form onSubmit={handleSubmit} className="recommendation-form">
        <input
          type="text"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          placeholder="Song Name"
          required
        />
        <input
          type="text"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder="Artist Name"
          required
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Get Recommendations'}
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {recommendations.length > 0 && (
        <div className="recommendations-list">
          <h3>Recommended Tracks:</h3>
          <ul>
            {recommendations.map((track) => (
              <li key={track.id} className="track-item">
                <div className="track-info">
                  <strong>{track.name}</strong> by {track.artists.map(a => a.name).join(', ')}
                </div>
                <div className="track-links">
                  <a href={track.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                    Open in Spotify
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SongRecommendation;

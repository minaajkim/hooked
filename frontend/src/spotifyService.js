import axios from 'axios';

const BACKEND_BASE_URL = 'http://localhost:8888'; 
const LS_KEYS = {
  access: "access_token",
  refresh: "refresh_token",
  expiry: "expiry_time"
};

export const isTokenExpired = () => {
  const expiryTime = localStorage.getItem(LS_KEYS.expiry);
  console.log('Token expiry time:', expiryTime);
  if (!expiryTime) return true; // No expiry time indicates invalid token
  
  const buffer = 60 * 1000; // 1 minute buffer
  return Date.now() > (Number(expiryTime) - buffer);
};

const refreshAccessToken = async () => {
  try {
    const refresh_token = localStorage.getItem(LS_KEYS.refresh);
    if (!refresh_token) {
      throw new Error("No refresh token available - please log in again");
    }

    const response = await axios.post(`${BACKEND_BASE_URL}/refresh-token`, {
      refresh_token
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });


    if (!response.data?.access_token) {
      throw new Error("Invalid token response from server");
    }

    const { access_token, expires_in = 3600 } = response.data;
    const newExpiry = Date.now() + (expires_in * 1000);
    
    localStorage.setItem(LS_KEYS.access, access_token);
    localStorage.setItem(LS_KEYS.expiry, newExpiry.toString());
    
    return access_token;
  } catch (error) {
    console.error("Token refresh error:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Clear invalid tokens
    localStorage.removeItem(LS_KEYS.access);
    localStorage.removeItem(LS_KEYS.refresh);
    localStorage.removeItem(LS_KEYS.expiry);
    
    throw new Error("Session expired - please log in again");
  }
};


// Enhanced recommendations fetcher
export const fetchRecommendations = async (song, artist) => {
  if (!song?.trim() || !artist?.trim()) {
    throw new Error('Both song and artist are required');
  }

  let token = localStorage.getItem(LS_KEYS.access);
  
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      if (!token || isTokenExpired()) {
        console.log("Token expired or missing, refreshing...");
        token = await refreshAccessToken();
      }

      try {
        const response = await axios.get(`${BACKEND_BASE_URL}/recommendations`, {
          params: { song, artist },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.notice) {
          console.log(response.data.notice);
        }
        return response.data.tracks;

      } catch (error) {
        console.error("Request failed:", error.response?.data || error.message);
        if (error.response?.data?.solution) {
          throw new Error(`${error.response.data.error}\n${error.response.data.solution}`);
        } 
        throw error;
      }

    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, error.message);

      if (error.response?.status === 403) {
        alert(`Market restriction: ${error.response.data.error}`);
      } else if (error.response?.status === 424) {
        alert(`${error.response.data.error}. ${error.response.data.solution}`);
      }

      if (error.response?.status === 401 && attempt < maxAttempts) {
        console.log("Session expired, retrying...");
        localStorage.removeItem("access_token");
        continue; // retry refresh and request
      }

      if (attempt >= maxAttempts) {
        if (error.response?.status === 401) {
          throw new Error("Session expired - please log in again");
        }
        throw new Error(
          error.response?.data?.error ||
          error.message ||
          "Failed to get recommendations"
        );
      }
    }
  }
};

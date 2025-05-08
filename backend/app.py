# Oct 7, 2024
from flask import Flask, request, jsonify, redirect, session
from dotenv import load_dotenv
import os
import urllib.parse
from flask_cors import CORS
import time
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app, origins=["http://localhost:5173"])

CLIENT_ID = os.getenv("SPOTIPY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIPY_CLIENT_SECRET")
REDIRECT_URI = os.getenv("REDIRECT_URI")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SCOPE = "user-read-private user-read-email user-top-read"

sp = Spotify(auth_manager=SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope=SCOPE
))

@app.route('/')
def home():
    try:
        return redirect(oauth.get_authorize_url())
    except Exception as e:
        logger.error(f"Authorization URL generation failed: {e}")
        return "Service unavailable", 503

@app.route('/callback')
def callback():
    if 'error' in request.args:
        error = request.args['error']
        logger.error(f"Spotify callback error: {error}")
        return f"Authorization failed: {error}", 400

    auth_code = request.args.get("code")
    if not auth_code:
        logger.error("No authorization code received")
        return "Authorization failed: No code received", 400

    try:
        token_info = oauth.get_access_token(auth_code)

        if not token_info:
            raise ValueError("Empty token response")

        session['tokens'] = {
            'access_token': token_info['access_token'],
            'refresh_token': token_info.get('refresh_token'),
            'expires_at': int(time.time()) + token_info['expires_in']
        }

        redirect_url = (
            f"{FRONTEND_URL}/?access_token={token_info['access_token']}"
            f"&refresh_token={token_info.get('refresh_token', '')}"
            f"&expiry_time={session['tokens']['expires_at']}"
        )
        return redirect(redirect_url)

    except Exception as e:
        logger.error(f"Callback processing failed: {e}")
        return f"Authorization failed: {e}", 400

@app.route('/refresh-token', methods=['POST'])
def refresh_token():
    refresh_token = request.json.get('refresh_token')
    if not refresh_token:
        return jsonify({"error": "Refresh token required"}), 400

    try:
        token_info = oauth.refresh_access_token(refresh_token)
        return jsonify({
            "access_token": token_info['access_token'],
            "expires_in": token_info['expires_in']
        })
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return jsonify({"error": str(e)}), 400

@app.route('/recommendations', methods=['GET'])
def get_recommendations():
    seed_genres = request.args.get('seed_genres', 'pop')  # Default to 'pop' if none specified
    seed_tracks = request.args.get('seed_tracks')
    limit = request.args.get('limit', 5) 
    market = request.args.get('market', 'US') 

    # Ensure seed_tracks is URL-decoded correctly (if it's encoded)
    decoded_seed_tracks = urllib.parse.unquote(seed_tracks)

    try:
        # Call the Spotify API to get recommendations
        recommendations = sp.recommendations(
            seed_genres=seed_genres.split(','),  # Split genres if provided as comma-separated
            seed_tracks=[decoded_seed_tracks], 
            limit=int(limit),
            market=market
        )

        return jsonify(recommendations)
    except spotipy.exceptions.SpotifyException as e:
        return jsonify({"error": str(e)}), 400
    
if __name__ == '__main__':
    app.run(port=8888)

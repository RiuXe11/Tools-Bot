const axios = require('axios');

class TwitchChecker {
    static async getAccessToken() {
        try {
            const response = await axios.post(
                'https://id.twitch.tv/oauth2/token',
                new URLSearchParams({
                    client_id: process.env.TWITCH_CLIENT_ID,
                    client_secret: process.env.TWITCH_CLIENT_SECRET,
                    grant_type: 'client_credentials'
                })
            );
            return response.data.access_token;
        } catch (error) {
            console.error('Erreur lors de l\'obtention du token Twitch:', error);
            throw new Error('Erreur d\'authentification Twitch');
        }
    }

    static async checkStream(channelUrl) {
        try {
            // Extrait le nom d'utilisateur de l'URL
            const username = channelUrl.split('/').pop().toLowerCase();
            if (!username) {
                throw new Error('URL Twitch invalide');
            }

            // Obtention du token
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                throw new Error('Token Twitch non obtenu');
            }

            // Configuration des headers
            const headers = {
                'Client-ID': process.env.TWITCH_CLIENT_ID,
                'Authorization': `Bearer ${accessToken}`
            };

            // Obtention de l'ID de l'utilisateur
            const userResponse = await axios.get(
                `https://api.twitch.tv/helix/users?login=${username}`,
                { headers }
            );

            if (!userResponse.data.data || userResponse.data.data.length === 0) {
                throw new Error(`Utilisateur Twitch "${username}" non trouvé`);
            }

            const userId = userResponse.data.data[0].id;

            // Vérification du stream avec retry
            let retryCount = 0;
            const maxRetries = 2;
            let streamData = null;

            while (retryCount <= maxRetries) {
                try {
                    const streamResponse = await axios.get(
                        `https://api.twitch.tv/helix/streams?user_id=${userId}`,
                        { headers }
                    );

                    if (streamResponse.data.data && streamResponse.data.data.length > 0) {
                        const stream = streamResponse.data.data[0];
                        
                        // Vérification supplémentaire que le stream est vraiment en cours
                        if (stream.type === 'live') {
                            const startTime = new Date(stream.started_at);
                            const currentTime = new Date();
                            const streamAge = currentTime - startTime;
                            
                            // Si le stream a commencé il y a moins de 10 minutes
                            if (streamAge <= 600000) {
                                streamData = {
                                    isLive: true,
                                    title: stream.title,
                                    game: stream.game_name,
                                    viewerCount: stream.viewer_count,
                                    thumbnail: stream.thumbnail_url
                                        .replace('{width}', '1280')
                                        .replace('{height}', '720'),
                                    startedAt: stream.started_at
                                };
                                break;
                            }
                        }
                    }
                    break;
                } catch (error) {
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            return streamData || { isLive: false };

        } catch (error) {
            console.error('Erreur lors de la vérification Twitch:', error);
            return {
                isLive: false,
                error: error.message
            };
        }
    }
}

module.exports = TwitchChecker;
const axios = require('axios');

class KickChecker {
    static async checkStream(channelUrl) {
        try {
            const username = channelUrl.split('/').pop();
            
            // Kick n'a pas d'API officielle, on utilise leur API publique
            const response = await axios.get(`https://kick.com/api/v1/channels/${username}`);
            
            if (!response.data) {
                throw new Error('Chaîne Kick non trouvée');
            }

            const isLive = response.data.livestream !== null;
            if (!isLive) {
                return { isLive: false };
            }

            return {
                isLive: true,
                title: response.data.livestream.session_title,
                game: response.data.livestream.categories?.[0]?.name || 'Non spécifié',
                thumbnail: response.data.livestream.thumbnail?.url,
                viewerCount: response.data.livestream.viewer_count,
                startedAt: response.data.livestream.started_at
            };
        } catch (error) {
            console.error('Erreur lors de la vérification Kick:', error);
            return {
                isLive: false,
                error: error.message
            };
        }
    }
}

module.exports = KickChecker;
const axios = require('axios');

class YouTubeChecker {
    static async checkStream(channelUrl) {
        try {
            const channelHandle = channelUrl.split('@').pop();
            
            // Obtenir l'ID de la chaîne
            const channelResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${channelHandle}&type=channel&key=${process.env.YOUTUBE_API_KEY}`
            );

            if (!channelResponse.data.items[0]) {
                throw new Error('Chaîne YouTube non trouvée');
            }

            const channelId = channelResponse.data.items[0].id.channelId;

            // Vérifier les lives
            const liveResponse = await axios.get(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${process.env.YOUTUBE_API_KEY}`
            );

            const isLive = liveResponse.data.items.length > 0;
            if (!isLive) {
                return { isLive: false };
            }

            const live = liveResponse.data.items[0];
            return {
                isLive: true,
                title: live.snippet.title,
                thumbnail: live.snippet.thumbnails.high.url,
                startedAt: live.snippet.publishedAt
            };
        } catch (error) {
            console.error('Erreur lors de la vérification YouTube:', error);
            return {
                isLive: false,
                error: error.message
            };
        }
    }
}

module.exports = YouTubeChecker;

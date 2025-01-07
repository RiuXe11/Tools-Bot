const axios = require('axios');

class TikTokChecker {
    static validateUsername(channelUrl) {
        if (!channelUrl || typeof channelUrl !== 'string') {
            throw new Error('L\'URL du canal TikTok est invalide ou manquante');
        }

        let username;
        try {
            const url = new URL(channelUrl);
            if (url.hostname === 'www.tiktok.com' || url.hostname === 'tiktok.com') {
                username = url.pathname.split('@')[1]?.split('/')[0];
            } else {
                username = channelUrl.split('@').pop().split('/')[0];
            }
        } catch {
            username = channelUrl.split('@').pop().split('/')[0];
        }

        username = username?.trim();
        
        if (!username || username.length < 2) {
            throw new Error('Nom d\'utilisateur TikTok invalide');
        }

        return username;
    }

    static generateRandomFingerprint() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    static getHeaders(username) {
        const fingerprint = this.generateRandomFingerprint();
        const msToken = Buffer.from(Math.random().toString()).toString('base64').substring(0, 128);
        
        return {
            'authority': 'www.tiktok.com',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'sec-ch-ua': '"Chromium";v="121", "Not A(Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'document',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-site': 'none',
            'sec-fetch-user': '?1',
            'upgrade-insecure-requests': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Cookie': `msToken=${msToken}; ttwid=${fingerprint}; tt_csrf_token=${fingerprint.slice(0, 16)}`
        };
    }

    static async checkStream(channelUrl) {
        try {
            const username = this.validateUsername(channelUrl);
            const headers = this.getHeaders(username);

            // Ajout d'un délai aléatoire
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

            // Première tentative : vérification de la page de profil
            const profileResponse = await axios.get(
                `https://www.tiktok.com/@${username}`,
                {
                    headers,
                    timeout: 5000,
                    maxRedirects: 5
                }
            );

            if (profileResponse.status !== 200) {
                throw new Error('Profil TikTok non trouvé');
            }

            // Recherche des indicateurs de live dans la réponse HTML
            const htmlContent = profileResponse.data;
            const isLiveIndicator = htmlContent.includes('LIVE') && 
                                  (htmlContent.includes('"room_id"') || 
                                   htmlContent.includes('"liveId"'));

            // Si aucun indicateur de live n'est trouvé, on vérifie la page /live
            if (!isLiveIndicator) {
                const livePageResponse = await axios.get(
                    `https://www.tiktok.com/@${username}/live`,
                    {
                        headers: {
                            ...headers,
                            'Referer': `https://www.tiktok.com/@${username}`
                        },
                        timeout: 5000,
                        validateStatus: status => status === 200 || status === 404
                    }
                );

                // Vérification du statut et du contenu de la page live
                if (livePageResponse.status === 404 || 
                    livePageResponse.data.includes('LIVE_NOTATION_ENDED') ||
                    livePageResponse.data.includes('Cette LIVE est terminée')) {
                    return {
                        isLive: false,
                        channelName: username,
                        error: null
                    };
                }
            }

            // Extraction du nom du canal depuis la page HTML
            let channelName = username;
            const nicknameMatch = htmlContent.match(/"nickname":"([^"]+)"/);
            if (nicknameMatch && nicknameMatch[1]) {
                channelName = nicknameMatch[1];
            }

            // Extraction du titre du live s'il est disponible
            let title = 'Live TikTok';
            const titleMatch = htmlContent.match(/"title":"([^"]+)"/);
            if (titleMatch && titleMatch[1]) {
                title = titleMatch[1];
            }

            return {
                isLive: true,
                channelName,
                title,
                error: null
            };

        } catch (error) {
            console.error('Erreur lors de la vérification TikTok:', error.message);
            return {
                isLive: false,
                error: `Impossible de vérifier le statut du live TikTok: ${error.message}`
            };
        }
    }
}

module.exports = TikTokChecker;
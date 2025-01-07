const TwitchChecker = require('./platformCheckers/twitch');
const YouTubeChecker = require('./platformCheckers/youtube');
const KickChecker = require('./platformCheckers/kick');
const TikTokChecker = require('./platformCheckers/tiktok');
const { EmbedBuilder } = require('discord.js');
const path = require('path');

class StreamChecker {
    static createLiveEmbed(streamer, streamData) {
        const embed = new EmbedBuilder()
            .setColor(this.getPlatformColor(streamer.platform))
            // Ajout d'un auteur avec l'icône de la plateforme
            .setAuthor({
                name: '🔴 Live',
                iconURL: this.getPlatformIcon(streamer.platform)
            })
            // Titre amélioré
            .setTitle(streamer.channelName)
            // Description avec le titre du stream et un lien
            .setDescription(`${streamData.title || 'Stream en cours'}\n\n[Regarder le live](${streamer.channelUrl})`)
            // Ajout d'un thumbnail si disponible, sinon une image par défaut
            .setThumbnail(streamData.thumbnail || this.getDefaultThumbnail(streamer.platform));

        // Champs d'informations
        const fields = [];

        // Jeu/Catégorie si disponible
        if (streamData.game) {
            fields.push({ name: '🎮 Catégorie', value: streamData.game, inline: true });
        }

        // Nombre de spectateurs si disponible
        if (streamData.viewerCount !== undefined) {
            fields.push({ 
                name: '👥 Viewers', 
                value: streamData.viewerCount.toString(), 
                inline: true 
            });
        }

        // Durée du stream
        if (streamData.startedAt) {
            const startTime = new Date(streamData.startedAt);
            fields.push({ 
                name: '⏰ En live depuis', 
                value: `<t:${Math.floor(startTime.getTime() / 1000)}:R>`, 
                inline: true 
            });
        }

        // Plateforme
        fields.push({ 
            name: '📱 Plateforme', 
            value: this.getPlatformEmoji(streamer.platform) + ' ' + streamer.platform, 
            inline: true 
        });

        // Ajouter les champs à l'embed
        embed.addFields(fields);

        // Ajouter l'image principale si disponible
        if (streamData.thumbnail) {
            embed.setImage(streamData.thumbnail);
        }

        // Footer avec timestamp
        embed.setFooter({ 
            text: 'Stream détecté', 
            iconURL: this.getPlatformIcon(streamer.platform) 
        })
        .setTimestamp();

        return embed;
    }

    static getPlatformIcon(platform) {
        switch (platform.toLowerCase()) {
            case 'twitch':
                return 'https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-shapes-2-free/128/social-twitch-circle-512.png';
            case 'youtube':
                return 'https://cdn4.iconfinder.com/data/icons/social-messaging-ui-color-shapes-2-free/128/social-youtube-circle-512.png';
            case 'kick':
                return 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0b544a205c523738d0de_full_logo_white_green_bg.png';
            case 'tiktok':
                return 'https://cdn4.iconfinder.com/data/icons/social-media-flat-7/64/Social-media_Tiktok-512.png';
            default:
                return null;
        }
    }

    static getPlatformEmoji(platform) {
        switch (platform.toLowerCase()) {
            case 'twitch':
                return '💜';
            case 'youtube':
                return '❤️';
            case 'kick':
                return '💚';
            case 'tiktok':
                return '🖤';
            default:
                return '🎮';
        }
    }

    static getDefaultThumbnail(platform) {
        switch (platform.toLowerCase()) {
            case 'twitch':
                return 'https://cdn3.iconfinder.com/data/icons/social-messaging-ui-color-shapes-2-free/128/social-twitch-circle-512.png';
            case 'youtube':
                return 'https://cdn4.iconfinder.com/data/icons/social-messaging-ui-color-shapes-2-free/128/social-youtube-circle-512.png';
            case 'kick':
                return 'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0b544a205c523738d0de_full_logo_white_green_bg.png';
            case 'tiktok':
                return 'https://cdn4.iconfinder.com/data/icons/social-media-flat-7/64/Social-media_Tiktok-512.png';
            default:
                return null;
        }
    }

    static getPlatformColor(platform) {
        switch (platform.toLowerCase()) {
            case 'twitch':
                return '#9146FF';
            case 'youtube':
                return '#FF0000';
            case 'kick':
                return '#53FC18';
            case 'tiktok':
                return '#000000';
            default:
                return '#7289DA';
        }
    }

    // Méthode principale de vérification des streams
    static async checkAllStreams(client) {
        try {
            const StreamManager = require('./streamManager');
            const streamers = await StreamManager.getStreamers();
            
            for (const [userId, streamer] of Object.entries(streamers)) {
                try {
                    console.log(`Vérification du streamer: ${streamer.channelName}`);
                    let streamData = null;
                    
                    // Vérification selon la plateforme avec délai entre chaque vérification
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    switch (streamer.platform.toLowerCase()) {
                        case 'twitch':
                            streamData = await TwitchChecker.checkStream(streamer.channelUrl);
                            break;
                        case 'youtube':
                            streamData = await YouTubeChecker.checkStream(streamer.channelUrl);
                            break;
                        case 'kick':
                            streamData = await KickChecker.checkStream(streamer.channelUrl);
                            break;
                        case 'tiktok':
                            streamData = await TikTokChecker.checkStream(streamer.channelUrl);
                            break;
                        default:
                            console.warn(`Plateforme non supportée: ${streamer.platform}`);
                            continue;
                    }
    
                    if (!streamData) {
                        console.log(`Pas de données pour ${streamer.channelName}`);
                        continue;
                    }
    
                    // Vérification du statut de live
                    const isCurrentlyLive = streamData.isLive === true;
                    console.log(`Statut de ${streamer.channelName}: ${isCurrentlyLive ? 'En live' : 'Hors ligne'}`);
    
                    // Gestion du changement d'état
                    if (isCurrentlyLive && !streamer.isCurrentlyLive) {
                        console.log(`${streamer.channelName} vient de démarrer un stream`);
                        
                        // Mise à jour du statut
                        streamer.isCurrentlyLive = true;
                        streamer.lastStreamStart = new Date().toISOString();
                        await StreamManager.saveStreamer(userId, streamer);
    
                        // Envoi des notifications
                        const embed = this.createLiveEmbed(streamer, streamData);
                        const customMessage = streamer.message || `${streamer.channelName} est en live !`;
    
                        for (const guild of client.guilds.cache.values()) {
                            try {
                                const notifications = await StreamManager.getGuildNotifications(guild.id);
                                if (notifications?.[userId]) {
                                    const channel = guild.channels.cache.get(notifications[userId].channelId);
                                    if (channel) {
                                        await channel.send({
                                            content: customMessage,
                                            embeds: [embed]
                                        });
                                        console.log(`Notification envoyée dans ${guild.name}`);
                                    }
                                }
                            } catch (error) {
                                console.error(`Erreur de notification pour ${guild.id}:`, error);
                            }
                        }
                    } else if (!isCurrentlyLive && streamer.isCurrentlyLive) {
                        console.log(`${streamer.channelName} a terminé son stream`);
                        streamer.isCurrentlyLive = false;
                        streamer.lastStreamEnd = new Date().toISOString();
                        await StreamManager.saveStreamer(userId, streamer);
                    }
                } catch (error) {
                    console.error(`Erreur pour ${streamer.channelName}:`, error);
                }
            }
        } catch (error) {
            console.error('Erreur globale dans checkAllStreams:', error);
        }
    }
}

module.exports = StreamChecker;
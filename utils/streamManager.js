// utils/streamManager.js
const fs = require('fs').promises;
const path = require('path');

const STREAMERS_FILE = path.join(__dirname, '..', 'data', 'streamers', 'streamers.json');

class StreamManager {
    static async ensureFileExists() {
        try {
            await fs.access(STREAMERS_FILE);
        } catch (error) {
            // Assurez-vous que le dossier existe
            await fs.mkdir(path.dirname(STREAMERS_FILE), { recursive: true });
            // Créer le fichier avec un objet vide
            await fs.writeFile(STREAMERS_FILE, JSON.stringify({}, null, 2));
        }
    }

    static async getStreamers() {
        await this.ensureFileExists();
        try {
            const data = await fs.readFile(STREAMERS_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Erreur lors de la lecture des streamers:', error);
            return {};
        }
    }

    static async saveStreamer(userId, streamerData) {
        await this.ensureFileExists();
        try {
            const streamers = await this.getStreamers();
            streamers[userId] = streamerData;
            await fs.writeFile(STREAMERS_FILE, JSON.stringify(streamers, null, 2));
            return true;
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du streamer:', error);
            return false;
        }
    }

    static async getStreamer(userId) {
        const streamers = await this.getStreamers();
        return streamers[userId];
    }

    static async getStreamerByName(channelName) {
        const streamers = await this.getStreamers();
        return Object.values(streamers).find(s => s.channelName === channelName);
    }

    static async updateStreamerPlatform(userId, platform) {
        const streamer = await this.getStreamer(userId);
        if (streamer) {
            streamer.platform = platform;
            return this.saveStreamer(userId, streamer);
        }
        return false;
    }

    static async updateStreamerMessage(userId, message) {
        const streamer = await this.getStreamer(userId);
        if (streamer) {
            streamer.message = message;
            return this.saveStreamer(userId, streamer);
        }
        return false;
    }

    static async deleteStreamer(userId) {
        try {
            console.log(`Tentative de suppression du streamer avec l'ID: ${userId}`);
            const streamers = await this.getStreamers();
            
            if (!streamers[userId]) {
                console.log(`Aucun streamer trouvé avec l'ID: ${userId}`);
                return false;
            }
            
            const streamerInfo = streamers[userId];
            console.log(`Suppression du streamer: ${streamerInfo.channelName}`);
            
            delete streamers[userId];
            
            const streamersFile = path.join(__dirname, '..', 'data', 'streamers', 'streamers.json');
            await fs.writeFile(streamersFile, JSON.stringify(streamers, null, 2));
            
            console.log('Streamer supprimé avec succès');
            return true;
        } catch (error) {
            console.error('Erreur lors de la suppression du streamer:', error);
            return false;
        }
    }

    static async getGuildNotifications(guildId) {
        try {
            const notificationsFile = path.join(__dirname, '..', 'data', 'notifications', `${guildId}.json`);
            const data = await fs.readFile(notificationsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    static async setGuildNotification(guildId, userId, channelId) {
        try {
            const notificationsDir = path.join(__dirname, '..', 'data', 'notifications');
            const notificationsFile = path.join(notificationsDir, `${guildId}.json`);
            
            // Créer le dossier s'il n'existe pas
            await fs.mkdir(notificationsDir, { recursive: true });
            
            // Lire les notifications existantes ou créer un objet vide
            let notifications = {};
            try {
                const data = await fs.readFile(notificationsFile, 'utf8');
                notifications = JSON.parse(data);
            } catch (error) {
                // Le fichier n'existe pas encore, on utilise l'objet vide par défaut
            }
            
            // Ajouter ou mettre à jour la notification
            notifications[userId] = { channelId };
            
            // Sauvegarder les modifications
            await fs.writeFile(notificationsFile, JSON.stringify(notifications, null, 2));
            return true;
        } catch (error) {
            console.error('Erreur lors de la configuration des notifications:', error);
            return false;
        }
    }

    static async getGuildNotifications(guildId) {
        try {
            const notificationsFile = path.join(__dirname, '..', 'data', 'notifications', `${guildId}.json`);
            const data = await fs.readFile(notificationsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    static async logStreamers() {
        try {
            const streamers = await this.getStreamers();
            console.log('Contenu actuel de streamers.json:', JSON.stringify(streamers, null, 2));
            return streamers;
        } catch (error) {
            console.error('Erreur lors de la lecture des streamers:', error);
            return {};
        }
    }
}

// Exporter à la fois la classe et ses méthodes individuellement
module.exports = {
    StreamManager,
    getStreamers: StreamManager.getStreamers.bind(StreamManager),
    saveStreamer: StreamManager.saveStreamer.bind(StreamManager),
    getStreamer: StreamManager.getStreamer.bind(StreamManager),
    getStreamerByName: StreamManager.getStreamerByName.bind(StreamManager),
    updateStreamerPlatform: StreamManager.updateStreamerPlatform.bind(StreamManager),
    updateStreamerMessage: StreamManager.updateStreamerMessage.bind(StreamManager),
    deleteStreamer: StreamManager.deleteStreamer.bind(StreamManager),
    getGuildNotifications: StreamManager.getGuildNotifications.bind(StreamManager),
    setGuildNotification: StreamManager.setGuildNotification.bind(StreamManager)
};
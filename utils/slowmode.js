// utils/slowmode.js
const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder } = require('discord.js');

class SlowModeManager {
    constructor() {
        this.cooldowns = new Map();
        this.settings = new Map();
        this.dataPath = path.join(__dirname, '../data/slowmode.json');
        this.userDataPath = path.join(__dirname, '../data/user-slowmode.json');
        this.lastSave = Date.now();
        this.saveInterval = 600000; // 10 minutes
        
        // Démarrer la sauvegarde automatique
        setInterval(() => this.saveAllData(), this.saveInterval);
    }

    getChannelKey(channelId) {
        return `channel-${channelId}`;
    }

    getUserChannelKey(userId, channelId) {
        return `${userId}-${channelId}`;
    }

    setSlowMode(channelId, duration) {
        const channelKey = this.getChannelKey(channelId);
        this.settings.set(channelKey, duration);
        this.saveAllData();
    }

    removeSlowMode(channelId) {
        const channelKey = this.getChannelKey(channelId);
        this.settings.delete(channelKey);
        
        // Supprimer tous les cooldowns associés à ce canal
        for (const [key] of this.cooldowns.entries()) {
            if (key.includes(channelId)) {
                this.cooldowns.delete(key);
            }
        }
        
        this.saveAllData();
    }

    getSlowMode(channelId) {
        const channelKey = this.getChannelKey(channelId);
        return this.settings.get(channelKey);
    }

    async loadData() {
        try {
            // Charger les paramètres de slowmode
            const settingsData = await fs.readFile(this.dataPath, 'utf8');
            const parsed = JSON.parse(settingsData);
            
            this.settings = new Map();
            for (const [key, value] of Object.entries(parsed.settings || {})) {
                this.settings.set(key, value);
            }

            // Charger les données utilisateur
            const userData = await fs.readFile(this.userDataPath, 'utf8');
            const userParsed = JSON.parse(userData);
            
            // Restaurer les cooldowns avec toutes les informations
            const now = Date.now();
            this.cooldowns = new Map();
            
            for (const [key, data] of Object.entries(userParsed || {})) {
                const [userId, channelId] = key.split('-');
                const duration = this.getSlowMode(channelId);
                
                // Vérifier si le cooldown est encore valide
                if (duration && (now - data.timestamp) < duration) {
                    this.cooldowns.set(key, {
                        timestamp: data.timestamp,
                        userId: data.userId,
                        channelId: data.channelId,
                        username: data.username,
                        channelName: data.channelName,
                        duration: duration,
                        expiresAt: data.timestamp + duration
                    });
                }
            }
            
            console.log('✅ Données de slowmode chargées avec succès');
            console.log(`📊 Paramètres chargés: ${this.settings.size} salons`);
            console.log(`👥 Cooldowns actifs: ${this.cooldowns.size} utilisateurs`);
        } catch (error) {
            console.log('⚠️ Aucune donnée de slowmode existante, création des fichiers');
            await this.saveAllData();
        }
    }

    async saveAllData() {
        await Promise.all([
            this.saveSettings(),
            this.saveUserData()
        ]);
    }

    async saveSettings() {
        try {
            const data = {
                settings: Object.fromEntries(this.settings)
            };
            
            const dir = path.dirname(this.dataPath);
            await fs.mkdir(dir, { recursive: true });
            
            const tempPath = `${this.dataPath}.temp`;
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
            await fs.rename(tempPath, this.dataPath);
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde des paramètres:', error);
        }
    }

    async saveUserData() {
        try {
            const userData = {};
            
            for (const [key, data] of this.cooldowns.entries()) {
                userData[key] = {
                    userId: data.userId,
                    channelId: data.channelId,
                    username: data.username,
                    channelName: data.channelName,
                    timestamp: data.timestamp,
                    duration: data.duration,
                    expiresAt: data.expiresAt
                };
            }
            
            const dir = path.dirname(this.userDataPath);
            await fs.mkdir(dir, { recursive: true });
            
            const tempPath = `${this.userDataPath}.temp`;
            await fs.writeFile(tempPath, JSON.stringify(userData, null, 2));
            await fs.rename(tempPath, this.userDataPath);
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde des données utilisateur:', error);
        }
    }

    async checkUserCooldown(message) {
        const { author, channel } = message;
        const duration = this.getSlowMode(channel.id);
        
        if (!duration) return { canSend: true };
        
        const userKey = this.getUserChannelKey(author.id, channel.id);
        const userData = this.cooldowns.get(userKey);
        
        const now = Date.now();
        
        if (!userData) {
            // Premier message : enregistrer toutes les informations
            this.cooldowns.set(userKey, {
                userId: author.id,
                channelId: channel.id,
                username: author.username,
                channelName: channel.name,
                timestamp: now,
                duration: duration,
                expiresAt: now + duration
            });
            await this.saveUserData();
            return { canSend: true };
        }

        const timeLeft = userData.expiresAt - now;

        if (timeLeft <= 0) {
            // Mettre à jour le cooldown
            userData.timestamp = now;
            userData.expiresAt = now + duration;
            await this.saveUserData();
            return { canSend: true };
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('⏰ Slowmode actif')
                .setDescription(`Vous devez attendre avant de pouvoir envoyer un nouveau message dans #${channel.name}.`)
                .addFields(
                    { name: '⏳ Temps restant', value: `\`${this.formatTimeLeft(timeLeft)}\`` },
                    { name: '✍️ Salon', value: `\`#${channel.name}\`` },
                    { name: '🔓 Expire le', value: `\`${new Date(userData.expiresAt).toLocaleString()}\`` }
                )
                .setTimestamp();

            await author.send({ embeds: [embed] });
        } catch (error) {
            console.log('⚠️ Impossible d\'envoyer un MP à l\'utilisateur');
        }

        return { 
            canSend: false, 
            timeLeft: this.formatTimeLeft(timeLeft)
        };
    }

    cleanExpiredCooldowns() {
        const now = Date.now();
        for (const [key, data] of this.cooldowns.entries()) {
            if (now >= data.expiresAt) {
                this.cooldowns.delete(key);
            }
        }
    }

    formatTimeLeft(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        let parts = [];

        if (days > 0) {
            parts.push(`${days} jour${days > 1 ? 's' : ''}`);
        }
        if (hours % 24 > 0) {
            parts.push(`${hours % 24} heure${hours % 24 > 1 ? 's' : ''}`);
        }
        if (minutes % 60 > 0) {
            parts.push(`${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''}`);
        }
        if (seconds % 60 > 0 && days === 0) {
            parts.push(`${seconds % 60} seconde${seconds % 60 > 1 ? 's' : ''}`);
        }

        return parts.join(', ');
    }

    parseDuration(durationStr) {
        const units = {
            s: 1000,
            m: 60000,
            h: 3600000,
            d: 86400000,
            w: 604800000
        };

        const matches = durationStr.match(/^(\d+)([smhdw])$/);
        if (!matches) {
            throw new Error('Format de durée invalide. Utilisez un nombre suivi de s/m/h/d/w (ex: 30s, 5m, 2h, 1d, 1w)');
        }

        const [, amount, unit] = matches;
        return parseInt(amount) * units[unit];
    }
}

module.exports = new SlowModeManager();
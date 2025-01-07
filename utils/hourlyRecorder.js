const { getFivemServerInfo, getServerAddress } = require('./fivem');
const fs = require('fs').promises;
const path = require('path');
const fivemCache = require('./fivemCache');
const statusVariables = require('./statusVariables');

class HourlyRecorder {
    constructor() {
        this.interval = null;
        this.currentHourStats = new Map(); // Pour stocker les stats de l'heure en cours
    }

    async start() {
        await fivemCache.loadCache();
        await this.initializeCurrentHour(); // Initialiser le bloc de l'heure actuelle

        // Configurer l'intervalle pour le changement d'heure
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const delay = nextHour - now;

        // Planifier les changements d'heure
        this.interval = setInterval(() => this.handleHourChange(), 60 * 60 * 1000);
        setTimeout(() => this.handleHourChange(), delay);

        // Écouter les mises à jour fréquentes de statusVariables
        statusVariables.onUpdate((variables) => {
            this.checkForNewRecord();
        });

        console.log(`✓ Enregistrement horaire démarré. Prochain changement dans ${Math.round(delay/1000/60)} minutes`);
    }

    async initializeCurrentHour() {
        const serversPath = path.join(process.cwd(), 'data', 'servers.json');

        try {
            const servers = JSON.parse(await fs.readFile(serversPath, 'utf8'));

            for (const [guildId, serverAddress] of Object.entries(servers)) {
                try {
                    // S'assurer que l'adresse est dans le bon format
                    const validatedAddress = typeof serverAddress === 'string' ? 
                        await fivem.validateAndFormatAddress(serverAddress) : 
                        serverAddress;

                    const serverInfo = await getFivemServerInfo(validatedAddress);
                    const now = new Date();
                    const currentHourId = this.generateHourId(now);

                    const statsObj = {
                        id: currentHourId,
                        timestamp: new Date(now).setMinutes(0, 0, 0),
                        players: serverInfo.players,
                        maxPlayers: serverInfo.maxPlayers,
                        hostname: serverInfo.hostname,
                        gametype: serverInfo.gametype,
                        mapname: serverInfo.mapname,
                        status: serverInfo.status
                    };

                    this.currentHourStats.set(guildId, statsObj);
                    await this.updateStatsFile(guildId, statsObj);
                } catch (error) {
                    console.error(`Erreur lors de l'initialisation des stats pour ${guildId}:`, error);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier servers.json:', error);
        }
    }

    generateHourId(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
    }

    async checkForNewRecord() {
        const serversPath = path.join(process.cwd(), 'data', 'servers.json');

        try {
            const servers = JSON.parse(await fs.readFile(serversPath, 'utf8'));

            for (const [guildId, serverAddress] of Object.entries(servers)) {
                try {
                    const validatedAddress = typeof serverAddress === 'string' ? 
                        await fivem.validateAndFormatAddress(serverAddress) : 
                        serverAddress;

                    const currentStats = this.currentHourStats.get(guildId);
                    const currentInfo = await getFivemServerInfo(validatedAddress);

                    if (currentStats && currentInfo && currentInfo.players > currentStats.players) {
                        const updatedStats = {
                            ...currentStats,
                            players: currentInfo.players,
                            maxPlayers: currentInfo.maxPlayers,
                            hostname: currentInfo.hostname,
                            status: currentInfo.status,
                            gametype: currentInfo.gametype,
                            mapname: currentInfo.mapname
                        };

                        this.currentHourStats.set(guildId, updatedStats);
                        await this.updateStatsFile(guildId, updatedStats);
                        console.log(`[${guildId}] Nouveau record pour l'heure en cours: ${currentInfo.players} joueurs`);
                    }
                } catch (error) {
                    console.error(`Erreur lors de la vérification pour ${guildId}:`, error);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la lecture du fichier servers.json:', error);
        }
    }

    async handleHourChange() {
        // Sauvegarder une dernière fois les stats de l'heure qui se termine
        await this.checkForNewRecord();

        // Réinitialiser pour la nouvelle heure
        await this.initializeCurrentHour();
    }

    async updateStatsFile(guildId, newStats) {
        const statsPath = path.join(process.cwd(), 'data', 'serverstats.json');
        let allStats = {};

        try {
            const statsData = await fs.readFile(statsPath, 'utf8');
            allStats = JSON.parse(statsData);
        } catch (error) {
            console.error('Erreur lecture stats:', error);
        }

        if (!allStats[guildId]) {
            allStats[guildId] = [];
        }

        // Rechercher et mettre à jour ou ajouter le bloc horaire
        const existingIndex = allStats[guildId].findIndex(stat => stat.id === newStats.id);
        if (existingIndex !== -1) {
            allStats[guildId][existingIndex] = newStats;
        } else {
            allStats[guildId].push(newStats);
        }

        await fs.writeFile(statsPath, JSON.stringify(allStats, null, 2));
        fivemCache.updateCache(guildId, newStats);
    }

    async stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async getAvailableDates(guildId) {
        const statsPath = path.join(process.cwd(), 'data', 'serverstats.json');
        try {
            const data = await fs.readFile(statsPath, 'utf8');
            const allStats = JSON.parse(data);
            const guildStats = allStats[guildId] || [];
    
            const uniqueDates = new Set(guildStats.map(stat => 
                new Date(stat.timestamp).toDateString()
            ));
    
            return Array.from(uniqueDates)
                .map(dateStr => new Date(dateStr))
                .sort((a, b) => b - a);
        } catch (error) {
            console.error('Erreur lecture dates disponibles:', error);
            return [];
        }
    }
}

module.exports = new HourlyRecorder();
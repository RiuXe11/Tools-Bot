// serverMonitor.js
const { getFivemServerInfo, getServerAddress } = require('./fivem');
const playerTracker = require('./playerTracker');

class ServerMonitor {
    constructor() {
        this.monitorInterval = null;
        this.checkInterval = 60000; // Vérifier toutes les 60 secondes
    }

    async checkServers(client) {
        try {
            // Récupérer tous les serveurs configurés
            const guilds = client.guilds.cache;
            
            for (const [guildId, guild] of guilds) {
                const serverAddress = await getServerAddress(guildId);
                if (!serverAddress) continue;

                // Récupérer les informations du serveur, y compris les joueurs
                const serverInfo = await getFivemServerInfo(serverAddress);
                
                // Si le serveur est en ligne et a des joueurs
                if (serverInfo.status && serverInfo.realPlayers > 0) {
                    // Préparer les données des joueurs pour le tracker
                    if (serverInfo.playerList) {
                        await playerTracker.updatePlayers(guildId, serverInfo.playerList);
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification des serveurs:', error);
        }
    }

    start(client) {
        // Vérifier immédiatement au démarrage
        this.checkServers(client);

        // Mettre en place la vérification périodique
        this.monitorInterval = setInterval(() => {
            this.checkServers(client);
        }, this.checkInterval);
        
        console.log('Moniteur de serveur démarré');
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('Moniteur de serveur arrêté');
        }
    }
}

module.exports = new ServerMonitor();
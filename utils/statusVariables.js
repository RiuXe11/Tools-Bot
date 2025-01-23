const fivem = require('../commands/fivem/fivem');

class StatusVariables {
    constructor() {
        this.variables = {
            FivemMembersCount: 0,
            FivemMaxMembers: 0,
            FivemHostName: 'Non disponible',
            FivemGameType: 'Non disponible',
            FivemMapName: 'Non disponible',
            FivemStatus: 'Hors ligne'
        };
        this.updateCallbacks = [];
        this.serverAddress = null;
        this.lastPlayerCount = 0;
        this.lastUpdateTime = 0;
        this.retryAfter = 0;
        this.isUpdating = false;
        this.updateTimer = null;
    }

    async initializeWithAddress(address) {
        this.serverAddress = address;
        await this.updateVariables(address);
        this.startAutoUpdate();
    }

    shouldWait() {
        const now = Date.now();
        return now < this.retryAfter;
    }

    async updateVariables(address) {
        if (!address || this.isUpdating || this.shouldWait()) return;
        
        try {
            this.isUpdating = true;
            const info = await fivem.getFivemServerInfo(address);
            this.lastUpdateTime = Date.now();

            if (info && typeof info.players === 'number') {
                const oldVariables = { ...this.variables };

                this.variables = {
                    FivemMembersCount: info.players,
                    FivemMaxMembers: info.maxPlayers,
                    FivemHostName: info.hostname,
                    FivemGameType: info.gametype,
                    FivemMapName: info.mapname,
                    FivemStatus: info.status ? 'En ligne' : 'Hors ligne'
                };

                if (this.lastPlayerCount !== info.players) {
                    this.lastPlayerCount = info.players;
                    this.notifyCallbacks();
                    console.log(`Mise à jour du nombre de joueurs: ${info.players}`);
                }
            }
        } catch (error) {
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                if (retryAfter) {
                    const waitSeconds = parseInt(retryAfter, 10);
                    this.retryAfter = Date.now() + (waitSeconds * 1000);
                    console.log(`Limite de requêtes atteinte. Attente de ${waitSeconds} secondes.`);
                    this.scheduleNextUpdate(waitSeconds * 1000);
                }
            } else {
                console.error('Erreur lors de la mise à jour des variables:', error);
            }
        } finally {
            this.isUpdating = false;
        }
    }

    scheduleNextUpdate(delay) {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
        }
        this.updateTimer = setTimeout(() => {
            if (this.serverAddress) {
                this.updateVariables(this.serverAddress);
            }
        }, delay);
    }

    replaceVariables(text) {
        let result = text;
        for (const [key, value] of Object.entries(this.variables)) {
            result = result.replace(`{${key}}`, value);
        }
        return result;
    }

    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    notifyCallbacks() {
        for (const callback of this.updateCallbacks) {
            callback(this.variables);
        }
    }

    startAutoUpdate() {
        // Première mise à jour après un court délai
        setTimeout(async () => {
            if (this.serverAddress) {
                await this.updateVariables(this.serverAddress);
            }
        }, 1000);

        // Mise en place d'un interval pour les mises à jour régulières
        setInterval(async () => {
            if (this.serverAddress && !this.shouldWait()) {
                await this.updateVariables(this.serverAddress);
            }
        }, 10000); // Vérification toutes les 10 secondes
    }
}

module.exports = new StatusVariables();
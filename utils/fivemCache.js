const path = require('path');
const fs = require('fs').promises;

class FivemCache {
    constructor() {
        this.cachePath = path.join(process.cwd(), 'data', 'fivemCache.json');
        this.cache = new Map();
    }

    async loadCache() {
        try {
            const data = await fs.readFile(this.cachePath, 'utf8');
            const cache = JSON.parse(data);
            Object.entries(cache).forEach(([key, value]) => {
                this.cache.set(key, value);
            });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Erreur lors du chargement du cache:', error);
            }
        }
    }

    async saveCache() {
        try {
            const cache = Object.fromEntries(this.cache);
            await fs.writeFile(this.cachePath, JSON.stringify(cache, null, 2));
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du cache:', error);
        }
    }

    getCachedData(guildId) {
        return this.cache.get(guildId) || null;
    }

    updateCache(guildId, data) {
        this.cache.set(guildId, data);
        this.saveCache();
    }
}

module.exports = new FivemCache();
// utils/statusManager.js
const { ActivityType } = require('discord.js');
const statusVariables = require('./statusVariables');
const fs = require('fs').promises;
const path = require('path');

class StatusManager {
    async loadStatus() {
        try {
            const statusPath = path.join(process.cwd(), 'data', 'status.json');
            const data = await fs.readFile(statusPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    mapActivityType(type) {
        const activityTypes = {
            'PLAYING': ActivityType.Playing,
            'WATCHING': ActivityType.Watching,
            'LISTENING': ActivityType.Listening,
            'COMPETING': ActivityType.Competing
        };
        return activityTypes[type] || ActivityType.Playing;
    }

    async setStatus(client) {
        try {
            const status = await this.loadStatus();
            if (status && status.type && status.activity) {
                const replacedActivity = statusVariables.replaceVariables(status.activity);
                await client.user.setActivity(replacedActivity, { type: this.mapActivityType(status.type) });
                
                statusVariables.onUpdate(async () => {
                    const replacedActivity = statusVariables.replaceVariables(status.activity);
                    await client.user.setActivity(replacedActivity, { type: this.mapActivityType(status.type) });
                });
                return true;
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du statut:', error);
        }
        return false;
    }
}

module.exports = new StatusManager();
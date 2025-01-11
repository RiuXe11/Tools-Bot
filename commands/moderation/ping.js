const { EmbedBuilder } = require('discord.js');
const os = require('os');

module.exports = {
    name: 'ping',
    description: 'Affiche les statistiques de latence et du serveur.',

    async execute(message) {
        // Mesure du temps de réponse initial
        const startTime = Date.now();
        const reply = await message.reply('Calcul des statistiques en cours...');
        const endTime = Date.now();

        // Calcul des latences
        const botLatency = endTime - startTime;
        const apiLatency = message.client.ws.ping;

        // Informations système
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeString = `${days}j ${hours}h ${minutes}m ${seconds}s`;

        // Utilisation mémoire
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
        const memoryTotal = os.totalmem() / 1024 / 1024;
        const memoryPercent = ((memoryUsed / memoryTotal) * 100).toFixed(2);

        // Création des barres de progression
        const createProgressBar = (value) => {
            const position = Math.round((value / 100) * 10);
            const bar = '█'.repeat(position) + '░'.repeat(10 - position);
            return bar;
        };

        // Statut de la latence
        const getPingStatus = (ping) => {
            if (ping < 100) return "🟢 Excellente";
            if (ping < 200) return "🟡 Bonne";
            if (ping < 400) return "🟠 Moyenne";
            return "🔴 Élevée";
        };

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('📊 Statistiques du Serveur')
            .setDescription('*Informations détaillées sur les performances du bot et du serveur*')
            .addFields(
                {
                    name: '🤖 Latences',
                    value: [
                        `**Bot:** ${botLatency}ms (${getPingStatus(botLatency)})`,
                        `**API Discord:** ${apiLatency}ms (${getPingStatus(apiLatency)})`,
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '💾 Utilisation Mémoire',
                    value: [
                        `**Utilisée:** ${memoryUsed.toFixed(2)} MB`,
                        `**Total:** ${(memoryTotal/1024).toFixed(2)} GB`,
                        `**Pourcentage:** ${createProgressBar(memoryPercent)} ${memoryPercent}%`
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '⚙️ Système',
                    value: [
                        `**OS:** ${os.platform()} ${os.release()}`,
                        `**Uptime:** ${uptimeString}`,
                        `**Node.js:** ${process.version}`
                    ].join('\n'),
                    inline: false
                }
            )
            .setFooter({ 
                text: `Requête effectuée par ${message.author.tag}`, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setTimestamp();

        // Mise à jour du message
        await reply.edit({ content: '', embeds: [embed] });
    },
};
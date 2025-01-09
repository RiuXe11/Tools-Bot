const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ping',
    description: 'Affiche le temps de réponse du bot.',

    async execute(interaction) {
        // Temps de réponse initial (avant envoi du message)
        const initialTime = Date.now();

        // Temps après avoir envoyé la réponse
        const latency = Date.now() - initialTime;
        const apiLatency = interaction.client.ws.ping;

        // Création de l'embed
        const embed = new EmbedBuilder()
            .setColor('Random') // Couleur aléatoire
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Latence du bot', value: `${latency}ms`, inline: true },
                { name: 'Latence de l\'API', value: `${apiLatency}ms`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: interaction.client.user.username, iconURL: interaction.client.user.displayAvatarURL() });

        // Édition de la réponse avec l'embed
        await interaction.reply({ content: '', embeds: [embed] });
    },
};

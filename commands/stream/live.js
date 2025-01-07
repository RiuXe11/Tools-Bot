const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require('discord.js');
const StreamManager = require('../../utils/streamManager');

module.exports = {
    name: 'live',
    description: 'Configure les paramètres de stream',
    async execute(message) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('Configuration du Stream')
                .setDescription('Configurez les informations de votre stream')
                .setColor('#9146FF');

            const platformButton = new ButtonBuilder()
                .setCustomId('stream_platform')
                .setLabel('Plateforme: Twitch')
                .setStyle(ButtonStyle.Primary);

            const channelButton = new ButtonBuilder()
                .setCustomId('stream_channel')
                .setLabel('Définir la chaîne')
                .setStyle(ButtonStyle.Success);

            const notificationButton = new ButtonBuilder()
                .setCustomId('notification_channel')
                .setLabel('Salon')
                .setStyle(ButtonStyle.Secondary);

            const messageButton = new ButtonBuilder()
                .setCustomId('stream_message')
                .setLabel('Message')
                .setStyle(ButtonStyle.Secondary);

            // Création du menu des streamers
            const streamers = await StreamManager.getStreamers();
            let streamerOptions = [];

            // Vérifier s'il y a des streamers
            if (Object.values(streamers).length > 0) {
                streamerOptions = Object.values(streamers).map(streamer => ({
                    label: streamer.channelName || 'Streamer sans nom',
                    value: streamer.channelName || 'unknown',
                    description: `${streamer.platform} - ${streamer.channelUrl}`.slice(0, 100)
                }));
            } else {
                // Option par défaut si aucun streamer n'est configuré
                streamerOptions = [{
                    label: 'Aucun streamer configuré',
                    value: 'none',
                    description: 'Utilisez les boutons ci-dessus pour configurer un streamer'
                }];
            }

            const streamersMenu = new StringSelectMenuBuilder()
                .setCustomId('streamers_select')
                .setPlaceholder('Sélectionner un streamer à modifier')
                .addOptions(streamerOptions);

            // Ajout de tous les boutons dans la rangée
            const buttonsRow = new ActionRowBuilder().addComponents(
                platformButton,
                channelButton,
                notificationButton,
                messageButton
            );
            const menuRow = new ActionRowBuilder().addComponents(streamersMenu);

            await message.reply({
                embeds: [embed],
                components: [buttonsRow, menuRow]
            });
        } catch (error) {
            console.error('Erreur dans la commande live:', error);
            await message.reply({
                content: 'Une erreur est survenue lors de la configuration du stream.',
                ephemeral: true
            });
        }
    }
};
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const { 
    getFivemServerInfo, 
    getServerAddress 
} = require('../../utils/fivem');

module.exports = {
    name: 'fivem',
    async execute(message) {
        try {
            // Vérifier si l'utilisateur est administrateur
            if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                await message.channel.send('❌ Vous devez être administrateur pour utiliser cette commande.');
                return;
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('add_server')
                        .setLabel('Ajouter/Modifier le serveur')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('refresh_info')
                        .setLabel('Rafraîchir')
                        .setStyle(ButtonStyle.Secondary)
                );

            const serverAddress = await getServerAddress(message.guildId);
            let embed;

            if (!serverAddress) {
                embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Configuration requise')
                    .setDescription('Aucun serveur FiveM n\'est configuré. Cliquez sur le bouton ci-dessous pour en ajouter un.')
                    .setTimestamp();
            } else {
                try {
                    const serverInfo = await getFivemServerInfo(serverAddress);
                    embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Informations du Serveur FiveM')
                        .setTimestamp()
                        .addFields(
                            { name: '{FivemMembersCount}', value: `Nombre de joueurs connectés\n\`Exemple : ${serverInfo?.players || 0}/${serverInfo?.maxPlayers || 0}\``, inline: true },
                            { name: '{FivemHostName}', value: `Nom du serveur\n\`Exemple : ${serverInfo?.hostname || 'Non disponible'}\``, inline: true },
                            { name: '{FivemGameType}', value: `Type de jeu\n\`Exemple : ${serverInfo?.gametype || 'Non disponible'}\``, inline: true },
                            { name: '{FivemMapName}', value: `Nom de la map\n\`Exemple : ${serverInfo?.mapname || 'Non disponible'}\``, inline: true },
                            { name: '{FivemStatus}', value: serverInfo?.status ? 'Status du serveur\n\`Exemple : 🟢 En ligne\`' : 'Status du serveur\n\`Exemple : 🔴 Hors ligne\`', inline: true }
                        );
                } catch (serverError) {
                    console.error('Erreur lors de la récupération des informations du serveur:', serverError);
                    embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Erreur')
                        .setDescription('Impossible de récupérer les informations du serveur. Veuillez vérifier que l\'adresse est correcte.')
                        .setTimestamp();
                }
            }

            // Utiliser channel.send au lieu de message.reply pour éviter les problèmes de référence
            await message.channel.send({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande fivem:', error);
            try {
                // Envoyer un message d'erreur dans le canal sans faire référence au message original
                await message.channel.send('Une erreur est survenue lors de l\'exécution de la commande.');
            } catch (sendError) {
                console.error('Erreur lors de l\'envoi du message d\'erreur:', sendError);
            }
        }
    },
    
    // Ajouter une fonction de gestion des boutons
    async handleButton(interaction) {
        try {
            // Vérifier si l'interaction est un bouton
            if (!interaction.isButton()) return;

            // Vérifier les permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({
                    content: '❌ Vous devez être administrateur pour utiliser ces boutons.',
                    ephemeral: true
                });
                return;
            }

            // Gérer les différents boutons
            switch (interaction.customId) {
                case 'refresh_info':
                    // Code pour rafraîchir les informations
                    await interaction.update({ content: 'Rafraîchissement en cours...' });
                    break;
                case 'add_server':
                    // Code pour ajouter/modifier le serveur
                    await interaction.update({ content: 'Configuration du serveur...' });
                    break;
                default:
                    await interaction.reply({
                        content: 'Action non reconnue.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Erreur lors de la gestion du bouton:', error);
            try {
                await interaction.reply({
                    content: 'Une erreur est survenue lors du traitement de votre action.',
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Erreur lors de l\'envoi de la réponse d\'erreur:', replyError);
            }
        }
    }
};
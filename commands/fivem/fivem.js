const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
const { 
    getFivemServerInfo, 
    getServerAddress, 
    setServerAddress, 
    validateAndFormatAddress 
} = require('../../utils/fivem');

module.exports = {
    name: 'fivem',
    async execute(message) {
        // Vérifier si l'utilisateur est administrateur
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
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
            const serverInfo = await getFivemServerInfo(serverAddress);
            embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Informations du Serveur FiveM')
                .setTimestamp()
                .addFields(
                    { name: '{FivemMembersCount}', value: `Nombre de joueurs connectés\n\`Exemple : ${serverInfo.players}/${serverInfo.maxPlayers}\``, inline: true },
                    { name: '{FivemHostName}', value: `Nom du serveur\n\`Exemple : ${serverInfo.hostname}\`` || 'Non disponible', inline: true },
                    { name: '{FivemGameType}', value: `Type de jeu\n\`Exemple : ${serverInfo.gametype}\`` || 'Non disponible', inline: true },
                    { name: '{FivemMapName}', value: `Nom de la map\n\`Exemple : ${serverInfo.mapname}\`` || 'Non disponible', inline: true },
                    { name: '{FivemStatus}', value: serverInfo.status ? 'Status du serveur\n\`Exemple : 🟢 En ligne\`' : 'Status du serveur\n\`Exemple : 🔴 Hors ligne\`', inline: true }
                );
        }

        await message.reply({ embeds: [embed], components: [row] });
    },
};
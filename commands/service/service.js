const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ServiceManager = require('../../utils/serviceManager');

module.exports = {
    name: 'service',
    description: 'Configuration du système de service',
    permission: 'ADMINISTRATOR',
    async execute(message, args) {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('Vous n\'avez pas les permissions nécessaires.');
        }

        const configEmbed = new EmbedBuilder()
            .setTitle('⚙️ Configuration du Système Service')
            .setDescription('Utilisez les boutons ci-dessous pour configurer le système.')
            .setColor('#2F3136')
            .addFields(
                { 
                    name: '📋 Configuration Actuelle', 
                    value: await ServiceManager.getConfigStatus(message.guild.id)
                }
            )
            .setTimestamp()
            .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('set_logs_channel')
                    .setLabel('Salon Logs')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('set_service_channel')
                    .setLabel('Salon Service')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('toggle_system')
                    .setLabel('Activer/Désactiver')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('configure_roles')
                    .setLabel('Configurer Rôles')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('👥'),
                new ButtonBuilder()
                    .setCustomId('view_stats')
                    .setLabel('Statistiques')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📈')
            );

        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('save_service')
                    .setLabel('Sauvegarder')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💾')  
            )

        await message.channel.send({
            embeds: [configEmbed],
            components: [row1, row2, row3]
        });
    }
};
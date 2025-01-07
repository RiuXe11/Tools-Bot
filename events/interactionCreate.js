const { 
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits 
} = require('discord.js');
const { getFivemServerInfo, getServerAddress, setServerAddress, validateAndFormatAddress } = require('../utils/fivem');
const statusVariables = require('../utils/statusVariables');
const { 
    generateFivemStatsEmbed, 
    fivemTimeButtons,
    createMonthSelectMenu,
    createDaysPagination,
    createDaysEmbed,
    generateServerPerfEmbed,
    generateRecordsEmbed,
    generateHourlyStatsEmbed
} = require('../commands/fivem/stats');
const hourlyRecorder = require('../utils/hourlyRecorder');

class InteractionHandler {
    static async handleButton(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ 
                content: '❌ Vous devez être administrateur pour utiliser ces boutons.',
                ephemeral: true 
            });
        }

        switch(interaction.customId) {
            case 'add_server':
                return this.showServerModal(interaction);
            case 'refresh_info':
                return this.refreshServerInfo(interaction);
            case 'fivem_24h':
                return this.updateFivemStats(interaction, 24 * 60 * 60 * 1000, 'dernières 24h');
            case 'fivem_7d':
                return this.updateFivemStats(interaction, 7 * 24 * 60 * 60 * 1000, '7 derniers jours');
            case 'fivem_30d':
                return this.updateFivemStats(interaction, 30 * 24 * 60 * 60 * 1000, '30 derniers jours');
            case 'fivem_custom':
                return this.handleCustomDate(interaction);
            case 'prev_page':
            case 'next_page':
                return this.handlePageNavigation(interaction);
            case 'custom_date':
                return this.handleDatePicker(interaction);
        }
    }

    static async handleSelectMenu(interaction) {
        if (interaction.customId === 'stats_menu') {
            switch(interaction.values[0]) {
                case 'fivem_players':
                    const playerEmbed = await generateFivemStatsEmbed(interaction, 24 * 60 * 60 * 1000, 'dernières 24h');
                    return interaction.update({ embeds: [playerEmbed], components: [fivemTimeButtons] });
                    
                case 'server_perf':
                    const perfEmbed = await generateServerPerfEmbed(interaction);
                    return interaction.update({ embeds: [perfEmbed] });
                    
                case 'records':
                    const recordsEmbed = await generateRecordsEmbed(interaction);
                    return interaction.update({ embeds: [recordsEmbed] });
                    
                case 'hourly_stats':
                    const hourlyEmbed = await generateHourlyStatsEmbed(interaction);
                    return interaction.update({ embeds: [hourlyEmbed] });
            }
        } else if (interaction.customId === 'month_select') {
            await this.handleMonthSelect(interaction);
        }
    }

    static async handleModalSubmit(interaction) {
        if (interaction.customId === 'server_modal') {
            await interaction.deferReply({ ephemeral: true });
            return this.handleServerConfig(interaction);
        } else if (interaction.customId === 'date_picker_modal') {
            const dateStr = interaction.fields.getTextInputValue('selected_date');
            const [day, month, year] = dateStr.split('/');
            const timestamp = new Date(year, month - 1, day).getTime();
            const period = 24 * 60 * 60 * 1000; // 24 heures
            
            const embed = await generateFivemStatsEmbed(interaction, period, `le ${dateStr}`);
            return interaction.update({ embeds: [embed], components: [fivemTimeButtons] });
        }
    }

    static async showServerModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('server_modal')
            .setTitle('Configuration du serveur FiveM')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('server_address')
                        .setLabel('Adresse CFX du serveur')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Exemple: cfx.re/join/abcdef')
                        .setRequired(true)
                )
            );

        return interaction.showModal(modal);
    }

    static async refreshServerInfo(interaction) {
        await interaction.deferUpdate();
        const serverAddress = await getServerAddress(interaction.guildId);
        
        if (!serverAddress) {
            return interaction.editReply({ 
                embeds: [this.createErrorEmbed('Aucun serveur n\'est configuré.')] 
            });
        }

        const serverInfo = await getFivemServerInfo(serverAddress);
        const embed = this.createServerInfoEmbed(serverInfo);
        const row = this.createServerControlButtons();

        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    static async updateFivemStats(interaction, period, label) {
        const embed = await generateFivemStatsEmbed(interaction, period, label);
        return interaction.update({ embeds: [embed], components: [fivemTimeButtons] });
    }

    static async handleServerConfig(interaction) {
        try {
            const address = interaction.fields.getTextInputValue('server_address');
            const formattedAddress = await validateAndFormatAddress(address);
            
            await setServerAddress(interaction.guildId, formattedAddress);
            await statusVariables.initializeWithAddress(formattedAddress);
            
            await interaction.editReply({
                content: '✅ Le serveur a été configuré avec succès !',
                ephemeral: true
            });

            const serverInfo = await getFivemServerInfo(formattedAddress);
            await interaction.message.edit({
                embeds: [this.createServerInfoEmbed(serverInfo)],
                components: [this.createServerControlButtons()]
            });
        } catch (error) {
            await interaction.editReply({
                content: `❌ Erreur: ${error.message}`,
                ephemeral: true
            });
        }
    }

    static createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Erreur')
            .setDescription(message)
            .setTimestamp();
    }

    static createServerInfoEmbed(serverInfo) {
        return new EmbedBuilder()
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

    static createServerControlButtons() {
        return new ActionRowBuilder()
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
    }

    static async handleMonthSelect(interaction) {
        const selectedMonth = interaction.values[0];
        const { embed, totalPages } = await createDaysEmbed(interaction.guildId, selectedMonth);
        const dates = await hourlyRecorder.getAvailableDates(interaction.guildId);
        await interaction.update({
            embeds: [embed],
            components: [createMonthSelectMenu(dates), createDaysPagination(0, totalPages)]
        });
    }
    
    static async handleCustomDate(interaction) {
        const dates = await hourlyRecorder.getAvailableDates(interaction.guildId);
        if (dates.length === 0) {
            return interaction.reply({ content: '❌ Aucune donnée disponible', ephemeral: true });
        }
    
        const firstDate = dates[0];
        const selectedMonth = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;
        const monthMenu = createMonthSelectMenu(dates);
        const { embed, totalPages } = await createDaysEmbed(interaction.guildId, selectedMonth);
        
        return interaction.update({
            embeds: [embed],
            components: [monthMenu, createDaysPagination(0, totalPages)]
        });
    }

    static async handlePageNavigation(interaction) {
        const [currentMonth, currentPage] = interaction.message.embeds[0].footer.text
            .match(/Page (\d+)\/(\d+)/).slice(1).map(Number);
        const newPage = interaction.customId === 'prev_page' ? currentPage - 1 : currentPage + 1;
        
        const { embed, totalPages } = await createDaysEmbed(
            interaction.guildId, 
            currentMonth,
            newPage - 1
        );
    
        await interaction.update({
            embeds: [embed],
            components: [createMonthSelectMenu(dates), createDaysPagination(newPage - 1, totalPages)]
        });
    }
    
    static async handleDatePicker(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('date_picker_modal')
            .setTitle('Choisir une date')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('selected_date')
                        .setLabel('Date (JJ/MM/AAAA)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('31/12/2024')
                        .setRequired(true)
                )
            );
    
        await interaction.showModal(modal);
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isButton()) {
                await InteractionHandler.handleButton(interaction);
            } else if (interaction.isStringSelectMenu()) {
                await InteractionHandler.handleSelectMenu(interaction);
            } else if (interaction.isModalSubmit()) {
                await InteractionHandler.handleModalSubmit(interaction);
            }
        } catch (error) {
            console.error('Erreur lors du traitement de l\'interaction:', error);
            const errorMessage = '❌ Une erreur est survenue lors du traitement de votre demande.';
            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }
};
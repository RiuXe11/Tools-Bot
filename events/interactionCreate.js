const { 
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
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
const keyword = require('../commands/moderation/keyword');
const playerTracker = require('../utils/playerTracker');

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

        if (interaction.customId.startsWith('player_calendar_')) {
            const playerId = interaction.customId.split('player_calendar_')[1];
            
            // Créer le menu de sélection du mois
            const now = new Date();
            const monthsMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`month_select_${playerId}`)
                        .setPlaceholder('Sélectionner un mois')
                        .addOptions(
                            Array.from({ length: 6 }, (_, i) => {
                                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                return {
                                    label: `${month}/${year}`,
                                    value: `${year}-${month}`,
                                    emoji: '📅'
                                };
                            })
                        )
                );
        
            const returnButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`player_stats_${playerId}`)
                        .setLabel('Retour aux statistiques')
                        .setStyle(ButtonStyle.Secondary)
                );
        
            await interaction.update({
                components: [monthsMenu, returnButton]
            });
            return;
        }

        if (interaction.customId === 'players_stats') {
            return this.handlePlayerStatsMenu(interaction);
        }

        if (interaction.customId === 'search_player') {
            const modal = new ModalBuilder()
                .setCustomId('search_player_modal')
                .setTitle('Rechercher un joueur')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('search_term')
                            .setLabel('Pseudo du joueur')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Entrez le pseudo à rechercher...')
                            .setRequired(true)
                    )
                );

            await interaction.showModal(modal);
            return;
        }

        if (interaction.customId === 'select_player_id') {
            const modal = new ModalBuilder()
                .setCustomId('select_player_modal')
                .setTitle('Sélectionner un joueur')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('player_list_id')
                            .setLabel('ID du joueur')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Entrez l\'ID du joueur (ex: 01, 02, ...)')
                            .setRequired(true)
                    )
                );

            await interaction.showModal(modal);
            return;
        }

        if (interaction.customId === 'cancel_search') {
            return this.handlePlayerStatsMenu(interaction);
        }

        if (interaction.customId.startsWith('sort_')) {
            const sortType = interaction.customId.replace('sort_', '');
            const searchTerm = interaction.message.embeds[0].description.includes('Résultats pour')
                ? interaction.message.embeds[0].description.match(/Résultats pour "(.*?)"/)[1]
                : '';
            
            const { embed, components } = await playerTracker.generatePlayerListEmbed(
                interaction.guildId,
                searchTerm,
                sortType
            );
            
            await interaction.update({ 
                embeds: [embed],
                components 
            });
            return;
        }

        if (interaction.customId === 'prev_page_players' || interaction.customId === 'next_page_players') {
            const currentPage = parseInt(interaction.message.embeds[0].footer.text.split('/')[0].split(' ')[1]) - 1;
            const newPage = interaction.customId === 'prev_page_players' ? currentPage - 1 : currentPage + 1;
            
            // Récupérer le type de tri actuel
            const sortType = interaction.message.components[1].components.find(b => 
                b.style === ButtonStyle.Primary
            )?.customId.replace('sort_', '') || 'time';
        
            // Récupérer le terme de recherche s'il existe
            const searchTerm = interaction.message.embeds[0].description.includes('Résultats pour')
                ? interaction.message.embeds[0].description.match(/Résultats pour "(.*?)"/)[1]
                : '';
        
            const { embed, components } = await playerTracker.generatePlayerListEmbed(
                interaction.guildId,
                searchTerm,
                sortType,
                newPage
            );
        
            await interaction.update({ embeds: [embed], components });
            return;
        }

        if (interaction.customId === 'check_duplicates') {
            const { embed, components } = await playerTracker.generateDuplicatesEmbed(interaction.guildId);
            await interaction.update({
                embeds: [embed],
                components
            });
            return;
        }

        if (interaction.customId === 'merge_all_duplicates') {
            // Demander confirmation avant fusion automatique
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⚠️ Confirmation de fusion automatique')
                .setDescription('Êtes-vous sûr de vouloir fusionner automatiquement tous les doublons ?\n\n' +
                    'Pour chaque groupe de doublons, le compte avec le plus de temps de jeu sera conservé, et les autres seront fusionnés avec celui-ci.\n\n' +
                    '**Cette action est irréversible !**')
                .setTimestamp();

            const confirmButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_merge_all')
                        .setLabel('Confirmer')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId('check_duplicates')
                        .setLabel('Annuler')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('❌')
                );

            await interaction.update({
                embeds: [confirmEmbed],
                components: [confirmButtons]
            });
            return;
        }

        if (interaction.customId === 'confirm_merge_all') {
            try {
                // Effectuer les fusions
                const mergeResults = await playerTracker.cleanupDuplicates(interaction.guildId);
                
                // Créer un résumé des fusions effectuées
                let description = 'Résumé des fusions effectuées :\n\n';
                if (mergeResults.length === 0) {
                    description = '✅ Aucun doublon à fusionner.';
                } else {
                    for (const result of mergeResults) {
                        description += `**${result.name}** :\n`;
                        for (const merge of result.merges) {
                            description += `→ ID ${merge.source} fusionné avec ID ${merge.target}\n`;
                        }
                        description += '\n';
                    }
                }

                const summaryEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('Fusion automatique terminée')
                    .setDescription(description)
                    .setTimestamp();

                const returnButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('check_duplicates')
                            .setLabel('Retour aux doublons')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('↩️')
                    );

                await interaction.update({
                    embeds: [summaryEmbed],
                    components: [returnButton]
                });
            } catch (error) {
                console.error('Erreur lors de la fusion automatique:', error);
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ Erreur')
                    .setDescription('Une erreur est survenue lors de la fusion automatique.')
                    .setTimestamp();

                await interaction.update({
                    embeds: [errorEmbed],
                    components: []
                });
            }
            return;
        }

        if (interaction.customId === 'show_duplicates') {
            const duplicatesEmbed = await playerTracker.generateDuplicatesEmbed(interaction.guildId);
            return interaction.update({ 
                embeds: [duplicatesEmbed], 
                components: [playerTracker.duplicateManagementButtons] 
            });
        }
        
        if (interaction.customId === 'merge_players') {
            const modal = await playerTracker.generateMergeModal();
            await interaction.showModal(modal);
            return;
        }
        
        if (interaction.customId === 'cleanup_duplicates') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ 
                    content: '❌ Seuls les administrateurs peuvent utiliser cette fonction.',
                    ephemeral: true 
                });
            }
        
            const confirmEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⚠️ Confirmation de nettoyage')
                .setDescription('Êtes-vous sûr de vouloir nettoyer tous les doublons ? Cette action est irréversible.\n\nLes comptes seront fusionnés automatiquement en gardant celui avec le plus de temps de jeu.')
                .setTimestamp();
        
            return interaction.update({ 
                embeds: [confirmEmbed], 
                components: [playerTracker.confirmCleanupButtons] 
            });
        }
        
        if (interaction.customId === 'confirm_cleanup') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ 
                    content: '❌ Seuls les administrateurs peuvent utiliser cette fonction.',
                    ephemeral: true 
                });
            }
        
            await playerTracker.cleanupDuplicates(interaction.guildId);
            const updatedEmbed = await playerTracker.generateDuplicatesEmbed(interaction.guildId);
            return interaction.update({ 
                embeds: [updatedEmbed], 
                components: [playerTracker.duplicateManagementButtons] 
            });
        }
        
    }

    static async handleSelectMenu(interaction) {
        if (interaction.customId === 'stats_menu') {
            const { 
                generateFivemStatsEmbed, 
                fivemTimeButtons,
                generateServerPerfEmbed, 
                generateRecordsEmbed, 
                generateHourlyStatsEmbed,
                generateTopPlayersEmbed,
                generateActiveSessionsEmbed,
                generateComparisonsEmbed
            } = require('../commands/fivem/stats');
    
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
    
                case 'players_stats':
                    return this.handlePlayerStatsMenu(interaction);
    
                case 'rankings':
                    const rankingsEmbed = await generateTopPlayersEmbed(interaction);
                    return interaction.update({ embeds: [rankingsEmbed] });
    
                case 'realtime_stats':
                    const realtimeEmbed = await generateActiveSessionsEmbed(interaction);
                    return interaction.update({ embeds: [realtimeEmbed] });
    
                case 'weekly_stats':
                    const weeklyEmbed = await generateComparisonsEmbed(interaction);
                    return interaction.update({ embeds: [weeklyEmbed] });
            }
        }

        if (interaction.customId.startsWith('month_select_')) {
            const playerId = interaction.customId.replace('month_select_', '');
            const selectedMonth = interaction.values[0];
            
            const calendarEmbed = await playerTracker.generatePlayerCalendarEmbed(
                interaction.guildId,
                playerId,
                selectedMonth
            );
    
            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`player_stats_${playerId}`)
                        .setLabel('Retour aux statistiques')
                        .setStyle(ButtonStyle.Secondary)
                );
    
            await interaction.update({
                embeds: [calendarEmbed],
                components: [backButton]
            });
            return;
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

        if (interaction.customId === 'search_player_modal') {
            const searchTerm = interaction.fields.getTextInputValue('search_term');
            const { embed, components } = await playerTracker.generatePlayerListEmbed(interaction.guildId, searchTerm);
            await interaction.update({ embeds: [embed], components });
            return;
        }

        if (interaction.customId === 'select_player_modal') {
            const listId = interaction.fields.getTextInputValue('player_list_id');
            
            // Charger directement les données
            const allData = await playerTracker.loadData();
            const guildData = allData[interaction.guildId] || {};
            
            // Vérifier si l'ID existe directement dans guildData
            if (!guildData[listId]) {
                const { embed, components } = await playerTracker.generatePlayerListEmbed(interaction.guildId);
                embed.setDescription(embed.data.description + '\n\n❌ ID invalide. Veuillez réessayer.');
                await interaction.update({ embeds: [embed], components });
                return;
            }
        
            // Afficher les statistiques du joueur
            const viewButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`player_stats_${listId}`)
                        .setLabel('Statistiques générales')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`player_calendar_${listId}`)
                        .setLabel('Calendrier d\'activité')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('players_stats')
                        .setLabel('Retour à la liste')
                        .setStyle(ButtonStyle.Secondary)
                );
        
            const statsEmbed = await playerTracker.generatePlayerStatsEmbed(interaction.guildId, listId);
            await interaction.update({
                embeds: [statsEmbed],
                components: [viewButtons]
            });
            return;
        }

        if (interaction.customId === 'merge_players_modal') {
            const sourceId = interaction.fields.getTextInputValue('source_id');
            const targetId = interaction.fields.getTextInputValue('target_id');
        
            try {
                await playerTracker.mergePlayers(interaction.guildId, sourceId, targetId);
                const resultEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Fusion réussie')
                    .setDescription(`Les données de l'ID ${sourceId} ont été fusionnées avec l'ID ${targetId}.\n\nUtilisez le bouton ci-dessous pour voir la liste des doublons restants.`)
                    .setTimestamp();
                
                const returnButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('check_duplicates')
                            .setLabel('Voir les doublons restants')
                            .setStyle(ButtonStyle.Primary)
                    );
        
                await interaction.update({ 
                    embeds: [resultEmbed], 
                    components: [returnButton]
                });
            } catch (error) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('❌ Erreur')
                    .setDescription(`Erreur lors de la fusion : ${error.message}\n\nVérifiez que les IDs sont corrects et réessayez.`)
                    .setTimestamp();
        
                const returnButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('check_duplicates')
                            .setLabel('Retour aux doublons')
                            .setStyle(ButtonStyle.Secondary)
                    );
        
                await interaction.update({ 
                    embeds: [errorEmbed],
                    components: [returnButton]
                });
            }
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

    static async handlePlayerStatsMenu(interaction) {
        // Afficher la liste des joueurs
        const { embed, components } = await playerTracker.generatePlayerListEmbed(interaction.guildId);
        await interaction.update({ embeds: [embed], components });
    }

    static async handlePlayerSelection(interaction) {
        const playerId = interaction.values[0];
        
        // Créer les boutons pour les différentes vues
        const viewButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`player_stats_${playerId}`)
                    .setLabel('Statistiques générales')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`player_calendar_${playerId}`)
                    .setLabel('Calendrier d\'activité')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Obtenir et afficher les stats du joueur
        const statsEmbed = await playerTracker.generatePlayerStatsEmbed(interaction.guildId, playerId);
        await interaction.update({
            embeds: [statsEmbed],
            components: [viewButtons]
        });
    }

    static async handlePlayerCalendar(interaction, playerId) {
        // Créer le menu de sélection du mois
        const now = new Date();
        const monthsMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`player_month_${playerId}`)
                    .setPlaceholder('Sélectionner un mois')
                    .addOptions(
                        Array.from({ length: 6 }, (_, i) => {
                            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const year = date.getFullYear();
                            return {
                                label: `${month}/${year}`,
                                value: `${year}-${month}`,
                                emoji: '📅'
                            };
                        })
                    )
            );

        await interaction.update({
            components: [monthsMenu]
        });
    }

    static async handlePlayerMonth(interaction) {
        const [_, playerId] = interaction.customId.split('player_month_');
        const selectedMonth = interaction.values[0];
        
        const calendarEmbed = await playerTracker.generatePlayerCalendarEmbed(
            interaction.guildId,
            playerId,
            selectedMonth
        );

        // Ajouter un bouton de retour
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`player_stats_${playerId}`)
                    .setLabel('Retour aux statistiques')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            embeds: [calendarEmbed],
            components: [backButton]
        });
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            // Ajouter cette section pour gérer les interactions liées aux mots-clés
            if (interaction.customId?.startsWith('keyword-') || 
                interaction.customId === 'sanction-type-select' || 
                (interaction.isStringSelectMenu() && interaction.customId === 'keyword-select')) {
                await keyword.handleInteraction(interaction);
                return;
            }

            // Gestion des autres interactions
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
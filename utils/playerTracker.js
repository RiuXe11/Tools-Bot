const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle} = require('discord.js');

class PlayerTracker {
    constructor() {
        this.playersPath = path.join(__dirname, '../data/players.json');
        this.activePlayersCache = new Map(); // Map pour suivre les joueurs actuellement en ligne
    }

    async loadData() {
        try {
            const data = await fs.readFile(this.playersPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Si le fichier n'existe pas, créer un objet vide
                await this.saveData({});
                return {};
            }
            throw error;
        }
    }

    async saveData(data) {
        await fs.writeFile(this.playersPath, JSON.stringify(data, null, 2));
    }

    async generatePlayerListEmbed(guildId, searchTerm = '', sortType = 'time', page = 0) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
        
        // Créer un Map pour garder le plus haut ID pour chaque nom
        const bestIdByName = new Map();
        Object.entries(guildData).forEach(([id, data]) => {
            const normalizedName = data.name.trim().toLowerCase();
            if (!bestIdByName.has(normalizedName) || 
                guildData[bestIdByName.get(normalizedName)].totalTime < data.totalTime) {
                bestIdByName.set(normalizedName, id);
            }
        });
    
        // Créer la liste des joueurs uniques avec leur meilleur ID
        let players = Array.from(bestIdByName.entries()).map(([normalizedName, id]) => ({
            id: id,
            name: guildData[id].name.trim(),
            totalTime: guildData[id].totalTime
        }));
        
        // Appliquer le tri
        switch(sortType) {
            case 'pseudo':
                players.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'time':
                players.sort((a, b) => b.totalTime - a.totalTime);
                break;
            case 'id':
                players.sort((a, b) => parseInt(a.id) - parseInt(b.id));
                break;
        }
    
        // Filtrer si recherche
        if (searchTerm) {
            players = players.filter(player => 
                player.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
    
        // Pagination
        const itemsPerPage = 35;
        const totalPages = Math.ceil(players.length / itemsPerPage);
        const paginatedPlayers = players.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Statistiques des Joueurs')
            .setFooter({ text: `Page ${page + 1}/${Math.max(1, totalPages)}` })
            .setTimestamp();
    
        if (players.length === 0) {
            embed.setDescription(searchTerm 
                ? '❌ Aucun joueur trouvé avec ce pseudo.'
                : '❌ Aucun joueur enregistré pour le moment.'
            );
        } else {
            const playerList = paginatedPlayers
                .map((player, index) => {
                    const hours = Math.round(player.totalTime / 3600000);
                    const timeStr = hours > 0 ? `${hours}h de jeu` : 'En ligne';
                    return `ID: \`${player.id}\` - **${player.name}** (\`${timeStr}\`)`;
                })
                .join('\n');
    
            const description = searchTerm 
                ? `🔍 Résultats pour "${searchTerm}":\n\n${playerList}`
                : `Liste des joueurs:\n\n${playerList}`;
    
            embed.setDescription(description + "\n\nPour voir les statistiques d'un joueur, utilisez son ID avec le bouton ci-dessous.\n⚠️ - **L'ENREGISTREMENT A COMMENCÉ LE 13/01/2025 AU ENVIRON DE 22h !**");
        }
    
        // Boutons d'action
        const actionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('search_player')
                    .setLabel('🔍 Rechercher un joueur')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('select_player_id')
                    .setLabel('Voir les statistiques')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('check_duplicates')
                    .setLabel('Doublons')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👥')
            );
    
        // Boutons de tri - Mettre en surbrillance le tri actif
        const sortButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('sort_pseudo')
                    .setLabel('Trier par Pseudo')
                    .setStyle(sortType === 'pseudo' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setEmoji('🔤'),
                new ButtonBuilder()
                    .setCustomId('sort_time')
                    .setLabel('Trier par Temps de jeu')
                    .setStyle(sortType === 'time' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setEmoji('⏱️'),
                new ButtonBuilder()
                    .setCustomId('sort_id')
                    .setLabel('Trier par ID')
                    .setStyle(sortType === 'id' ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setEmoji('🔢')
            );
    
        // Boutons de pagination si nécessaire
        const components = [actionButtons, sortButtons];
        if (totalPages > 1) {
            const paginationButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_page_players')
                        .setLabel('◀️ Page précédente')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next_page_players')
                        .setLabel('Page suivante ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page >= totalPages - 1)
                );
            components.push(paginationButtons);
        }
    
        if (searchTerm) {
            actionButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId('cancel_search')
                    .setLabel('❌ Annuler la recherche')
                    .setStyle(ButtonStyle.Danger)
            );
        }
    
        return { embed, components };
    }

    // Mettre à jour les données des joueurs à partir de l'API FiveM
    async updatePlayers(guildId, onlinePlayers) {
        const allData = await this.loadData();
        if (!allData[guildId]) {
            allData[guildId] = {};
        }

        const currentTime = Date.now();
        const guildData = allData[guildId];

        // Récupérer les joueurs actuellement en cache pour ce serveur
        if (!this.activePlayersCache.has(guildId)) {
            this.activePlayersCache.set(guildId, new Map());
        }
        const activeCache = this.activePlayersCache.get(guildId);

        // Mettre à jour les joueurs en ligne
        for (const player of onlinePlayers) {
            const playerId = player.id.toString();
            const playerName = player.name;

            if (!guildData[playerId]) {
                guildData[playerId] = {
                    name: playerName,
                    sessions: [],
                    totalTime: 0
                };
            }

            // Mettre à jour le nom si nécessaire
            if (guildData[playerId].name !== playerName) {
                guildData[playerId].name = playerName;
            }

            // Gérer la session
            if (!activeCache.has(playerId)) {
                // Nouveau joueur connecté
                activeCache.set(playerId, {
                    startTime: currentTime,
                    name: playerName
                });
                guildData[playerId].sessions.push({
                    start: currentTime,
                    end: null
                });
            }
        }

        // Vérifier les déconnexions
        for (const [playerId, session] of activeCache) {
            const isStillOnline = onlinePlayers.some(p => p.id.toString() === playerId);
            if (!isStillOnline) {
                // Joueur déconnecté
                const sessionTime = currentTime - session.startTime;
                const playerData = guildData[playerId];
                
                // Mettre à jour la dernière session
                const lastSession = playerData.sessions[playerData.sessions.length - 1];
                if (lastSession && !lastSession.end) {
                    lastSession.end = currentTime;
                    playerData.totalTime += sessionTime;
                }

                activeCache.delete(playerId);
            }
        }

        await this.saveData(allData);
    }

    // Obtenir les statistiques d'un joueur
    async getPlayerStats(guildId, playerId) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
        const playerData = guildData[playerId];

        if (!playerData) {
            return null;
        }

        // Calculer les statistiques
        const stats = {
            name: playerData.name,
            totalTime: playerData.totalTime,
            sessionCount: playerData.sessions.length,
            averageSessionTime: playerData.totalTime / playerData.sessions.length,
            longestSession: 0,
            lastSeen: 0
        };

        // Trouver la session la plus longue
        for (const session of playerData.sessions) {
            const duration = (session.end || Date.now()) - session.start;
            if (duration > stats.longestSession) {
                stats.longestSession = duration;
            }
            if (session.end && session.end > stats.lastSeen) {
                stats.lastSeen = session.end;
            }
        }

        return stats;
    }

    // Obtenir la liste des joueurs pour le menu de sélection
    async getPlayersMenu(guildId) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
    
        const players = Object.entries(guildData)
            .map(([id, data]) => ({
                id,
                name: data.name,
                totalTime: data.totalTime
            }))
            .sort((a, b) => b.totalTime - a.totalTime)
            .slice(0, 25); // Limite à 25 joueurs pour le menu
    
        // S'il n'y a pas de joueurs, retourner un menu avec une option par défaut
        if (players.length === 0) {
            return new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_player')
                        .setPlaceholder('Aucun joueur enregistré')
                        .setDisabled(true)
                        .addOptions([
                            {
                                label: 'Aucune donnée disponible',
                                value: 'no_data',
                                description: 'Attendez que des joueurs se connectent',
                                emoji: '❌'
                            }
                        ])
                );
        }
    
        return new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_player')
                    .setPlaceholder('Sélectionner un joueur')
                    .addOptions(
                        players.map(player => ({
                            label: player.name,
                            value: player.id,
                            description: `${Math.round(player.totalTime / 3600000)}h de jeu`,
                            emoji: '👤'
                        }))
                    )
            );
    }

    // Générer l'embed des statistiques du joueur
    async getPlayerCalendar(guildId, playerId, month) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
        const playerData = guildData[playerId];

        if (!playerData) {
            return null;
        }

        // Filtrer les sessions pour le mois sélectionné
        const [year, monthNum] = month.split('-');
        const startDate = new Date(year, monthNum - 1, 1);
        const endDate = new Date(year, monthNum, 0);

        const monthSessions = playerData.sessions.filter(session => {
            const sessionDate = new Date(session.start);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        // Organiser les données par jour
        const dailyPlaytime = {};
        monthSessions.forEach(session => {
            const day = new Date(session.start).getDate();
            if (!dailyPlaytime[day]) {
                dailyPlaytime[day] = 0;
            }
            dailyPlaytime[day] += (session.end || Date.now()) - session.start;
        });

        return dailyPlaytime;
    }

    async generatePlayerCalendarEmbed(guildId, playerId, month) {
        const dailyPlaytime = await this.getPlayerCalendar(guildId, playerId, month);
        const playerData = (await this.loadData())[guildId]?.[playerId];

        if (!dailyPlaytime || !playerData) {
            return new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Données non disponibles')
                .setDescription('Aucune donnée disponible pour ce joueur sur cette période.')
                .setTimestamp();
        }

        const [year, monthNum] = month.split('-');
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        let description = `Calendrier de ${playerData.name} - ${monthNum}/${year}\n\n`;
        for (let day = 1; day <= daysInMonth; day++) {
            const playtime = dailyPlaytime[day] || 0;
            const hours = Math.floor(playtime / 3600000);
            const minutes = Math.floor((playtime % 3600000) / 60000);
            
            const emoji = playtime > 0 ? '✅' : '❌';
            description += `**${String(day).padStart(2, '0')}/${monthNum}** ${emoji} ${hours}h${minutes}min\n`;
        }

        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Activité mensuelle de ${playerData.name}`)
            .setDescription(description)
            .setTimestamp();
    }

    async generatePlayerStatsEmbed(guildId, playerId) {
        const stats = await this.getPlayerStats(guildId, playerId);
        if (!stats) {
            return new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Joueur non trouvé')
                .setDescription('Aucune donnée disponible pour ce joueur.')
                .setTimestamp();
        }

        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Statistiques de ${stats.name}`)
            .addFields(
                {
                    name: 'Temps total de jeu',
                    value: `${Math.round(stats.totalTime / 3600000)}h ${Math.round((stats.totalTime % 3600000) / 60000)}min`,
                    inline: true
                },
                {
                    name: 'Nombre de sessions',
                    value: stats.sessionCount.toString(),
                    inline: true
                },
                {
                    name: 'Temps moyen par session',
                    value: `${Math.round(stats.averageSessionTime / 60000)}min`,
                    inline: true
                },
                {
                    name: 'Plus longue session',
                    value: `${Math.round(stats.longestSession / 3600000)}h ${Math.round((stats.longestSession % 3600000) / 60000)}min`,
                    inline: true
                },
                {
                    name: 'Dernière connexion',
                    value: stats.lastSeen ? new Date(stats.lastSeen).toLocaleString('fr-FR') : `\`🟢\`En ligne`,
                    inline: true
                }
            )
            .setTimestamp();
    }

    async findDuplicates(guildId) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
        
        // Regrouper par nom normalisé
        const nameGroups = {};
        Object.entries(guildData).forEach(([id, data]) => {
            const normalizedName = data.name.trim().toLowerCase();
            if (!nameGroups[normalizedName]) {
                nameGroups[normalizedName] = [];
            }
            nameGroups[normalizedName].push({ id, data });
        });
    
        // Filtrer pour ne garder que les groupes avec des doublons
        const duplicates = Object.entries(nameGroups)
            .filter(([_, group]) => group.length > 1)
            .map(([name, group]) => ({
                name: group[0].data.name,
                entries: group.map(entry => ({
                    id: entry.id,
                    totalTime: entry.data.totalTime,
                    sessions: entry.data.sessions.length
                }))
            }));
    
        return duplicates;
    }

    async generateDuplicatesEmbed(guildId) {
        const duplicates = await this.findDuplicates(guildId);
        
        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('Doublons Détectés')
            .setTimestamp();
    
        if (duplicates.length === 0) {
            embed.setDescription('✅ Aucun doublon trouvé.');
            const returnButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('players_stats')
                        .setLabel('Retour')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('↩️')
                );
            return { embed, components: [returnButton] };
        }
    
        const description = duplicates.map(dup => {
            const entriesText = dup.entries.map(entry => 
                `└─ ID: \`${entry.id}\` - \`${Math.round(entry.totalTime / 3600000)}h\` (${entry.sessions} sessions)`
            ).join('\n');
            return `**${dup.name}**\n${entriesText}`;
        }).join('\n\n');
    
        embed.setDescription(description + "\n\nUtilisez le bouton 'Fusionner' pour combiner des doublons ou 'Tout fusionner automatiquement' pour fusionner tous les doublons.");

        const duplicateManagementButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('merge_players')
                    .setLabel('Fusionner un doublon')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔄'),
                new ButtonBuilder()
                    .setCustomId('merge_all_duplicates')
                    .setLabel('Tout fusionner automatiquement')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('♻️'),
                new ButtonBuilder()
                    .setCustomId('players_stats')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('↩️')
            );

        return { 
            embed,
            components: [duplicateManagementButtons]
        };
    }
    
    async mergePlayers(guildId, sourceId, targetId) {
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
    
        if (!guildData[sourceId] || !guildData[targetId]) {
            throw new Error("Un ou plusieurs IDs invalides");
        }
    
        // Fusionner les sessions
        guildData[targetId].sessions.push(...guildData[sourceId].sessions);
        // Trier les sessions par date
        guildData[targetId].sessions.sort((a, b) => a.start - b.start);
        // Mettre à jour le temps total
        guildData[targetId].totalTime += guildData[sourceId].totalTime;
    
        // Supprimer le joueur source
        delete guildData[sourceId];
    
        await this.saveData(allData);
        return guildData[targetId];
    }
    
    async cleanupDuplicates(guildId) {
        const duplicates = await this.findDuplicates(guildId);
        const allData = await this.loadData();
        const guildData = allData[guildId] || {};
        const mergeResults = [];
        
        for (const dup of duplicates) {
            // Trouver l'entrée avec le plus de temps de jeu
            const sortedEntries = [...dup.entries].sort((a, b) => b.totalTime - a.totalTime);
            const targetId = sortedEntries[0].id;
            
            const mergesForThisName = [];
            // Fusionner tous les autres avec celle-ci
            for (let i = 1; i < sortedEntries.length; i++) {
                try {
                    await this.mergePlayers(guildId, sortedEntries[i].id, targetId);
                    mergesForThisName.push({
                        source: sortedEntries[i].id,
                        target: targetId
                    });
                } catch (error) {
                    console.error(`Erreur lors de la fusion de ${sortedEntries[i].id} vers ${targetId}:`, error);
                }
            }
            
            if (mergesForThisName.length > 0) {
                mergeResults.push({
                    name: dup.name,
                    merges: mergesForThisName,
                    keptId: targetId
                });
            }
        }
        
        return mergeResults;
    }
    
    async generateMergeModal(playerId1, playerId2) {
        return new ModalBuilder()
            .setCustomId('merge_players_modal')
            .setTitle('Fusionner des joueurs')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('source_id')
                        .setLabel('ID source (à fusionner)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('ID du joueur à fusionner')
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('target_id')
                        .setLabel('ID cible (conservation)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('ID du joueur à conserver')
                        .setRequired(true)
                )
            );
    }
}

module.exports = new PlayerTracker();
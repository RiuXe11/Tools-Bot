const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
        
        // Rassembler tous les joueurs avec leurs données et leur vrai ID
        let players = Object.entries(guildData).map(([id, data]) => ({
            id: id,  // Garder l'ID original
            name: data.name.trim(),
            sessions: data.sessions,
            totalTime: data.totalTime
        }));
    
        // Dédupliquer les joueurs en gardant celui avec le plus de temps
        const uniquePlayers = new Map();
        players.forEach(player => {
            const normalizedName = player.name.toLowerCase();
            if (!uniquePlayers.has(normalizedName) || 
                player.totalTime > uniquePlayers.get(normalizedName).totalTime) {
                uniquePlayers.set(normalizedName, player);
            }
        });
    
        // Convertir en tableau et appliquer le tri
        players = Array.from(uniquePlayers.values());
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
        const itemsPerPage = 25;
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
                .map((player, index) => `ID: \`${player.id}\` - **${player.name}** (\`${Math.round(player.totalTime / 3600000)}h\` de jeu)`)
                .join('\n');
    
            const description = searchTerm 
                ? `🔍 Résultats pour "${searchTerm}":\n\n${playerList}`
                : `Liste des joueurs:\n\n${playerList}`;
    
            embed.setDescription(description + "\n\nPour voir les statistiques d'un joueur, utilisez son ID avec le bouton ci-dessous.");
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
                    .setStyle(ButtonStyle.Primary)
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
}

module.exports = new PlayerTracker();
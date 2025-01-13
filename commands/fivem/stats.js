const { 
    EmbedBuilder,
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { getFivemServerInfo, getServerAddress } = require('../../utils/fivem');
const fs = require('fs').promises;
const path = require('path');
const colorManager = require('../../utils/colors');
const fivemCache = require('../../utils/fivemCache');
const playerTracker = require('../../utils/playerTracker');

// Menu principal des statistiques
const mainStatsMenu = new ActionRowBuilder()
    .addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('stats_menu')
            .setPlaceholder('Sélectionnez une catégorie de statistiques')
            .addOptions([
                {
                    label: 'Joueurs FiveM',
                    description: 'Statistiques des joueurs connectés',
                    value: 'fivem_players',
                    emoji: '👥'
                },
                {
                    label: 'Performance Serveur',
                    description: 'Statistiques de performance du serveur',
                    value: 'server_perf',
                    emoji: '📊'
                },
                {
                    label: 'Records',
                    description: 'Records et meilleures performances',
                    value: 'records',
                    emoji: '🏆'
                },
                {
                    label: 'Statistiques Horaires',
                    description: 'Analyse par heure de la journée',
                    value: 'hourly_stats',
                    emoji: '🕒'
                },
                {
                    label: 'Joueurs',
                    description: 'Statistiques des joueurs individuels',
                    value: 'players_stats',
                    emoji: '👤'
                },
                {
                    label: 'Classements',
                    description: 'Top joueurs et meilleures performances',
                    value: 'rankings',
                    emoji: '📈'
                },
                {
                    label: 'Stats Hebdomadaires',
                    description: 'Analyse de l\'activité de la semaine',
                    value: 'weekly_stats',
                    emoji: '📅'
                },
                {
                    label: 'Vue Temps Réel',
                    description: 'Statistiques en direct du serveur',
                    value: 'realtime_stats',
                    emoji: '⚡'
                }
            ])
    );

// Boutons de période pour les stats FiveM
const fivemTimeButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('fivem_24h')
            .setLabel('24 heures')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📅'),
        new ButtonBuilder()
            .setCustomId('fivem_7d')
            .setLabel('7 jours')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📆'),
        new ButtonBuilder()
            .setCustomId('fivem_30d')
            .setLabel('30 jours')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊'),
        new ButtonBuilder()
            .setCustomId('fivem_custom')
            .setLabel('Date personnalisée')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🗓️')
    );

async function getStatsForDate(guildId, selectedDate) {
    const statsPath = path.join(__dirname, '../../data/serverstats.json');
    const allStats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
    const guildStats = allStats[guildId] || [];

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return guildStats.filter(stat => {
        const statDate = new Date(stat.timestamp);
        return statDate >= startOfDay && statDate <= endOfDay;
    }).sort((a, b) => a.timestamp - b.timestamp);
}

function generateChartUrl(data, title, guildId, showMinutes = false) {
    const color = colorManager.getColor(guildId).slice(1);
    
    // Réduire le nombre de points de données si trop nombreux
    let chartData = data;
    if (data.length > 24) {
        const step = Math.ceil(data.length / 24);
        chartData = data.filter((_, index) => index % step === 0);
    }
    
    const labels = chartData.map(d => {
        const date = new Date(d.timestamp);
        const localDate = new Date(date.getTime() + 3600000);
        return localDate.toLocaleString('fr-FR', { 
            hour: 'numeric',
            minute: showMinutes ? 'numeric' : undefined
        });
    });
    
    const config = {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Joueurs',
                data: chartData.map(d => d.players),
                borderColor: `#${color}`,
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            scales: { 
                y: { beginAtZero: true },
                x: {
                    ticks: { maxRotation: 45 }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    };

    return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}`;
}

function sampleData(data, points) {
    if (data.length <= points) return data;
    const step = Math.floor(data.length / points);
    return data.filter((_, i) => i % step === 0).slice(0, points);
}

async function getStatsForPeriod(guildId, period) {
    const statsPath = path.join(__dirname, '../../data/serverstats.json');
    let allStats = {};
    try {
        const data = await fs.readFile(statsPath, 'utf8');
        allStats = JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture des stats:', error);
        return { periodData: [], maxPlayers: 0, avgPlayers: 0 };
    }

    const guildStats = allStats[guildId] || [];
    const now = Date.now();
    // Ajout du décalage horaire dans le filtre
    const periodData = guildStats.filter(stat => (now - stat.timestamp + 3600000) < period);

    const maxPlayers = Math.max(...periodData.map(stat => stat.players), 0);
    const avgPlayers = Math.round(
        periodData.reduce((sum, stat) => sum + stat.players, 0) / periodData.length || 0
    );

    return { periodData, maxPlayers, avgPlayers };
}

async function generateFivemStatsEmbed(interaction, period, periodLabel) {
    const { periodData } = await getStatsForPeriod(interaction.guildId, period);
    
    // Calcul correct de la moyenne
    const validEntries = periodData.filter(stat => typeof stat.players === 'number');
    const avgPlayers = Math.round(validEntries.reduce((sum, stat) => sum + stat.players, 0) / validEntries.length);
    const maxPlayers = Math.max(...validEntries.map(stat => stat.players));

    const currentInfo = fivemCache.getCachedData(interaction.guildId) || {
        players: 0,
        maxPlayers: 0
    };

    const chartUrl = generateChartUrl(periodData, `Évolution du nombre de joueurs ${periodLabel}`, interaction.guildId);

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle(`Statistiques FiveM (${periodLabel})`)
        .addFields(
            { name: 'Joueurs actuels', value: `${currentInfo.players}/${currentInfo.maxPlayers}`, inline: true },
            { name: 'Record', value: `${maxPlayers} joueurs`, inline: true },
            { name: 'Moyenne', value: `${avgPlayers} joueurs`, inline: true }
        )
        .setImage(chartUrl)
        .setTimestamp()
        .setFooter({ text: 'Statistiques mises à jour toutes les heures' });
}

async function generateTopPlayersEmbed(interaction) {
    const allData = await playerTracker.loadData();
    const guildData = allData[interaction.guildId] || {};
    
    // Calculer les différents classements
    const players = Object.entries(guildData).map(([_, data]) => ({
        name: data.name,
        totalTime: data.totalTime,
        sessions: data.sessions
    }));

    // Top temps de jeu
    const topPlaytime = players
        .sort((a, b) => b.totalTime - a.totalTime)
        .slice(0, 5)
        .map((p, i) => `${i + 1}. **${p.name}** (\`${Math.round(p.totalTime / 3600000)}h\`)`);

    // Top sessions
    const topSessions = players
        .sort((a, b) => b.sessions.length - a.sessions.length)
        .slice(0, 5)
        .map((p, i) => `${i + 1}. **${p.name}** (\`${p.sessions.length} sessions\`)`);

    // Plus longues sessions
    const longestSessions = players
        .map(p => {
            const longestSession = Math.max(...p.sessions.map(s => 
                (s.end || Date.now()) - s.start
            ));
            return { name: p.name, duration: longestSession };
        })
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map((p, i) => `${i + 1}. **${p.name}** (\`${Math.round(p.duration / 3600000)}h\`)`);

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('🏆 Top Joueurs')
        .addFields(
            {
                name: '⏱️ Top temps de jeu',
                value: topPlaytime.join('\n'),
                inline: false
            },
            {
                name: '📈 Top nombre de sessions',
                value: topSessions.join('\n'),
                inline: false
            },
            {
                name: '⚡ Plus longues sessions',
                value: longestSessions.join('\n'),
                inline: false
            }
        )
        .setTimestamp();
}

async function generateActiveSessionsEmbed(interaction) {
    const currentInfo = fivemCache.getCachedData(interaction.guildId);
    const activeCache = playerTracker.activePlayersCache.get(interaction.guildId) || new Map();
    
    // Calculer les durées des sessions en cours
    const activeSessions = Array.from(activeCache.entries()).map(([_, session]) => ({
        name: session.name,
        duration: Date.now() - session.startTime
    }))
    .sort((a, b) => b.duration - a.duration);

    const sessionsList = activeSessions.map(session => {
        const hours = Math.floor(session.duration / 3600000);
        const minutes = Math.floor((session.duration % 3600000) / 60000);
        return `**${session.name}** - \`${hours}h${minutes}min\``;
    });

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('⚡ Sessions en cours')
        .setDescription(sessionsList.length > 0 ? sessionsList.join('\n') : 'Aucun joueur connecté')
        .addFields(
            {
                name: 'Joueurs connectés',
                value: `${currentInfo.players}/${currentInfo.maxPlayers}`,
                inline: true
            },
            {
                name: 'Durée moyenne',
                value: `${Math.round(activeSessions.reduce((sum, s) => sum + s.duration, 0) / (activeSessions.length * 3600000))}h`,
                inline: true
            }
        )
        .setTimestamp();
}

async function generateComparisonsEmbed(interaction) {
    const allData = await playerTracker.loadData();
    const guildData = allData[interaction.guildId] || {};
    
    // Comparaison entre les périodes
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const lastWeek = now - 7 * 24 * 60 * 60 * 1000;

    const dailySessions = Object.values(guildData)
        .flatMap(p => p.sessions.filter(s => s.start > yesterday))
        .length;

    const weeklySessions = Object.values(guildData)
        .flatMap(p => p.sessions.filter(s => s.start > lastWeek))
        .length;

    const avgSessionTime = Object.values(guildData)
        .flatMap(p => p.sessions)
        .map(s => (s.end || now) - s.start)
        .reduce((sum, duration) => sum + duration, 0) / Object.values(guildData).length;

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('📊 Comparaisons et Tendances')
        .addFields(
            {
                name: '24 dernières heures',
                value: `${dailySessions} sessions`,
                inline: true
            },
            {
                name: '7 derniers jours',
                value: `${weeklySessions} sessions`,
                inline: true
            },
            {
                name: 'Temps moyen par session',
                value: `${Math.round(avgSessionTime / 3600000)}h`,
                inline: true
            }
        )
        .setTimestamp();
}

function getPeakHours(data) {
    const hourlyAverages = Array(24).fill(0).map((_, hour) => {
        const hourData = data.filter(d => new Date(d.timestamp).getHours() === hour);
        return {
            hour,
            avg: hourData.reduce((sum, d) => sum + d.players, 0) / hourData.length || 0
        };
    });

    const peakHours = hourlyAverages
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 2)
        .map(h => `${h.hour}h`);

    return peakHours.join(', ');
}

function getQuietHours(data) {
    const hourlyAverages = Array(24).fill(0).map((_, hour) => {
        const hourData = data.filter(d => new Date(d.timestamp).getHours() === hour);
        return {
            hour,
            avg: hourData.reduce((sum, d) => sum + d.players, 0) / hourData.length || 0
        };
    });

    const quietHours = hourlyAverages
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 2)
        .map(h => `${h.hour}h`);

    return quietHours.join(', ');
}

function getWeekdayStats(data) {
    const weekdays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const stats = {};

    weekdays.forEach(day => {
        const dayData = data.filter(d => weekdays[new Date(d.timestamp).getDay()] === day);
        stats[day] = dayData.reduce((sum, d) => sum + d.players, 0) / dayData.length || 0;
    });

    return stats;
}

function createMonthSelectMenu(availableDates) {
    const months = [...new Set(availableDates.map(date => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse(); // Derniers 6 mois

    return new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('month_select')
                .setPlaceholder('Sélectionnez un mois')
                .addOptions(months.map(month => {
                    const [year, monthNum] = month.split('-');
                    return {
                        label: `${monthNum}/${year}`,
                        value: month,
                        emoji: '📅'
                    };
                }))
        );
}

// Fonction pour créer les boutons de pagination des jours
function createDaysPagination(currentPage, totalPages) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('◀')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('▶')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1),
            new ButtonBuilder()
                .setCustomId('custom_date')
                .setLabel('Choisir une date')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📆')
        );
}

// Fonction pour afficher les jours d'un mois spécifique
async function createDaysEmbed(guildId, selectedMonth, page = 0) {
    try {
        if (!selectedMonth || typeof selectedMonth !== 'string') {
            throw new Error('Mois invalide');
        }

        const serverColor = colorManager.getColor(guildId);
        const statsPath = path.join(__dirname, '../../data/serverstats.json');
        const data = await fs.readFile(statsPath, 'utf8');
        const allStats = JSON.parse(data);
        const guildStats = allStats[guildId] || [];

        // Extraire année et mois de manière sécurisée
        const [year, month] = selectedMonth.split('-').map(num => parseInt(num));
        if (!year || !month) {
            throw new Error('Format de date invalide');
        }

        // Filtrer les stats pour le mois sélectionné
        const daysInMonth = guildStats.filter(stat => {
            const date = new Date(stat.timestamp);
            return date.getFullYear() === year && 
                   (date.getMonth() + 1) === month;
        });

        // Regrouper par jour
        const dailyStats = daysInMonth.reduce((acc, stat) => {
            const date = new Date(stat.timestamp);
            const day = date.getDate();
            if (!acc[day]) {
                acc[day] = {
                    players: [],
                    count: 0
                };
            }
            if (typeof stat.players === 'number' && !isNaN(stat.players)) {
                acc[day].players.push(stat.players);
                acc[day].count++;
            }
            return acc;
        }, {});

        // Calculer les statistiques
        const days = Object.entries(dailyStats)
            .map(([day, stats]) => ({
                day: parseInt(day),
                maxPlayers: Math.max(...stats.players, 0),
                avgPlayers: stats.count > 0 
                    ? Math.round(stats.players.reduce((sum, p) => sum + p, 0) / stats.count)
                    : 0
            }))
            .sort((a, b) => b.day - a.day);

        const itemsPerPage = 10;
        const startIdx = page * itemsPerPage;
        const paginatedDays = days.slice(startIdx, startIdx + itemsPerPage);
        const totalPages = Math.ceil(days.length / itemsPerPage);

        const embed = new EmbedBuilder()
            .setColor(serverColor)
            .setTitle(`Statistiques quotidiennes - ${month}/${year}`)
            .setTimestamp();

        if (paginatedDays.length === 0) {
            embed.setDescription('Aucune donnée disponible pour cette période');
        } else {
            embed.setDescription(paginatedDays.map(d => 
                `**${String(d.day).padStart(2, '0')}/${String(month).padStart(2, '0')}** - Max: ${d.maxPlayers} | Moy: ${d.avgPlayers}`
            ).join('\n'));
        }

        embed.setFooter({ text: `Page ${page + 1}/${Math.max(1, totalPages)}` });

        return {
            embed,
            totalPages
        };
    } catch (error) {
        console.error('Erreur dans createDaysEmbed:', error);
        return {
            embed: new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('Erreur')
                .setDescription('Une erreur est survenue lors de la génération des statistiques.')
                .setTimestamp(),
            totalPages: 1
        };
    }
}

async function handleStatsButton(interaction) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    
    if (customId === 'prev_page' || customId === 'next_page') {
        const currentPage = parseInt(interaction.message.embeds[0].footer.text.split('/')[0].split(' ')[1]) - 1;
        const selectedMonth = interaction.message.embeds[0].title.split(' - ')[1].split('/').reverse().join('-');
        
        const newPage = customId === 'prev_page' ? currentPage - 1 : currentPage + 1;
        const { embed, totalPages } = await createDaysEmbed(interaction.guildId, selectedMonth, newPage);
        
        const components = [createDaysPagination(newPage, totalPages)];
        
        await interaction.update({ 
            embeds: [embed],
            components 
        });
    }
}

async function generateServerPerfEmbed(interaction) {
    const currentInfo = fivemCache.getCachedData(interaction.guildId);
    const statsPath = path.join(__dirname, '../../data/serverstats.json');
    const allStats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
    const guildStats = allStats[interaction.guildId] || [];

    // Calculer disponibilité sur 24h
    const last24h = guildStats.filter(stat => Date.now() - stat.timestamp < 24 * 60 * 60 * 1000);
    const uptime = last24h.filter(stat => stat.status).length / last24h.length * 100;

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('Performance du Serveur')
        .addFields(
            { name: 'Status actuel', value: currentInfo.status ? '🟢 En ligne' : '🔴 Hors ligne', inline: true },
            { name: 'Disponibilité (24h)', value: `${Math.round(uptime)}%`, inline: true },
            { name: 'Type de jeu', value: currentInfo.gametype || 'Non disponible', inline: true },
            { name: 'Map actuelle', value: currentInfo.mapname || 'Non disponible', inline: true }
        )
        .setTimestamp();
}

async function generateRecordsEmbed(interaction) {
    const statsPath = path.join(__dirname, '../../data/serverstats.json');
    const allStats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
    const guildStats = allStats[interaction.guildId] || [];

    // Calculer les records
    const allTimeRecord = Math.max(...guildStats.map(stat => stat.players));
    const recordDate = new Date(guildStats.find(stat => stat.players === allTimeRecord)?.timestamp);

    // Stats par jour de la semaine
    const weekdayStats = getWeekdayStats(guildStats);
    const bestDay = Object.entries(weekdayStats).sort((a, b) => b[1] - a[1])[0];

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('Records du Serveur')
        .addFields(
            { name: 'Record absolu', value: `${allTimeRecord} joueurs (${recordDate.toLocaleDateString()})`, inline: false },
            { name: 'Meilleur jour', value: `${bestDay[0]} (${Math.round(bestDay[1])} joueurs en moyenne)`, inline: true },
            { name: 'Heures de pointe', value: getPeakHours(guildStats), inline: true }
        )
        .setTimestamp();
}

const sortButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('sort_pseudo')
            .setLabel('Trier par Pseudo')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔤'),
        new ButtonBuilder()
            .setCustomId('sort_time')
            .setLabel('Trier par Temps de jeu')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏱️'),
        new ButtonBuilder()
            .setCustomId('sort_id')
            .setLabel('Trier par ID')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔢')
    );

async function generateSortedPlayerList(guildId, sortType) {
    const allData = await loadData();
    const guildData = allData[guildId] || {};
    
    let players = Object.entries(guildData).map(([id, data]) => ({
        id,
        name: data.name,
        totalTime: data.totalTime
    }));

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

    // Créer l'embed avec la liste triée
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Statistiques des Joueurs')
        .setDescription(players.map(player => 
            `ID: ${player.id} - ${player.name} (${Math.round(player.totalTime / 3600000)}h de jeu)`
        ).join('\n'))
        .setTimestamp();

    return { embed, components: [sortButtons] };
}

async function handleSortButton(interaction) {
    if (!interaction.isButton()) return;

    const sortType = interaction.customId.replace('sort_', '');
    const { embed, components } = await generateSortedPlayerList(interaction.guildId, sortType);
    
    await interaction.update({ 
        embeds: [embed],
        components
    });
}

async function generateHourlyStatsEmbed(interaction) {
    const color = colorManager.getColor(interaction.guildId).slice(1);
    const statsPath = path.join(__dirname, '../../data/serverstats.json');
    const allStats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
    const guildStats = allStats[interaction.guildId] || [];
    
    const hourlyData = Array(24).fill(0).map((_, hour) => {
        const hourStats = guildStats.filter(stat => new Date(stat.timestamp).getHours() === hour);
        return {
            hour,
            avg: hourStats.reduce((sum, stat) => sum + stat.players, 0) / hourStats.length || 0,
            max: Math.max(...hourStats.map(stat => stat.players), 0)
        };
    });

    const chartData = {
        labels: hourlyData.map(d => `${d.hour}h`),
        datasets: [{
            label: 'Moyenne par heure',
            data: hourlyData.map(d => Math.round(d.avg)),
            borderColor: `#${color}`,
            tension: 0.1
        }]
    };

    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({
        type: 'line',
        data: chartData,
        options: { scales: { y: { beginAtZero: true } } }
    }))}`;

    return new EmbedBuilder()
        .setColor(colorManager.getColor(interaction.guildId))
        .setTitle('Statistiques par Heure')
        .setImage(chartUrl)
        .setDescription('Moyenne de joueurs par heure de la journée')
        .setTimestamp();
}

module.exports = {
    name: 'stats',
    generateFivemStatsEmbed,
    fivemTimeButtons,
    createMonthSelectMenu,
    createDaysPagination,
    createDaysEmbed,
    handleStatsButton,
    generateServerPerfEmbed,
    generateRecordsEmbed,
    generateHourlyStatsEmbed,
    generateTopPlayersEmbed,
    generateActiveSessionsEmbed,
    generateComparisonsEmbed,
    async execute(message) {
        const serverAddress = await getServerAddress(message.guildId);
        if (!serverAddress) {
            return message.reply('❌ Aucun serveur FiveM n\'est configuré. Utilisez !fivem pour configurer le serveur.');
        }

        const embed = new EmbedBuilder()
            .setColor(colorManager.getColor(message.guild.id))
            .setTitle('Menu des Statistiques')
            .setDescription('Sélectionnez une catégorie de statistiques dans le menu ci-dessous')
            .setTimestamp();

        await message.reply({ 
            embeds: [embed], 
            components: [mainStatsMenu]
        });
    }
};
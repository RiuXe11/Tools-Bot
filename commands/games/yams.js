const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map pour stocker les parties en cours
const activeGames = new Map();

class YamsGame {
    constructor() {
        this.dices = Array(5).fill().map(() => Math.floor(Math.random() * 6) + 1);
        this.rolls = 3;
        this.currentPlayer = 1;
        this.gameState = 'SETUP';
        this.player1 = null;
        this.player2 = null;
        this.gameMode = null;
        this.startTime = null;
        this.selectedDices = new Set();
        this.scores = {
            player1: {
                as: null, deux: null, trois: null, quatre: null, cinq: null, six: null,
                brelan: null, carre: null, full: null, petiteSuite: null,
                grandeSuite: null, yams: null, chance: null
            },
            player2: {
                as: null, deux: null, trois: null, quatre: null, cinq: null, six: null,
                brelan: null, carre: null, full: null, petiteSuite: null,
                grandeSuite: null, yams: null, chance: null
            }
        };
    }

    rollDices() {
        for (let i = 0; i < this.dices.length; i++) {
            if (!this.selectedDices.has(i)) {
                this.dices[i] = Math.floor(Math.random() * 6) + 1;
            }
        }
        this.rolls--;
    }

    createGameEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Yams')
            .setDescription(this.getGameState());
    
        if (this.gameState === 'PLAYING') {
            embed.addFields(
                { name: 'Tour', value: `C'est au tour de ${this.currentPlayer === 1 ? `<@${this.player1}>` : this.player2 === 'BOT' ? 'BOT' : `<@${this.player2}>`}` },
                { name: 'Lancers restants', value: `${this.rolls}` }
            );
            
            const p1Scores = this.formatScores('player1');
            const p2Scores = this.formatScores('player2');
            
            embed.addFields(
                { name: this.player2 === 'BOT' ? 'Joueur' : 'Joueur 1', value: p1Scores, inline: true },
                { name: this.player2 === 'BOT' ? 'BOT' : 'Joueur 2', value: p2Scores, inline: true }
            );
        }
    
        return embed;
    }

    formatScores(player) {
        const scoreNames = {
            'as': 'As', 
            'deux': 'Deux',
            'trois': 'Trois',
            'quatre': 'Quatre',
            'cinq': 'Cinq',
            'six': 'Six',
            'brelan': 'Brelan',
            'carre': 'Carré',
            'full': 'Full',
            'petiteSuite': 'Petite Suite',
            'grandeSuite': 'Grande Suite',
            'yams': 'Yams',
            'chance': 'Chance'
        };
    
        const scores = this.scores[player];
        return Object.entries(scores)
            .map(([key, value]) => `${scoreNames[key]}: ${value === null ? '-' : value}`)
            .join('\n');
    }

    getGameState() {
        return `🎲 Dés actuels:\n${this.dices.map((d, i) => this.selectedDices.has(i) ? `[${d}]` : d).join(' ')}`;
    }

    getGameButtons() {
        const diceButtons = new ActionRowBuilder()
            .addComponents(
                ...this.dices.map((_, i) => 
                    new ButtonBuilder()
                        .setCustomId(`yams_dice_${i}`)
                        .setLabel(`Dé ${i + 1}`)
                        .setStyle(this.selectedDices.has(i) ? ButtonStyle.Success : ButtonStyle.Secondary)
                        .setDisabled(this.rolls === 3) 
                )
            );
    
        const actionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('yams_roll')
                    .setLabel('Lancer 🎲')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(this.rolls === 0),
                new ButtonBuilder()
                    .setCustomId('yams_score')
                    .setLabel('Marquer ✍️')
                    .setStyle(ButtonStyle.Success)
            );
    
        return [diceButtons, actionButtons];
    }

    validateScore(category) {
        const counts = Array(7).fill(0);
        for (const dice of this.dices) {
            counts[dice]++;
        }
    
        switch (category) {
            case 'as':
                const asScore = counts[1] * 1;
                return [asScore, true];
            case 'deux':
                const deuxScore = counts[2] * 2;
                return [deuxScore, true];
            case 'trois':
                const troisScore = counts[3] * 3;
                return [troisScore, true];
            case 'quatre':
                const quatreScore = counts[4] * 4;
                return [quatreScore, true];
            case 'cinq':
                const cinqScore = counts[5] * 5;
                return [cinqScore, true];
            case 'six':
                const sixScore = counts[6] * 6;
                return [sixScore, true];
            case 'brelan':
                const hasBrelan = counts.some(c => c >= 3);
                return [hasBrelan ? this.dices.reduce((a, b) => a + b, 0) : 0, hasBrelan];
            case 'carre':
                const hasCarre = counts.some(c => c >= 4);
                return [hasCarre ? this.dices.reduce((a, b) => a + b, 0) : 0, hasCarre];
            case 'full':
                const hasThree = counts.some(c => c === 3);
                const hasTwo = counts.some(c => c === 2);
                return [hasThree && hasTwo ? 25 : 0, hasThree && hasTwo];
            case 'petiteSuite':
                const hasPetiteSuite = this.checkStraight(4);
                return [hasPetiteSuite ? 30 : 0, hasPetiteSuite];
            case 'grandeSuite':
                const hasGrandeSuite = this.checkStraight(5);
                return [hasGrandeSuite ? 40 : 0, hasGrandeSuite];
            case 'yams':
                const hasYams = counts.some(c => c === 5);
                return [hasYams ? 50 : 0, hasYams];
            case 'chance':
                const chanceScore = this.dices.reduce((a, b) => a + b, 0);
                return [chanceScore, true];
            default:
                return [0, false];
        }
    }

    getScoreButtons(page = 0) {
        const currentPlayerScores = this.scores[this.currentPlayer === 1 ? 'player1' : 'player2'];
        const buttons = [];
        const categories = [
            ['as', 'As'], ['deux', 'Deux'], ['trois', 'Trois'],
            ['quatre', 'Quatre'], ['cinq', 'Cinq'], ['six', 'Six'],
            ['brelan', 'Brelan'], ['carre', 'Carré'], ['full', 'Full'],
            ['petiteSuite', 'Petite Suite'], ['grandeSuite', 'Grande Suite'],
            ['yams', 'Yams'], ['chance', 'Chance']
        ].filter(([key]) => currentPlayerScores[key] === null);

        const categoriesPerPage = 4;
        const startIdx = page * categoriesPerPage;
        const pageCategories = categories.slice(startIdx, startIdx + categoriesPerPage);
        
        // Créer des rangées de boutons pour chaque catégorie disponible
        // Rangée pour les catégories
        const categoryRow = new ActionRowBuilder();
        for (const [key, label] of pageCategories) {
            categoryRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`yams_score_${key}`)
                    .setLabel(label)
                    .setStyle(ButtonStyle.Secondary)
            );
        }
        buttons.push(categoryRow);

        // Rangée pour la navigation
        const navigationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('yams_prev_page')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('yams_cancel')
                    .setLabel('❌')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('yams_next_page')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled((page + 1) * categoriesPerPage >= categories.length)
            );
        buttons.push(navigationRow);

        return buttons;
    }

    calculateScore(category) {
        const [score, isValid] = this.validateScore(category);
        return isValid ? score : 0;
    }

    checkStraight(length) {
        const unique = [...new Set(this.dices)].sort((a, b) => a - b);
        let maxLength = 1;
        let currentLength = 1;
        for (let i = 1; i < unique.length; i++) {
            if (unique[i] === unique[i-1] + 1) {
                currentLength++;
                maxLength = Math.max(maxLength, currentLength);
            } else {
                currentLength = 1;
            }
        }
        return maxLength >= length;
    }

    getBotMove() {
        // Logique simple pour le bot
        // Le bot va essayer de maximiser son score
        let bestScore = 0;
        let bestCategory = null;

        const categories = Object.keys(this.scores.player2);
        for (const category of categories) {
            if (this.scores.player2[category] === null) {
                const score = this.calculateScore(category);
                if (score > bestScore) {
                    bestScore = score;
                    bestCategory = category;
                }
            }
        }

        return bestCategory;
    }

    checkGameEnd() {
        const p1Complete = Object.values(this.scores.player1).every(score => score !== null);
        const p2Complete = Object.values(this.scores.player2).every(score => score !== null);
        return p1Complete && p2Complete;
    }

    calculateTotalScore(player) {
        return Object.values(this.scores[player]).reduce((sum, score) => sum + (score || 0), 0);
    }

    createVictoryEmbed() {
        const p1Score = this.calculateTotalScore('player1');
        const p2Score = this.calculateTotalScore('player2');
        const winner = p1Score > p2Score ? 
            `<@${this.player1}>` : 
            (this.player2 === 'BOT' ? 'Le Bot' : `<@${this.player2}>`);

        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Fin de la partie !')
            .setDescription(`${winner} remporte la partie !`)
            .addFields(
                { name: 'Scores finaux', value: `<@${this.player1}>: ${p1Score}\n${this.player2 === 'BOT' ? 'Bot' : `<@${this.player2}>`}: ${p2Score}` },
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` },
                { name: 'Mode', value: this.gameMode === 'PVE' ? 'Contre le Bot' : 'Joueur contre Joueur' }
            );
    }
}

module.exports = {
    prefix: 'yams',

    async handleInteraction(interaction) {
        if (interaction.customId === 'yams') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Yams - Configuration')
                .addFields({ name: 'Mode de jeu', value: 'Choisissez votre adversaire' });
    
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('yams_pvp')
                        .setLabel('Joueur vs Joueur')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('yams_pve')
                        .setLabel('Contre le Bot')
                        .setStyle(ButtonStyle.Secondary)
                );
    
            await interaction.update({ embeds: [setupEmbed], components: [row] });
            return;
        }
    
        if (!interaction.customId.startsWith('yams_')) return;
    
        const action = interaction.customId.split('yams_')[1];
    
        switch(action) {
            case 'pvp':
                const pvpGame = new YamsGame();
                pvpGame.player1 = interaction.user.id;
                pvpGame.gameState = 'WAITING';
    
                const waitingEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Yams - En attente d\'un adversaire')
                    .setDescription('Quelqu\'un doit cliquer sur "Rejoindre" pour commencer la partie.')
                    .addFields({ name: 'Joueur 1', value: `<@${interaction.user.id}>` });
    
                const joinRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('yams_join')
                            .setLabel('Rejoindre')
                            .setStyle(ButtonStyle.Success)
                    );
    
                await interaction.update({ embeds: [waitingEmbed], components: [joinRow] });
                activeGames.set(interaction.message.id, pvpGame);
                break;
    
            case 'pve':
                const botGame = new YamsGame();
                botGame.player1 = interaction.user.id;
                botGame.player2 = 'BOT';
                botGame.gameMode = 'PVE';
                botGame.gameState = 'PLAYING';
                botGame.startTime = Date.now();
                
                await interaction.update({
                    embeds: [botGame.createGameEmbed()],
                    components: botGame.getGameButtons()
                });
                
                activeGames.set(interaction.message.id, botGame);
                break;
    
            case 'join':
                const joinGame = activeGames.get(interaction.message.id);
                if (!joinGame) return;
    
                if (interaction.user.id === joinGame.player1) {
                    return interaction.reply({
                        content: 'Vous ne pouvez pas rejoindre votre propre partie !',
                        ephemeral: true
                    });
                }
    
                joinGame.player2 = interaction.user.id;
                joinGame.gameMode = 'PVP';
                joinGame.gameState = 'PLAYING';
                joinGame.startTime = Date.now();
    
                await interaction.update({
                    embeds: [joinGame.createGameEmbed()],
                    components: joinGame.getGameButtons()
                });
                break;

            case 'roll':
                const rollGame = activeGames.get(interaction.message.id);
                if (!rollGame) return;

                if (interaction.user.id !== (rollGame.currentPlayer === 1 ? rollGame.player1 : rollGame.player2)) {
                    return interaction.reply({
                        content: 'Ce n\'est pas votre tour !',
                        ephemeral: true
                    });
                }

                rollGame.rollDices();
                await interaction.update({
                    embeds: [rollGame.createGameEmbed()],
                    components: rollGame.getGameButtons()
                });
                break;

            case 'dice_0':
            case 'dice_1':
            case 'dice_2':
            case 'dice_3':
            case 'dice_4':
                const diceGame = activeGames.get(interaction.message.id);
                if (!diceGame) return;

                if (interaction.user.id !== (diceGame.currentPlayer === 1 ? diceGame.player1 : diceGame.player2)) {
                    return interaction.reply({
                        content: 'Ce n\'est pas votre tour !',
                        ephemeral: true
                    });
                }

                const diceIndex = parseInt(action.split('_')[1]);
                if (diceGame.selectedDices.has(diceIndex)) {
                    diceGame.selectedDices.delete(diceIndex);
                } else {
                    diceGame.selectedDices.add(diceIndex);
                }

                await interaction.update({
                    embeds: [diceGame.createGameEmbed()],
                    components: diceGame.getGameButtons()
                });
                break;

            case 'score':
                const scoreGame = activeGames.get(interaction.message.id);
                if (!scoreGame) return;

                if (interaction.user.id !== (scoreGame.currentPlayer === 1 ? scoreGame.player1 : scoreGame.player2)) {
                    return interaction.reply({
                        content: 'Ce n\'est pas votre tour !',
                        ephemeral: true
                    });
                }

                await interaction.update({
                    embeds: [scoreGame.createGameEmbed()],
                    components: scoreGame.getScoreButtons(0)
                });
                break;

            case 'prev_page':
            case 'next_page':
                const navGame = activeGames.get(interaction.message.id);
                if (!navGame) return;
                
                const currentPage = parseInt(interaction.message.components[1]?.components[0]?.disabled ? 0 : 
                    interaction.message.components[1]?.components[2]?.disabled ? 2 : 1);
                
                const newPage = action === 'prev_page' ? currentPage - 1 : currentPage + 1;
                
                await interaction.update({
                    embeds: [navGame.createGameEmbed()],
                    components: navGame.getScoreButtons(newPage)
                });
                break;

            case 'cancel':
                const cancelGame = activeGames.get(interaction.message.id);
                if (!cancelGame) return;

                await interaction.update({
                    embeds: [cancelGame.createGameEmbed()],
                    components: cancelGame.getGameButtons()
                });
                break;

            default:
                if (action.startsWith('score_')) {
                    const category = action.split('score_')[1];
                    const game = activeGames.get(interaction.message.id);
                    if (!game) return;

                    if (interaction.user.id !== (game.currentPlayer === 1 ? game.player1 : game.player2)) {
                        return interaction.reply({
                            content: 'Ce n\'est pas votre tour !',
                            ephemeral: true
                        });
                    }

                    // Marquer le score
                    const score = game.calculateScore(category);
                    const playerKey = game.currentPlayer === 1 ? 'player1' : 'player2';
                    game.scores[playerKey][category] = score;

                    // Réinitialiser pour le prochain tour
                    game.rolls = 3;
                    game.selectedDices.clear();
                    game.dices = Array(5).fill().map(() => Math.floor(Math.random() * 6) + 1);

                    // Vérifier si la partie est terminée
                    if (game.checkGameEnd()) {
                        await interaction.update({
                            embeds: [game.createVictoryEmbed()],
                            components: []
                        });
                        activeGames.delete(interaction.message.id);
                        return;
                    }

                    // Changer de joueur
                    game.currentPlayer = game.currentPlayer === 1 ? 2 : 1;

                    // Si c'est le tour du bot
                    if (game.gameMode === 'PVE' && game.currentPlayer === 2) {
                        setTimeout(async () => {
                            // Le bot lance les dés
                            game.rollDices();
                            // Le bot choisit une catégorie
                            const botCategory = game.getBotMove();
                            // Marquer le score du bot
                            game.scores.player2[botCategory] = game.calculateScore(botCategory);

                            // Réinitialiser pour le prochain tour
                            game.rolls = 3;
                            game.selectedDices.clear();
                            game.dices = Array(5).fill().map(() => Math.floor(Math.random() * 6) + 1);
                            
                            // Vérifier si la partie est terminée
                            if (game.checkGameEnd()) {
                                await interaction.message.edit({
                                    embeds: [game.createVictoryEmbed()],
                                    components: []
                                });
                                activeGames.delete(interaction.message.id);
                                return;
                            }

                            // Passer au joueur suivant
                            game.currentPlayer = 1;
                            await interaction.message.edit({
                                embeds: [game.createGameEmbed()],
                                components: game.getGameButtons()
                            });
                        }, 1000);
                    }

                    await interaction.update({
                        embeds: [game.createGameEmbed()],
                        components: game.getGameButtons()
                    });
                }
                break;
        }
    }
};
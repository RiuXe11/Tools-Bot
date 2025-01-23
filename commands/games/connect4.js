const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map pour stocker les parties en cours
const activeGames = new Map();

class Connect4Game {
    constructor() {
        this.board = Array(6).fill().map(() => Array(7).fill('⚪'));
        this.currentPlayer = '🔴';
        this.currentColumn = 0;
        this.gameState = 'SETUP';
        this.player1 = null;
        this.player2 = null;
        this.gameMode = null;
        this.startTime = null;
        this.difficulty = 'easy';
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === '🔴' ? '🟡' : '🔴';
    }

    createGameEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Puissance 4')
            .setDescription(this.getGameState());

        if (this.gameState === 'PLAYING') {
            embed.addFields(
                { name: 'Tour', value: `C'est au tour de ${this.currentPlayer === '🔴' ? `<@${this.player1}>` : this.player2 === 'BOT' ? 'BOT' : `<@${this.player2}>`}` }
            );
            if (this.gameMode === 'PVE') {
                embed.addFields(
                    { name: 'Difficulté', value: this.difficulty }
                );
            }
        }

        return embed;
    }

    getGameState() {
        let boardString = '';
        const previewRow = Array(7).fill('⚪');
        if (this.gameState === 'PLAYING') {
            previewRow[this.currentColumn] = this.currentPlayer;
        }
        boardString += previewRow.join('') + '\n';
        
        for (let row of this.board) {
            boardString += row.join('') + '\n';
        }
        return boardString;
    }

    getGameButtons() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('connect4_left')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('connect4_right')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('connect4_place')
                    .setLabel('✅')
                    .setStyle(ButtonStyle.Success)
            );

        return [row];
    }

    // Ajouter la méthode de vérification de victoire
    checkWin(row, col) {
        const directions = [
            [[0, 1], [0, -1]],  // horizontal
            [[1, 0], [-1, 0]],  // vertical
            [[1, 1], [-1, -1]], // diagonal ↗↙
            [[1, -1], [-1, 1]]  // diagonal ↖↘
        ];

        for (const [dir1, dir2] of directions) {
            let count = 1;
            const player = this.board[row][col];

            // Vérifier dans la première direction
            count += this.countInDirection(row, col, dir1[0], dir1[1], player);
            // Vérifier dans la direction opposée
            count += this.countInDirection(row, col, dir2[0], dir2[1], player);

            if (count >= 4) return true;
        }
        return false;
    }

    countInDirection(row, col, dRow, dCol, player) {
        let count = 0;
        let currentRow = row + dRow;
        let currentCol = col + dCol;

        while (
            currentRow >= 0 && currentRow < 6 &&
            currentCol >= 0 && currentCol < 7 &&
            this.board[currentRow][currentCol] === player
        ) {
            count++;
            currentRow += dRow;
            currentCol += dCol;
        }

        return count;
    }

    // Modifier handleMove pour inclure la vérification de victoire
    handleMove(column) {
        for (let row = 5; row >= 0; row--) {
            if (this.board[row][column] === '⚪') {
                this.board[row][column] = this.currentPlayer;
                if (!this.startTime) this.startTime = Date.now();
                return { success: true, winningMove: this.checkWin(row, column) };
            }
        }
        return { success: false, winningMove: false };
    }

    // Ajouter une méthode pour le bot selon la difficulté
    getBotMove() {
        switch(this.difficulty) {
            case 'hard':
                return this.getHardBotMove();
            case 'medium':
                return this.getMediumBotMove();
            default:
                return this.getEasyBotMove();
        }
    }

    getEasyBotMove() {
        return Math.floor(Math.random() * 7);
    }

    getMediumBotMove() {
        // Cherche d'abord une victoire possible
        for (let col = 0; col < 7; col++) {
            let testGame = this.cloneBoard();
            if (testGame.handleMove(col).success && testGame.checkWin()) {
                return col;
            }
        }
        return this.getEasyBotMove();
    }

    getHardBotMove() {
        // Cherche une victoire ou bloque une victoire de l'adversaire
        for (let col = 0; col < 7; col++) {
            // Vérifier victoire
            let testGame = this.cloneBoard();
            if (testGame.handleMove(col).success && testGame.checkWin()) {
                return col;
            }
            
            // Vérifier blocage
            testGame = this.cloneBoard();
            testGame.currentPlayer = '🔴';
            if (testGame.handleMove(col).success && testGame.checkWin()) {
                return col;
            }
        }
        return this.getMediumBotMove();
    }

    cloneBoard() {
        const clone = new Connect4Game();
        clone.board = JSON.parse(JSON.stringify(this.board));
        clone.currentPlayer = this.currentPlayer;
        return clone;
    }

    createVictoryEmbed(winner) {
        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Victoire !')
            .setDescription(`${winner} a gagné la partie !`)
            .addFields(
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` },
                { name: 'Mode', value: this.gameMode === 'PVE' ? `Contre le Bot (${this.difficulty})` : 'Joueur contre Joueur' }
            );
    }
}

module.exports = {
    prefix: 'connect4',

    async handleInteraction(interaction) {
        if (interaction.customId === 'connect4') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Puissance 4 - Configuration')
                .addFields({ name: 'Mode de jeu', value: 'Choisissez votre adversaire' });
    
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('connect4_pvp')
                        .setLabel('Joueur vs Joueur')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('connect4_pve')
                        .setLabel('Contre le Bot')
                        .setStyle(ButtonStyle.Secondary)
                );
    
            await interaction.update({ embeds: [setupEmbed], components: [row] });
            return;
        }
    
        // Pour les autres interactions, on vérifie le préfixe
        if (!interaction.customId.startsWith('connect4_')) return;
    
        const action = interaction.customId.split('connect4_')[1];
    
        // Gestion des différentes actions
        switch(action) {
            // Choix du mode PVP ou PVE
            case 'pvp':
                const pvpGame = new Connect4Game();
                pvpGame.player1 = interaction.user.id;
                pvpGame.gameState = 'PLAYING';
    
                const waitingEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Puissance 4 - En attente d\'un adversaire')
                    .setDescription('Quelqu\'un doit cliquer sur "Rejoindre" pour commencer la partie.')
                    .addFields({ name: 'Joueur 1', value: `<@${interaction.user.id}>` });
    
                const joinRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('connect4_join')
                            .setLabel('Rejoindre')
                            .setStyle(ButtonStyle.Success)
                    );
    
                await interaction.update({ embeds: [waitingEmbed], components: [joinRow] });
                activeGames.set(interaction.message.id, pvpGame);
                break;
    
            case 'pve':
                const difficultyEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Puissance 4 - Choix de la difficulté')
                    .setDescription('Choisissez le niveau de difficulté du bot');
    
                const difficultyRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('connect4_difficulty_easy')
                            .setLabel('Facile')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('connect4_difficulty_medium')
                            .setLabel('Moyen')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('connect4_difficulty_hard')
                            .setLabel('Difficile')
                            .setStyle(ButtonStyle.Danger)
                    );
    
                await interaction.update({ embeds: [difficultyEmbed], components: [difficultyRow] });
                break;
    
            // Gestion du join
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
                joinGame.startTime = Date.now();
    
                await interaction.update({
                    embeds: [joinGame.createGameEmbed()],
                    components: joinGame.getGameButtons()
                });
                break;
    
            // Gestion des difficultés
            case 'difficulty_easy':
            case 'difficulty_medium':
            case 'difficulty_hard':
                const botGame = new Connect4Game();
                botGame.player1 = interaction.user.id;
                botGame.player2 = 'BOT';
                botGame.gameMode = 'PVE';
                botGame.gameState = 'PLAYING';
                botGame.difficulty = action.split('_')[1];
                botGame.startTime = Date.now();
                
                await interaction.update({
                    embeds: [botGame.createGameEmbed()],
                    components: botGame.getGameButtons()
                });
                
                activeGames.set(interaction.message.id, botGame);
                break;
    
            // Gestion des mouvements
            case 'left':
            case 'right':
            case 'place':
                const currentGame = activeGames.get(interaction.message.id);
                if (!currentGame) return;
    
                // Vérifier si c'est le tour du joueur
                const currentPlayerId = currentGame.currentPlayer === '🔴' ? currentGame.player1 : currentGame.player2;
                if (interaction.user.id !== currentPlayerId) {
                    return interaction.reply({
                        content: 'Ce n\'est pas votre tour !',
                        ephemeral: true
                    });
                }
    
                // Gestion des mouvements spécifiques
                switch(action) {
                    case 'left':
                        if (currentGame.currentColumn > 0) currentGame.currentColumn--;
                        break;
                    case 'right':
                        if (currentGame.currentColumn < 6) currentGame.currentColumn++;
                        break;
                    case 'place':
                        const moveResult = currentGame.handleMove(currentGame.currentColumn);
                        if (moveResult.success) {
                            if (moveResult.winningMove) {
                                const victoryEmbed = currentGame.createVictoryEmbed(
                                    currentGame.currentPlayer === '🔴' ? 
                                    `<@${currentGame.player1}>` : 
                                    currentGame.player2 === 'BOT' ? 'Le Bot' : `<@${currentGame.player2}>`
                                );
                                
                                await interaction.update({
                                    embeds: [victoryEmbed],
                                    components: []
                                });
                                
                                activeGames.delete(interaction.message.id);
                                return;
                            }
    
                            currentGame.switchPlayer();
    
                            // Tour du bot
                            if (currentGame.gameMode === 'PVE' && currentGame.currentPlayer === '🟡') {
                                setTimeout(async () => {
                                    let botColumn = currentGame.getBotMove();
                                    const botMoveResult = currentGame.handleMove(botColumn);
                                    
                                    if (botMoveResult.winningMove) {
                                        const victoryEmbed = currentGame.createVictoryEmbed('Le Bot');
                                        await interaction.message.edit({
                                            embeds: [victoryEmbed],
                                            components: []
                                        });
                                        activeGames.delete(interaction.message.id);
                                    } else {
                                        currentGame.switchPlayer();
                                        await interaction.message.edit({
                                            embeds: [currentGame.createGameEmbed()],
                                            components: currentGame.getGameButtons()
                                        });
                                    }
                                }, 1000);
                            }
                        }
                        break;
                }
    
                await interaction.update({
                    embeds: [currentGame.createGameEmbed()],
                    components: currentGame.getGameButtons()
                });
                break;
        }
    }
};
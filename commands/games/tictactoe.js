const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map pour stocker les parties en cours
const activeGames = new Map();

class TicTacToeGame {
    constructor() {
        this.board = Array(9).fill('⬜');
        this.currentPlayer = '❌';
        this.currentPosition = 0;
        this.gameState = 'SETUP';
        this.player1 = null;
        this.player2 = null;
        this.gameMode = null;
        this.startTime = null;
        this.difficulty = 'easy';
    }

    createGameEmbed() {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Morpion')
            .setDescription(this.getGameState());

        if (this.gameState === 'PLAYING') {
            embed.addFields(
                { name: 'Tour', value: `C'est au tour de ${this.currentPlayer === '❌' ? 
                    `<@${this.player1}>` : this.player2 === 'BOT' ? 'BOT' : `<@${this.player2}>`}` }
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
        const highlightedBoard = [...this.board];
        if (this.gameState === 'PLAYING') {
            highlightedBoard[this.currentPosition] = highlightedBoard[this.currentPosition] === '⬜' ? '🔵' : highlightedBoard[this.currentPosition];
        }
        
        // Afficher le plateau 3x3
        for (let i = 0; i < 9; i += 3) {
            boardString += highlightedBoard.slice(i, i + 3).join('') + '\n';
        }
        return boardString;
    }

    getGameButtons() {
        const buttons = [
            new ButtonBuilder()
                .setCustomId('tictactoe_left')
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('tictactoe_right')
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('tictactoe_up')
                .setLabel('⬆️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('tictactoe_down')
                .setLabel('⬇️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('tictactoe_place')
                .setLabel('✅')
                .setStyle(ButtonStyle.Success)
        ];

        return [new ActionRowBuilder().addComponents(buttons)];
    }

    handleMove(position) {
        if (this.board[position] === '⬜') {
            this.board[position] = this.currentPlayer;
            if (!this.startTime) this.startTime = Date.now();
            return { success: true, winningMove: this.checkWin() };
        }
        return { success: false, winningMove: false };
    }

    checkWin() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Horizontales
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Verticales
            [0, 4, 8], [2, 4, 6]             // Diagonales
        ];

        return winPatterns.some(pattern => {
            const [a, b, c] = pattern;
            return this.board[a] !== '⬜' && 
                   this.board[a] === this.board[b] && 
                   this.board[a] === this.board[c];
        });
    }

    isBoardFull() {
        return !this.board.includes('⬜');
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === '❌' ? '⭕' : '❌';
    }

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
        const availableMoves = this.board
            .map((cell, index) => cell === '⬜' ? index : null)
            .filter(index => index !== null);
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }

    getMediumBotMove() {
        // Vérifier s'il y a une possibilité de gagner
        const winningMove = this.findWinningMove('⭕');
        if (winningMove !== -1) return winningMove;
        return this.getEasyBotMove();
    }

    getHardBotMove() {
        // Vérifier d'abord une victoire possible
        const winningMove = this.findWinningMove('⭕');
        if (winningMove !== -1) return winningMove;

        // Bloquer une victoire de l'adversaire
        const blockingMove = this.findWinningMove('❌');
        if (blockingMove !== -1) return blockingMove;

        // Jouer au centre si possible
        if (this.board[4] === '⬜') return 4;

        // Jouer dans les coins
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(corner => this.board[corner] === '⬜');
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }

        return this.getEasyBotMove();
    }

    findWinningMove(symbol) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '⬜') {
                this.board[i] = symbol;
                if (this.checkWin()) {
                    this.board[i] = '⬜';
                    return i;
                }
                this.board[i] = '⬜';
            }
        }
        return -1;
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

    createDrawEmbed() {
        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🤝 Match Nul !')
            .setDescription('La partie se termine sur une égalité !')
            .addFields(
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` },
                { name: 'Mode', value: this.gameMode === 'PVE' ? `Contre le Bot (${this.difficulty})` : 'Joueur contre Joueur' }
            );
    }
}

module.exports = {
    prefix: 'tictactoe',
    
    async handleInteraction(interaction) {
        if (interaction.customId === 'tictactoe') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Morpion - Configuration')
                .addFields({ name: 'Mode de jeu', value: 'Choisissez votre adversaire' });
    
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tictactoe_pvp')
                        .setLabel('Joueur vs Joueur')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('tictactoe_pve')
                        .setLabel('Contre le Bot')
                        .setStyle(ButtonStyle.Secondary)
                );
    
            await interaction.update({ embeds: [setupEmbed], components: [row] });
            return;
        }
    
        if (!interaction.customId.startsWith('tictactoe_')) return;
    
        const action = interaction.customId.split('tictactoe_')[1];
    
        switch(action) {
            case 'pvp':
                const pvpGame = new TicTacToeGame();
                pvpGame.player1 = interaction.user.id;
                pvpGame.gameState = 'PLAYING';
    
                const waitingEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Morpion - En attente d\'un adversaire')
                    .setDescription('Quelqu\'un doit cliquer sur "Rejoindre" pour commencer la partie.')
                    .addFields({ name: 'Joueur 1', value: `<@${interaction.user.id}>` });
    
                const joinRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('tictactoe_join')
                            .setLabel('Rejoindre')
                            .setStyle(ButtonStyle.Success)
                    );
    
                await interaction.update({ embeds: [waitingEmbed], components: [joinRow] });
                activeGames.set(interaction.message.id, pvpGame);
                break;
    
            case 'pve':
                const difficultyEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Morpion - Choix de la difficulté')
                    .setDescription('Choisissez le niveau de difficulté du bot');
    
                const difficultyRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('tictactoe_difficulty_easy')
                            .setLabel('Facile')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('tictactoe_difficulty_medium')
                            .setLabel('Moyen')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('tictactoe_difficulty_hard')
                            .setLabel('Difficile')
                            .setStyle(ButtonStyle.Danger)
                    );
    
                await interaction.update({ embeds: [difficultyEmbed], components: [difficultyRow] });
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
                joinGame.startTime = Date.now();
    
                await interaction.update({
                    embeds: [joinGame.createGameEmbed()],
                    components: joinGame.getGameButtons()
                });
                break;
    
            case 'difficulty_easy':
            case 'difficulty_medium':
            case 'difficulty_hard':
                const botGame = new TicTacToeGame();
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
    
            case 'up':
            case 'down':
            case 'left':
            case 'right':
            case 'place':
                const currentGame = activeGames.get(interaction.message.id);
                if (!currentGame) return;
    
                const currentPlayerId = currentGame.currentPlayer === '❌' ? currentGame.player1 : currentGame.player2;
                if (interaction.user.id !== currentPlayerId) {
                    return interaction.reply({
                        content: 'Ce n\'est pas votre tour !',
                        ephemeral: true
                    });
                }
    
                // Gestion des mouvements
                switch(action) {
                    case 'up':
                        if (currentGame.currentPosition >= 3) 
                            currentGame.currentPosition -= 3;
                        break;
                    case 'down':
                        if (currentGame.currentPosition <= 5) 
                            currentGame.currentPosition += 3;
                        break;
                    case 'left':
                        if (currentGame.currentPosition % 3 !== 0) 
                            currentGame.currentPosition--;
                        break;
                    case 'right':
                        if (currentGame.currentPosition % 3 !== 2) 
                            currentGame.currentPosition++;
                        break;
                    case 'place':
                        const moveResult = currentGame.handleMove(currentGame.currentPosition);
                        if (moveResult.success) {
                            if (moveResult.winningMove) {
                                const victoryEmbed = currentGame.createVictoryEmbed(
                                    currentGame.currentPlayer === '❌' ? 
                                    `<@${currentGame.player1}>` : 
                                    currentGame.player2 === 'BOT' ? 'Le Bot' : `<@${currentGame.player2}>`
                                );
                                
                                await interaction.update({
                                    embeds: [victoryEmbed],
                                    components: []
                                });
                                
                                activeGames.delete(interaction.message.id);
                                return;
                            } else if (currentGame.isBoardFull()) {
                                const drawEmbed = currentGame.createDrawEmbed();
                                
                                await interaction.update({
                                    embeds: [drawEmbed],
                                    components: []
                                });
                                
                                activeGames.delete(interaction.message.id);
                                return;
                            }
    
                            currentGame.switchPlayer();
    
                            // Tour du bot
                            if (currentGame.gameMode === 'PVE' && currentGame.currentPlayer === '⭕') {
                                setTimeout(async () => {
                                    let botPosition = currentGame.getBotMove();
                                    const botMoveResult = currentGame.handleMove(botPosition);
                                    
                                    if (botMoveResult.winningMove) {
                                        const victoryEmbed = currentGame.createVictoryEmbed('Le Bot');
                                        await interaction.message.edit({
                                            embeds: [victoryEmbed],
                                            components: []
                                        });
                                        activeGames.delete(interaction.message.id);
                                    } else if (currentGame.isBoardFull()) {
                                        const drawEmbed = currentGame.createDrawEmbed();
                                        await interaction.message.edit({
                                            embeds: [drawEmbed],
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
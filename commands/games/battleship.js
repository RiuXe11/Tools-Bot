const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const BOARD_SIZE = 10;
const SHIPS = {
    'Porte-avions': 5,
    'Croiseur': 4,
    'Contre-torpilleur': 3,
    'Sous-marin': 3,
    'Torpilleur': 2
};

const activeGames = new Map();

class BattleshipGame {
    constructor() {
        this.player1 = {
            id: null,
            board: this.createEmptyBoard(),
            ships: this.createEmptyBoard(),
            currentShip: null,
            shipsToPlace: { ...SHIPS },
            isReady: false  // Ajouté ici
        };
        this.player2 = {
            id: null,
            board: this.createEmptyBoard(),
            ships: this.createEmptyBoard(),
            currentShip: null,
            shipsToPlace: { ...SHIPS },
            isReady: false  // Ajouté ici
        };
        this.currentPosition = { x: 0, y: 0 };
        this.orientation = 'horizontal';
        this.gameState = 'SETUP';
        this.currentPlayer = null;
        this.startTime = null;
        this.setupTimer = null;
        this.readyTimer = null;
    }

    createEmptyBoard() {
        return Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill('⬜'));
    }

    createGameEmbed(playerId) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🚢 Bataille Navale');
    
        const player = this.player1.id === playerId ? this.player1 : this.player2;
        const opponent = this.player1.id === playerId ? this.player2 : this.player1;
    
        if (this.gameState === 'SETUP') {
            embed.setDescription('Phase de placement des navires');
            
            // N'ajouter les champs que s'il y a des navires à placer
            if (Object.keys(player.shipsToPlace).length > 0) {
                embed.addFields(
                    { name: 'Navires à placer', value: this.getShipsToPlaceString(player.shipsToPlace) },
                    { name: 'Orientation', value: this.orientation === 'horizontal' ? '⬅️ Horizontale' : '⬆️ Verticale' }
                );
                
                if (player.currentShip) {
                    embed.addFields({ name: 'Navire actuel', value: `${player.currentShip} (${SHIPS[player.currentShip]} cases)` });
                }
            }
    
            // Toujours ajouter le plateau
            embed.addFields({ name: 'Plateau', value: this.getBoardString(player.ships, playerId) });
        } else if (this.gameState === 'PLAYING') {
            embed.setDescription(`Tour de ${this.currentPlayer === playerId ? 'votre tour' : "l'adversaire"}`)
                .addFields(
                    { name: 'Votre flotte', value: this.getBoardString(player.ships) },
                    { name: 'Vos tirs', value: this.getBoardString(player.board) }
                );
        }
    
        return embed;
    }

    convertCoordToPosition(coord) {
        // Convertit "A5" en {x: 4, y: 0}
        const letters = 'ABCDEFGHIJ';
        const y = letters.indexOf(coord.charAt(0).toUpperCase());
        const x = parseInt(coord.slice(1)) - 1;
        
        if (y === -1 || isNaN(x) || x < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
            return null;
        }
        
        return { x, y };
    }
    
    getBoardString(board, playerId) {
        // Modifions l'affichage pour utiliser des lettres
        let result = '⏺️1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟\n';
        const letters = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];
        
        for (let i = 0; i < BOARD_SIZE; i++) {
            result += letters[i];
            for (let j = 0; j < BOARD_SIZE; j++) {
                let cell = board[i][j];
                
                // Si on est en phase de setup, on montre la prévisualisation du bateau
                if (this.gameState === 'SETUP') {
                    const player = this.player1.id === playerId ? this.player1 : this.player2;
                    
                    if (player.currentShip) {
                        const shipLength = SHIPS[player.currentShip];
                        const isPartOfShip = this.orientation === 'horizontal' 
                            ? (i === this.currentPosition.y && j >= this.currentPosition.x && j < this.currentPosition.x + shipLength)
                            : (j === this.currentPosition.x && i >= this.currentPosition.y && i < this.currentPosition.y + shipLength);
    
                        if (isPartOfShip) {
                            const isValidPlacement = this.canPlaceShip(player, player.currentShip, this.currentPosition, this.orientation);
                            cell = isValidPlacement ? '🟦' : '🟥';  // Bleu si valide, rouge si invalide
                        }
                    }
                }
                result += cell;
            }
            result += '\n';
        }
        return result;
    }

    getShipsToPlaceString(ships) {
        return Object.entries(ships)
            .map(([name, size]) => `${name} (${size} cases)`)
            .join('\n');
    }

    getGameButtons(playerId) {
        if (this.gameState === 'SETUP') {
            const player = this.player1.id === playerId ? this.player1 : this.player2;

            const buttons = [
                new ButtonBuilder()
                    .setCustomId('battleship_left')
                    .setLabel('⬅️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('battleship_right')
                    .setLabel('➡️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('battleship_up')
                    .setLabel('⬆️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('battleship_down')
                    .setLabel('⬇️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('battleship_rotate')
                    .setLabel('🔄')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('battleship_place')
                    .setLabel('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('battleship_ready')
                    .setLabel('✅ Prêt')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(Object.keys(player.shipsToPlace).length > 0)
            ];
    
            const rows = [];
            for (let i = 0; i < buttons.length; i += 3) {
                rows.push(
                    new ActionRowBuilder()
                        .addComponents(buttons.slice(i, i + 3))
                );
            }
            return rows;
        } else if (this.gameState === 'PLAYING') {
            // En phase de jeu, juste un bouton pour ouvrir le modal de tir
            return [
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('battleship_shoot')
                            .setLabel('🎯 Tirer')
                            .setStyle(ButtonStyle.Danger)
                    )
            ];
        }
        return [];
    }

    startSetupTimer() {
        const duration = 180000; // 3 minutes
        const endTime = Date.now() + duration;
    
        this.setupTimer = setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            
            if (remaining === 0) {
                clearInterval(this.setupTimer);
                this.endGame('timeout');
            }
        }, 1000);
    }

    endGame(reason) {
        clearInterval(this.setupTimer);
        clearTimeout(this.readyTimer);
        
        if (reason === 'timeout') {
            // Créer un embed pour timeout
            return new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('⏰ Temps écoulé !')
                .setDescription('La partie est terminée car le temps de préparation est écoulé.');
        }
    }

    canPlaceShip(player, shipName, position, orientation) {
        const shipLength = SHIPS[shipName];
        const { x, y } = position;

        // Vérifier si le navire dépasse du plateau
        if (orientation === 'horizontal' && x + shipLength > BOARD_SIZE) return false;
        if (orientation === 'vertical' && y + shipLength > BOARD_SIZE) return false;

        // Vérifier s'il y a déjà un navire sur le chemin
        for (let i = 0; i < shipLength; i++) {
            const checkX = orientation === 'horizontal' ? x + i : x;
            const checkY = orientation === 'vertical' ? y + i : y;
            if (player.ships[checkY][checkX] !== '⬜') return false;
        }

        return true;
    }

    placeShip(player, shipName, position) {
        const shipLength = SHIPS[shipName];
        const { x, y } = position;

        for (let i = 0; i < shipLength; i++) {
            const placeX = this.orientation === 'horizontal' ? x + i : x;
            const placeY = this.orientation === 'vertical' ? y + i : y;
            player.ships[placeY][placeX] = '🚢';
        }

        delete player.shipsToPlace[shipName];
        return Object.keys(player.shipsToPlace).length === 0;
    }

    async placeBotShips() {
        const botPlayer = this.player2;
        for (const shipName of Object.keys(SHIPS)) {
            let placed = false;
            while (!placed) {
                const x = Math.floor(Math.random() * BOARD_SIZE);
                const y = Math.floor(Math.random() * BOARD_SIZE);
                this.orientation = Math.random() < 0.5 ? 'horizontal' : 'vertical';
                
                if (this.canPlaceShip(botPlayer, shipName, { x, y }, this.orientation)) {
                    this.placeShip(botPlayer, shipName, { x, y });
                    placed = true;
                }
            }
        }
    }

    getBotMove() {
        switch (this.difficulty) {
            case 'hard':
                return this.getHardBotMove();
            case 'medium':
                return this.getMediumBotMove();
            default:
                return this.getEasyBotMove();
        }
    }

    getEasyBotMove() {
        // Tir complètement aléatoire
        let x, y;
        do {
            x = Math.floor(Math.random() * BOARD_SIZE);
            y = Math.floor(Math.random() * BOARD_SIZE);
        } while (this.player2.board[y][x] !== '⬜');
        
        return { x, y };
    }

    getMediumBotMove() {
        // Vérifie s'il y a des navires touchés à cibler
        const hitPositions = [];
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (this.player2.board[y][x] === '💥') {
                    hitPositions.push({ x, y });
                }
            }
        }

        if (hitPositions.length > 0) {
            // Tire autour d'une position touchée
            const hitPos = hitPositions[Math.floor(Math.random() * hitPositions.length)];
            const directions = [
                { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
            ];

            for (const dir of directions) {
                const newX = hitPos.x + dir.dx;
                const newY = hitPos.y + dir.dy;
                
                if (newX >= 0 && newX < BOARD_SIZE && 
                    newY >= 0 && newY < BOARD_SIZE && 
                    this.player2.board[newY][newX] === '⬜') {
                    return { x: newX, y: newY };
                }
            }
        }

        return this.getEasyBotMove();
    }

    getHardBotMove() {
        // Utilise une heatmap pour cibler les zones probables
        const heatmap = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(0));
        
        // Augmente la probabilité autour des cases touchées
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (this.player2.board[y][x] === '💥') {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const newX = x + dx;
                            const newY = y + dy;
                            if (newX >= 0 && newX < BOARD_SIZE && 
                                newY >= 0 && newY < BOARD_SIZE && 
                                this.player2.board[newY][newX] === '⬜') {
                                heatmap[newY][newX] += 3;
                            }
                        }
                    }
                }
            }
        }

        // Trouve la meilleure position
        let bestValue = -1;
        let bestPositions = [];
        
        for (let y = 0; y < BOARD_SIZE; y++) {
            for (let x = 0; x < BOARD_SIZE; x++) {
                if (this.player2.board[y][x] === '⬜') {
                    if (heatmap[y][x] > bestValue) {
                        bestValue = heatmap[y][x];
                        bestPositions = [{ x, y }];
                    } else if (heatmap[y][x] === bestValue) {
                        bestPositions.push({ x, y });
                    }
                }
            }
        }

        return bestPositions[Math.floor(Math.random() * bestPositions.length)] || this.getEasyBotMove();
    }

    handleShot(shooter, target, position) {
        const { x, y } = position;
        
        if (target.ships[y][x] === '🚢') {
            shooter.board[y][x] = '💥';
            target.ships[y][x] = '💥';
            return true;
        } else {
            shooter.board[y][x] = '💧';
            return false;
        }
    }

    checkVictory(shooter) {
        const opponent = shooter === this.player1 ? this.player2 : this.player1;
        return !opponent.ships.some(row => row.includes('🚢'));
    }

    createVictoryEmbed(winnerId) {
        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Victoire !')
            .setDescription(`<@${winnerId}> a gagné la bataille navale !`)
            .addFields(
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` }
            );
    }
}

module.exports = {
    prefix: 'battleship',
    
    async handleInteraction(interaction) {
        const action = interaction.customId.split('battleship_')[1];
        const game = activeGames.get(interaction.message.id);
        const player = game ? (game.player1.id === interaction.user.id ? game.player1 : game.player2) : null;

        // Actions that don't require an existing game
        if (interaction.customId === 'battleship') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Bataille Navale - Configuration')
                .addFields({ name: 'Mode de jeu', value: 'Choisissez votre adversaire' });
        
            const modeRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('battleship_pvp')
                        .setLabel('Joueur vs Joueur')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('battleship_bot')
                        .setLabel('Contre le Bot')
                        .setStyle(ButtonStyle.Secondary)
                );
        
            await interaction.update({ embeds: [setupEmbed], components: [modeRow] });
            return;
        }

        if (action === 'bot') {
            const difficultyEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Bataille Navale - Difficulté du Bot')
                .setDescription('Choisissez le niveau de difficulté');
        
            const difficultyRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('battleship_difficulty_easy')
                        .setLabel('Facile')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('battleship_difficulty_medium')
                        .setLabel('Moyen')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('battleship_difficulty_hard')
                        .setLabel('Difficile')
                        .setStyle(ButtonStyle.Danger)
                );
        
            await interaction.update({ embeds: [difficultyEmbed], components: [difficultyRow] });
            return;
        }

        if (action === 'pvp') {
            const waitingEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Bataille Navale - En attente d\'un adversaire')
                .setDescription('Quelqu\'un doit cliquer sur "Rejoindre" pour commencer la partie.')
                .addFields({ name: 'Joueur 1', value: `<@${interaction.user.id}>` });
            
            const joinRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('battleship_join')
                        .setLabel('Rejoindre')
                        .setStyle(ButtonStyle.Success)
                );
            
            const newPvPGame = new BattleshipGame();
            newPvPGame.player1.id = interaction.user.id;
            activeGames.set(interaction.message.id, newPvPGame);
            
            await interaction.update({ embeds: [waitingEmbed], components: [joinRow] });
            return;
        }

        if (action.startsWith('difficulty_')) {
            const newBotGame = new BattleshipGame();
            newBotGame.player1.id = interaction.user.id;
            newBotGame.player2.id = 'BOT';
            newBotGame.gameState = 'SETUP';
            newBotGame.player1.currentShip = Object.keys(SHIPS)[0];
            newBotGame.difficulty = action.split('_')[1];
            
            // Démarrer le timer de 3 minutes
            newBotGame.startSetupTimer();
            
            // Le bot place automatiquement ses navires
            await newBotGame.placeBotShips();
            newBotGame.player2.isReady = true;
            
            // On met la partie dans le state
            activeGames.set(interaction.message.id, newBotGame);
        
            await interaction.update({
                content: "Placez vos navires ! Vous avez 3 minutes.",
                embeds: [newBotGame.createGameEmbed(interaction.user.id)],
                components: newBotGame.getGameButtons(interaction.user.id) 
            });
            return;
        }

        // For all other actions, we need an existing game
        if (!game) return;

        // Handle game-specific actions
        switch(action) {
            case 'ready':
                if (game.gameState !== 'SETUP') return;
                
                // Marquer le joueur comme prêt
                if (player === game.player1) {
                    game.player1.isReady = true;
                } else {
                    game.player2.isReady = true;
                }
            
                // Si les deux joueurs sont prêts (ou si c'est contre le bot)
                if (game.player1.isReady && (game.player2.isReady || game.player2.id === 'BOT')) {
                    await interaction.update({
                        content: "La partie commence dans 3 secondes...",
                        embeds: [game.createGameEmbed(interaction.user.id)],
                        components: []
                    });
            
                    setTimeout(async () => {
                        game.gameState = 'PLAYING';
                        game.currentPlayer = game.player1.id;
                        game.startTime = Date.now();
            
                        if (game.player2.id === 'BOT') {
                            await interaction.editReply({
                                content: "C'est parti ! C'est votre tour.",
                                embeds: [game.createGameEmbed(interaction.user.id)],
                                components: game.getGameButtons(interaction.user.id)
                            });
                        } else {
                            try {
                                const player1User = await interaction.client.users.fetch(game.player1.id);
                                const player2User = await interaction.client.users.fetch(game.player2.id);
            
                                await player1User.send({
                                    content: "C'est parti ! C'est votre tour.",
                                    embeds: [game.createGameEmbed(game.player1.id)],
                                    components: game.getGameButtons(game.player1.id)
                                });
            
                                await player2User.send({
                                    content: "C'est parti ! En attente du tour de l'adversaire.",
                                    embeds: [game.createGameEmbed(game.player2.id)],
                                    components: game.getGameButtons(game.player2.id)
                                });
                            } catch (error) {
                                console.error('Erreur lors de l\'envoi des messages privés:', error);
                            }
                        }
                    }, 3000);
                } else {
                    await interaction.update({
                        content: `${interaction.user.username} est prêt !`,
                        embeds: [game.createGameEmbed(interaction.user.id)],
                        components: game.getGameButtons(interaction.user.id)
                    });
                }
                break;

            case 'join':
                if (interaction.user.id === game.player1.id) {
                    return interaction.reply({
                        content: 'Vous ne pouvez pas rejoindre votre propre partie !',
                        ephemeral: true
                    });
                }
    
                game.player2.id = interaction.user.id;
                game.gameState = 'SETUP';
                game.player1.currentShip = Object.keys(SHIPS)[0];
                game.player2.currentShip = Object.keys(SHIPS)[0];
                game.startSetupTimer();
    
                await interaction.message.edit({
                    content: "La partie commence ! Vous avez 3 minutes pour placer vos navires.",
                    embeds: [game.createGameEmbed(game.player1.id)],
                    components: game.getGameButtons()
                });
                
                await interaction.user.send({ 
                    content: "C'est votre plateau de jeu. Placez vos navires !",
                    embeds: [game.createGameEmbed(game.player2.id)], 
                    components: game.getGameButtons() 
                });
                
                await interaction.reply({
                    content: "La partie commence ! Vérifiez vos messages privés pour placer vos navires.",
                    ephemeral: true
                });
                break;
    
            case 'rotate':
                if (game.gameState !== 'SETUP') return;
                game.orientation = game.orientation === 'horizontal' ? 'vertical' : 'horizontal';
                await interaction.update({ 
                    embeds: [game.createGameEmbed(interaction.user.id)], 
                    components: game.getGameButtons() 
                });
                break;
    
            case 'left':
            case 'right':
            case 'up':
            case 'down':
                if (action === 'left' && game.currentPosition.x > 0) game.currentPosition.x--;
                if (action === 'right' && game.currentPosition.x < BOARD_SIZE - 1) game.currentPosition.x++;
                if (action === 'up' && game.currentPosition.y > 0) game.currentPosition.y--;
                if (action === 'down' && game.currentPosition.y < BOARD_SIZE - 1) game.currentPosition.y++;
                
                await interaction.update({ 
                    embeds: [game.createGameEmbed(interaction.user.id)], 
                    components: game.getGameButtons() 
                });
                break;

            case 'place':
                if (game.gameState !== 'SETUP') return;
                
                let setupComplete = false;  // Définir la variable avant
                
                if (game.canPlaceShip(player, player.currentShip, game.currentPosition, game.orientation)) {
                    setupComplete = game.placeShip(player, player.currentShip, game.currentPosition);
                                
                    if (setupComplete) {
                        player.currentShip = null;
                    } else {
                        player.currentShip = Object.keys(player.shipsToPlace)[0];
                    }
                }
                
                await interaction.update({ 
                    embeds: [game.createGameEmbed(interaction.user.id)], 
                    components: game.getGameButtons(interaction.user.id),
                    content: setupComplete ? "Tous vos navires sont placés ! Cliquez sur Prêt quand vous voulez commencer." : null
                });
                break;

            case 'shoot':
                if (game.gameState !== 'PLAYING' || game.currentPlayer !== interaction.user.id) {
                    return interaction.reply({
                        content: "Ce n'est pas votre tour !",
                        ephemeral: true
                    });
                }
            
                const modal = new ModalBuilder()  // Changé de Modal à ModalBuilder
                    .setCustomId('battleship_modal_shoot')
                    .setTitle('Tirer sur une position')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('coord')
                                .setLabel('Coordonnées (ex: A5, B3)')
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder('Entrez les coordonnées (A-J)(1-10)')
                                .setRequired(true)
                        )
                    );
            
                await interaction.showModal(modal);
                break;
    
            case 'fire':
                if (game.gameState !== 'PLAYING' || game.currentPlayer !== interaction.user.id) {
                    return interaction.reply({
                        content: "Ce n'est pas votre tour !",
                        ephemeral: true
                    });
                }
    
                const shooter = game.player1.id === interaction.user.id ? game.player1 : game.player2;
                const target = game.player1.id === interaction.user.id ? game.player2 : game.player1;
    
                // Vérifier si la case a déjà été ciblée
                if (shooter.board[game.currentPosition.y][game.currentPosition.x] !== '⬜') {
                    return interaction.reply({
                        content: 'Cette case a déjà été ciblée !',
                        ephemeral: true
                    });
                }
    
                const hit = game.handleShot(shooter, target, game.currentPosition);
    
                if (game.checkVictory(shooter)) {
                    const victoryEmbed = game.createVictoryEmbed(interaction.user.id);
                    await interaction.update({
                        embeds: [victoryEmbed],
                        components: []
                    });
                    activeGames.delete(interaction.message.id);
                    return;
                }
    
                // Changer de joueur
                game.currentPlayer = target.id;
    
                if (target.id === 'BOT') {
                    // Tour du bot
                    setTimeout(async () => {
                        const botMove = game.getBotMove();
                        game.currentPosition = botMove;
                        const botHit = game.handleShot(target, shooter, botMove);
                        
                        if (game.checkVictory(target)) {
                            const victoryEmbed = game.createVictoryEmbed('BOT');
                            await interaction.editReply({
                                embeds: [victoryEmbed],
                                components: []
                            });
                            activeGames.delete(interaction.message.id);
                        } else {
                            game.currentPlayer = shooter.id;
                            await interaction.editReply({
                                embeds: [game.createGameEmbed(shooter.id)],
                                components: game.getGameButtons(),
                                content: botHit ? "💥 Le bot a touché un de vos navires !" : "💧 Le bot a raté son tir !"
                            });
                        }
                    }, 1000);
                }
    
                await interaction.update({ 
                    embeds: [game.createGameEmbed(interaction.user.id)], 
                    components: game.getGameButtons() 
                });
    
                await interaction.followUp({
                    content: hit ? '💥 Touché !' : '💧 Raté !',
                    ephemeral: true
                });
                break;
        }
    },

    async handleModalSubmit(interaction) {
        if (interaction.customId !== 'battleship_modal_shoot') return;

        const game = activeGames.get(interaction.message.id);
        if (!game) return;

        const coord = interaction.fields.getTextInputValue('coord');
        const position = game.convertCoordToPosition(coord);

        if (!position) {
            return interaction.reply({
                content: 'Coordonnées invalides ! Utilisez le format A5, B3, etc.',
                ephemeral: true
            });
        }

        const shooter = game.player1.id === interaction.user.id ? game.player1 : game.player2;
        const target = game.player1.id === interaction.user.id ? game.player2 : game.player1;

        if (shooter.board[position.y][position.x] !== '⬜') {
            return interaction.reply({
                content: 'Cette case a déjà été ciblée !',
                ephemeral: true
            });
        }

        const hit = game.handleShot(shooter, target, position);

        if (game.checkVictory(shooter)) {
            const victoryEmbed = game.createVictoryEmbed(interaction.user.id);
            await interaction.update({
                embeds: [victoryEmbed],
                components: []
            });
            activeGames.delete(interaction.message.id);
            return;
        }

        // Changer de joueur
        game.currentPlayer = target.id;

        if (target.id === 'BOT') {
            const botMove = game.getBotMove();
            const botHit = game.handleShot(target, shooter, botMove);
            
            if (game.checkVictory(target)) {
                const victoryEmbed = game.createVictoryEmbed('BOT');
                await interaction.update({
                    embeds: [victoryEmbed],
                    components: []
                });
                activeGames.delete(interaction.message.id);
            } else {
                game.currentPlayer = shooter.id;
                await interaction.update({
                    embeds: [game.createGameEmbed(shooter.id)],
                    components: game.getGameButtons(),
                    content: `Votre tir : ${hit ? '💥 Touché !' : '💧 Raté !'}\nBot : ${botHit ? '💥 Le bot a touché un de vos navires !' : '💧 Le bot a raté son tir !'}`
                });
            }
        } else {
            await interaction.update({
                embeds: [game.createGameEmbed(interaction.user.id)],
                components: game.getGameButtons()
            });

            await interaction.followUp({
                content: hit ? '💥 Touché !' : '💧 Raté !',
                ephemeral: true
            });
        }
    }
}
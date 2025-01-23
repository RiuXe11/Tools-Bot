const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Map pour stocker les parties en cours
const activeGames = new Map();

class HangmanGame {
    constructor() {
        this.word = '';
        this.guessedLetters = new Set();
        this.remainingAttempts = 6;
        this.gameState = 'SETUP';
        this.player = null;
        this.startTime = null;
        this.difficulty = 'easy';
        this.currentPage = 0;
        this.players = new Map();
        this.maxPlayers = 0; 
        this.currentWordMaster = null; 
        this.currentPlayer = null; 
        this.playerOrder = []; 
        this.usedWords = new Set(); 
        this.scores = new Map(); 
        this.waitingForWord = false; 
        this.round = 1;
        this.channelId = null;
        this.messageId = null;
        this.maxRounds = 0;
        
        // Dictionnaire de mots selon la difficulté
        this.words = {
            easy: ['CHAT', 'CHIEN', 'MAISON', 'ARBRE', 'FLEUR', 'LIVRE', 'TABLE'],
            medium: ['ORDINATEUR', 'TELEPHONE', 'VOITURE', 'MAGAZINE', 'MONTAGNE'],
            hard: ['ANTICONSTITUTIONNELLEMENT', 'EXTRAORDINAIRE', 'DEVELOPPER', 'PROGRAMMATION']
        };
    }

    createGameEmbed() {
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Pendu - Round ${this.round}/${this.maxRounds}`) // Ajout du nombre total de rounds
            .setDescription(this.getGameState());
    
        const infoEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Informations de jeu');
    
        if (this.waitingForWord) {
            // En attente du mot
            infoEmbed.addFields(
                { name: 'En attente', value: `<@${this.currentWordMaster}> doit choisir un mot` },
                { name: 'Progression', value: `Round ${this.round}/${this.maxRounds}` }
            );
        } else if (this.gameState === 'PLAYING') {
            // Pendant le jeu
            infoEmbed.addFields(
                { name: 'Tour de', value: `<@${this.currentPlayer}>` },
                { name: 'Maître du mot', value: `<@${this.currentWordMaster}>` },
                { name: 'Lettres utilisées', value: Array.from(this.guessedLetters).join(', ') || 'Aucune' },
                { name: 'Tentatives restantes', value: `${this.remainingAttempts}/6` },
                { name: 'Progression', value: `Round ${this.round}/${this.maxRounds}` }
            );
        }
    
        return [gameEmbed, infoEmbed];
    }

    createSetupEmbed() {
        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Configuration du Pendu Multijoueur')
            .setDescription('Choisissez le nombre de joueurs pour la partie')
            .addFields(
                { name: 'Joueurs', value: 'Entre 2 et 5 joueurs' }
            );
    }

    getSetupButtons() {
        const row = new ActionRowBuilder();
        for (let i = 2; i <= 5; i++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`hangman_players_${i}`)
                    .setLabel(`${i} joueurs`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        return [row];
    }

    createWaitingRoomEmbed() {
        const playersList = Array.from(this.players.keys())
            .map(playerId => `<@${playerId}>`)
            .join('\n');

        return new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Salle d\'attente')
            .setDescription(`Joueurs (${this.players.size}/${this.maxPlayers}):\n${playersList}`)
            .addFields(
                { name: 'En attente', value: `Il manque ${this.maxPlayers - this.players.size} joueur(s)` }
            );
    }

    async selectWordMaster() {
        const availablePlayers = this.playerOrder.filter(id => id !== this.currentWordMaster);
        this.currentWordMaster = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
        this.waitingForWord = true;
        return this.currentWordMaster;
    }

    setWord(word) {
        if (this.usedWords.has(word)) {
            return false;
        }
        this.word = word.toUpperCase();
        this.usedWords.add(this.word);
        this.waitingForWord = false;
        this.guessedLetters.clear();
        this.remainingAttempts = 6;
        return true;
    }

    nextPlayer() {
        const currentIndex = this.playerOrder.indexOf(this.currentPlayer);
        const nextIndex = (currentIndex + 1) % this.playerOrder.length;
        this.currentPlayer = this.playerOrder[nextIndex];
        if (this.currentPlayer === this.currentWordMaster) {
            this.currentPlayer = this.playerOrder[(nextIndex + 1) % this.playerOrder.length];
        }
        return this.currentPlayer;
    }

    guessLetter(letter, playerId) {
        this.guessedLetters.add(letter);
        const letterCount = this.word.split('').filter(l => l === letter).length;
        
        if (letterCount > 0) {
            if (playerId) { // Si un ID est fourni (mode PVP)
                const playerScore = this.scores.get(playerId);
                if (playerScore) {
                    playerScore.correctLetters += letterCount;
                    if (this.checkWin()) {
                        playerScore.correctWords += 1;
                    }
                }
            }
        } else {
            this.remainingAttempts--;
        }
    
        return {
            success: letterCount > 0,
            winningMove: this.checkWin(),
            losingMove: this.remainingAttempts === 0
        };
    }

    getGameState() {
        const hangmanStages = [
            '```\n  +---+\n      |\n      |\n      |\n     ===```',
            '```\n  +---+\n  O   |\n      |\n      |\n     ===```',
            '```\n  +---+\n  O   |\n  |   |\n      |\n     ===```',
            '```\n  +---+\n  O   |\n /|   |\n      |\n     ===```',
            '```\n  +---+\n  O   |\n /|\\  |\n      |\n     ===```',
            '```\n  +---+\n  O   |\n /|\\  |\n /    |\n     ===```',
            '```\n  +---+\n  O   |\n /|\\  |\n / \\  |\n     ===```'
        ];
    
        let display = '';
        
        // Afficher le pendu
        display += hangmanStages[6 - this.remainingAttempts] + '\n\n';
        
        // Afficher le mot
        if (this.word) {
            // Ajouter le mot avec '_' ou les lettres trouvées
            const wordDisplay = this.word.split('').map(letter => 
                this.guessedLetters.has(letter) ? letter : '_'
            ).join(' ');
            display += `\`${wordDisplay}\`\n`;  // Ajouter les backticks pour meilleur affichage
        }
    
        return display;
    }

    getGameButtons() {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const rows = [];
        
        // Définir quelle partie de l'alphabet afficher
        const startIndex = this.currentPage * 13; // 13 lettres par page
        const endIndex = startIndex + 13;
        const currentLetters = alphabet.slice(startIndex, endIndex);
        
        // Créer les rangées de boutons pour les lettres actuelles
        for (let i = 0; i < currentLetters.length; i += 5) {
            const row = new ActionRowBuilder();
            const rowLetters = currentLetters.slice(i, i + 5);
            
            rowLetters.forEach(letter => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hangman_letter_${letter}`)
                        .setLabel(letter)
                        .setStyle(this.guessedLetters.has(letter) ? ButtonStyle.Secondary : ButtonStyle.Primary)
                        .setDisabled(this.guessedLetters.has(letter))
                );
            });
            
            rows.push(row);
        }

        // Ajouter la rangée de navigation
        const navigationRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hangman_prev')
                    .setLabel('◀️ A-M')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('hangman_next')
                    .setLabel('N-Z ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(this.currentPage === 1)
            );
        
        rows.push(navigationRow);
        return rows;
    }

    startGame() {
        this.word = this.getRandomWord();
        this.gameState = 'PLAYING';
        this.startTime = Date.now();
    }

    getRandomWord() {
        const words = this.words[this.difficulty];
        return words[Math.floor(Math.random() * words.length)];
    }

    guessLetter(letter) {
        this.guessedLetters.add(letter);
        
        if (!this.word.includes(letter)) {
            this.remainingAttempts--;
        }
    
        return {
            success: true,
            winningMove: this.checkWin(),
            losingMove: this.remainingAttempts === 0
        };
    }

    checkWin() {
        return this.word.split('').every(letter => this.guessedLetters.has(letter));
    }

    createVictoryEmbed() {
        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🎉 Victoire !')
            .setDescription(`Félicitations ! Vous avez trouvé le mot : ${this.word}`)
            .addFields(
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` },
                { name: 'Tentatives restantes', value: `${this.remainingAttempts}/6` },
                { name: 'Difficulté', value: this.difficulty }
            );
    }

    createLeaderboardEmbed() {
        const sortedScores = Array.from(this.scores.entries())
            .sort(([, a], [, b]) => 
                (b.correctWords * 10 + b.correctLetters) - (a.correctWords * 10 + a.correctLetters)
            );

        const leaderboard = sortedScores.map(([playerId, score], index) => 
            `${index + 1}. <@${playerId}> - ${score.correctWords} mot(s), ${score.correctLetters} lettre(s)`
        ).join('\n');

        return new EmbedBuilder()
            .setColor('#ffd700')
            .setTitle('🏆 Classement Final')
            .setDescription(leaderboard);
    }

    createDefeatEmbed() {
        const timePlayed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timePlayed / 60);
        const seconds = timePlayed % 60;

        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('💀 Défaite !')
            .setDescription(`Dommage ! Le mot était : ${this.word}`)
            .addFields(
                { name: 'Temps de jeu', value: `${minutes}m ${seconds}s` },
                { name: 'Difficulté', value: this.difficulty }
            );
    }
}

module.exports = {
    prefix: 'hangman',
    activeGames,
    
    async handleInteraction(interaction) {
        // Gestion du menu initial du jeu
        if (!interaction.customId.startsWith('hangman_')) {
            if (interaction.customId === 'hangman') {
                const setupEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Pendu - Mode de jeu')
                    .setDescription('Choisissez votre mode de jeu');
     
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('hangman_mode_solo')
                            .setLabel('🤖 Contre le bot')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('hangman_mode_pvp')
                            .setLabel('👥 Multijoueur')
                            .setStyle(ButtonStyle.Success)
                    );
     
                await interaction.update({ embeds: [setupEmbed], components: [row] });
                return;
            }
            return;
        }
     
        const [, action, value] = interaction.customId.split('_');
        const currentGame = activeGames.get(interaction.message.id);
     
        switch (action) {
            // CONFIGURATION DES MODES DE JEU
            case 'mode':
                if (value === 'solo') {
                    const setupEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('Pendu - Configuration')
                        .addFields({ name: 'Difficulté', value: 'Choisissez le niveau de difficulté' });
     
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('hangman_difficulty_easy')
                                .setLabel('Facile')
                                .setStyle(ButtonStyle.Success),
                            new ButtonBuilder()
                                .setCustomId('hangman_difficulty_medium')
                                .setLabel('Moyen')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('hangman_difficulty_hard')
                                .setLabel('Difficile')
                                .setStyle(ButtonStyle.Danger)
                        );
     
                    await interaction.update({ embeds: [setupEmbed], components: [row] });
                } else if (value === 'pvp') {
                    const game = new HangmanGame();
                    const setupEmbed = game.createSetupEmbed();
                    const buttons = game.getSetupButtons();
                    await interaction.update({ embeds: [setupEmbed], components: buttons });
                }
                break;
     
            // CONFIGURATION MODE SOLO
            case 'difficulty':
                const soloGame = new HangmanGame();
                soloGame.player = interaction.user.id;
                soloGame.difficulty = value;
                soloGame.startGame();
     
                await interaction.update({
                    embeds: soloGame.createGameEmbed(),
                    components: soloGame.getGameButtons()
                });
     
                activeGames.set(interaction.message.id, soloGame);
                break;
     
            // CONFIGURATION MULTIJOUEUR
            case 'players':
                const pvpGame = new HangmanGame();
                pvpGame.maxPlayers = parseInt(value);
                pvpGame.maxRounds = parseInt(value); // Un round par joueur
                pvpGame.players.set(interaction.user.id, interaction.user);
                pvpGame.scores.set(interaction.user.id, { correctLetters: 0, correctWords: 0 });
     
                const joinButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('hangman_join')
                            .setLabel('Rejoindre')
                            .setStyle(ButtonStyle.Success)
                    );
     
                await interaction.update({
                    embeds: [pvpGame.createWaitingRoomEmbed()],
                    components: [joinButton]
                });
     
                activeGames.set(interaction.message.id, pvpGame);
                break;
     
            // GESTION DES JOUEURS QUI REJOIGNENT
            case 'join':
                if (currentGame.players.has(interaction.user.id)) {
                    return interaction.reply({
                        content: 'Vous êtes déjà dans la partie !',
                        ephemeral: true
                    });
                }
     
                currentGame.players.set(interaction.user.id, interaction.user);
                currentGame.scores.set(interaction.user.id, { correctLetters: 0, correctWords: 0 });
     
                if (currentGame.players.size === currentGame.maxPlayers) {
                    currentGame.playerOrder = Array.from(currentGame.players.keys());
                    currentGame.gameState = 'PLAYING';
                    currentGame.channelId = interaction.channelId;
                    currentGame.messageId = interaction.message.id;
                    const wordMaster = await currentGame.selectWordMaster();
                
                    await interaction.update({
                        embeds: currentGame.createGameEmbed(),
                        components: []
                    });
                
                    const wordMasterUser = await interaction.client.users.fetch(wordMaster);
                    await wordMasterUser.send('Envoyez un mot pour la partie de pendu !');
                } else {
                    await interaction.update({
                        embeds: [currentGame.createWaitingRoomEmbed()],
                        components: [interaction.message.components[0]]
                    });
                }
                break;
     
            // GESTION DES LETTRES JOUÉES
            case 'letter':
                if (!currentGame) return;
     
                if (currentGame.playerOrder.length > 0) {
                    if (interaction.user.id !== currentGame.currentPlayer) {
                        return interaction.reply({
                            content: 'Ce n\'est pas votre tour !',
                            ephemeral: true
                        });
                    }
                } else {
                    if (interaction.user.id !== currentGame.player) {
                        return interaction.reply({
                            content: 'Ce n\'est pas votre partie !',
                            ephemeral: true
                        });
                    }
                }
     
                const result = currentGame.guessLetter(value, interaction.user.id);
     
                if (result.winningMove || result.losingMove) {
                    if (currentGame.playerOrder.length > 0) {
                        // Mode PVP - On vérifie si c'est le dernier round
                        if (currentGame.round >= currentGame.maxRounds) {
                            // Partie terminée, afficher le classement final
                            await interaction.update({
                                embeds: [currentGame.createLeaderboardEmbed()],
                                components: []
                            });
                            activeGames.delete(interaction.message.id);
                            await interaction.followUp('🎮 Partie terminée ! Merci d\'avoir joué !');
                        } else {
                            // Prochain round
                            currentGame.round++;
                            await interaction.update({
                                embeds: [currentGame.createLeaderboardEmbed()],
                                components: []
                            });
     
                            // Démarrer le prochain round après un délai
                            setTimeout(async () => {
                                try {
                                    const wordMaster = await currentGame.selectWordMaster();
                                    const channel = await interaction.client.channels.fetch(currentGame.channelId);
                                    const message = await channel.messages.fetch(currentGame.messageId);
                                    
                                    await message.edit({
                                        embeds: currentGame.createGameEmbed(),
                                        components: []
                                    });
     
                                    const wordMasterUser = await interaction.client.users.fetch(wordMaster);
                                    await wordMasterUser.send('Envoyez un mot pour le prochain round !');
                                } catch (error) {
                                    console.error('Erreur lors du démarrage du nouveau round:', error);
                                }
                            }, 3000);
                        }
                    } else {
                        // Mode Solo
                        await interaction.update({
                            embeds: [result.winningMove ? currentGame.createVictoryEmbed() : currentGame.createDefeatEmbed()],
                            components: []
                        });
                        activeGames.delete(interaction.message.id);
                    }
                } else {
                    if (currentGame.playerOrder.length > 0) {
                        currentGame.currentPlayer = currentGame.nextPlayer();
                    }
                    await interaction.update({
                        embeds: currentGame.createGameEmbed(),
                        components: currentGame.getGameButtons()
                    });
                }
                break;
     
            // NAVIGATION DANS L'ALPHABET
            case 'prev':
            case 'next':
                if (!currentGame) return;
                currentGame.currentPage = action === 'prev' ? 0 : 1;
                await interaction.update({
                    embeds: currentGame.createGameEmbed(),
                    components: currentGame.getGameButtons()
                });
                break;
        }
     }
};
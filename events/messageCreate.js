const { PermissionFlagsBits } = require('discord.js');
const slowmode = require('../utils/slowmode');
const { handleMessage } = require('../utils/anonymeManager');
const { loadKeywords, applySanction, checkKeyword } = require('../commands/moderation/keyword');
const ServiceManager = require('../utils/serviceManager');
const { activeGames } = require('../commands/games/hangman');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        // Gérer les messages privés pour le jeu du pendu
        if (!message.guild) {
            // Chercher une partie active où l'utilisateur est word master
            const game = Array.from(activeGames.values())
                .find(g => g.currentWordMaster === message.author.id && g.waitingForWord);
        
            if (game) {
                const word = message.content.trim().toUpperCase();
                if (game.setWord(word)) {
                    game.currentPlayer = game.playerOrder.find(id => id !== game.currentWordMaster);
                    
                    // Récupérer le canal et le message du jeu
                    try {
                        // Trouver le message du jeu à mettre à jour
                        const channels = await message.client.channels.fetch(game.channelId);
                        const gameMessage = await channels.messages.fetch(game.messageId);
        
                        // Mettre à jour le message avec les nouveaux embeds et boutons
                        await gameMessage.edit({
                            embeds: game.createGameEmbed(),
                            components: game.getGameButtons()
                        });
        
                        await message.reply('Mot enregistré ! La partie peut commencer.');
                    } catch (error) {
                        console.error('Erreur lors de la mise à jour du message:', error);
                        await message.reply('Erreur lors du démarrage de la partie.');
                    }
                } else {
                    await message.reply('Ce mot a déjà été utilisé, veuillez en choisir un autre.');
                }
                return;
            }
        }
        
        // Gestion des messages anonymes uniquement dans un serveur
        if (message.guild) {
            await handleMessage(message);
            await ServiceManager.handleMessage(message);
        }
        
        // Vérification des mots-clés avant le check du préfixe
        try {
            const keywords = await loadKeywords();
            for (const keyword of keywords) {
                if (checkKeyword(message, keyword)) {
                    if (keyword.sanction) {
                        await applySanction(message, keyword);
                        if (keyword.sanction.type === 'Bannissement' || keyword.sanction.type === 'Expulsion') {
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification des mots-clés:', error);
        }

        // Si le message commence par le préfixe "!"
        if (!message.content.startsWith('!')) return;
        
        // Vérification du slowmode uniquement dans un serveur
        if (message.guild && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            const check = await slowmode.checkUserCooldown(message);
            if (!check.canSend) {
                try {
                    await message.delete();
                } catch (error) {
                    console.error('Impossible de supprimer le message:', error);
                }
                return;
            }
        }

        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = message.client.commands.get(commandName);
        if (!command) return;
        
        // Vérifier si la commande est autorisée en MP
        if (!command.dmPermission && !message.guild) {
            return message.reply('Cette commande ne peut être utilisée que sur un serveur.');
        }

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply('Une erreur est survenue lors de l\'exécution de la commande.');
        }
    },
};
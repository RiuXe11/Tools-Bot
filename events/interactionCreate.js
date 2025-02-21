const { InteractionType } = require('discord.js');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            // Récupérer le chemin du fichier de commande
            let commandPath;
            
            // Si c'est une interaction de bouton ou de menu
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                // Extraire le préfixe de l'ID personnalisé pour identifier la commande
                const prefix = interaction.customId.split('_')[0];
                
                // Mapper les préfixes aux chemins des fichiers
                const commandPaths = {
                    'connect4': '../commands/games/connect4.js',
                    'tictactoe': '../commands/games/tictactoe.js',
                    'battleship': '../commands/games/battleship.js',
                    'yams': '../commands/games/yams.js',
                    'fivem': '../commands/fivem/fivem.js',
                    'keyword': '../commands/moderation/keyword.js',
                    'service': '../utils/serviceManager.js',
                    'stats': '../commands/fivem/stats.js',
                    'PlayerTracker': '../utils/playerTracker.js',
                };
                
                commandPath = commandPaths[prefix];
            }
            
            if (commandPath) {
                const command = require(commandPath);
                if (command.handleInteraction) {
                    await command.handleInteraction(interaction);
                    return;
                }
            }

            // Gestion des soumissions de modal
            if (interaction.type === InteractionType.ModalSubmit) {
                const modalPrefix = interaction.customId.split('_')[0];
                const modalPaths = {
                    'connect4': '../commands/games/connect4.js',
                    'fivem': '../commands/fivem/fivem.js',
                    'battleship': '../commands/games/battleship.js',
                    'PlayerTracker': '../utils/playerTracker.js',
                };

                if (modalPaths[modalPrefix]) {
                    const modalHandler = require(modalPaths[modalPrefix]);
                    if (modalHandler.handleModalSubmit) {
                        await modalHandler.handleModalSubmit(interaction);
                        return;
                    }
                }
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
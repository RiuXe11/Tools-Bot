const { PermissionFlagsBits } = require('discord.js');
const slowmode = require('../utils/slowmode');
const { handleMessage } = require('../utils/anonymeManager');
const { loadKeywords, applySanction, checkKeyword } = require('../commands/moderation/keyword'); // Ajout de checkKeyword

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        
        // Gestion des messages anonymes (doit être avant le check du préfixe)
        await handleMessage(message);
        
        // Vérification des mots-clés avant le check du préfixe
        try {
            const keywords = await loadKeywords();
            // Vérifier chaque mot-clé
            for (const keyword of keywords) {
                if (checkKeyword(message, keyword)) { // Utilisation de la nouvelle fonction de vérification
                    // Appliquer la sanction si configurée
                    if (keyword.sanction) {
                        await applySanction(message, keyword);
                        // Si une sanction de type ban ou kick est appliquée, on arrête là
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
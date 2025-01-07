const { PermissionFlagsBits } = require('discord.js');
const slowmode = require('../utils/slowmode');
const { handleMessage } = require('../utils/anonymeManager');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        
        // Gestion des messages anonymes (doit être avant le check du préfixe)
        await handleMessage(message);
        
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
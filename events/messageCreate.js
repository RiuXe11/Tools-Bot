const { PermissionFlagsBits } = require('discord.js');
const slowmode = require('../utils/slowmode');
const { handleMessage } = require('../utils/anonymeManager');
const { loadKeywords, applySanction } = require('../commands/moderation/keyword');

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
                const regex = new RegExp(`\\b${keyword.keyword}\\b`, 'i');
                if (regex.test(message.content)) {
                    // Appliquer la sanction si configurée (avant la réaction et le message)
                    if (keyword.sanction) {
                        await applySanction(message, keyword);
                        // Si une sanction de type ban ou kick est appliquée, on arrête là
                        if (keyword.sanction.type === 'Bannissement' || keyword.sanction.type === 'Expulsion') {
                            return;
                        }
                    }

                    // Si une réaction est configurée, l'ajouter
                    if (keyword.reaction) {
                        try {
                            if (keyword.reaction.isCustom) {
                                const emoji = message.client.emojis.cache.get(keyword.reaction.id);
                                if (emoji) await message.react(emoji);
                            } else {
                                await message.react(keyword.reaction.name);
                            }
                        } catch (error) {
                            console.error('Erreur lors de l\'ajout de la réaction:', error);
                        }
                    }

                    // Envoyer la réponse configurée
                    if (keyword.message) {
                        await message.reply(keyword.message);
                    } else if (keyword.type === 'Embed' && keyword.description) {
                        const embed = {
                            title: keyword.title || 'Réponse automatique',
                            description: keyword.description,
                            color: keyword.color ? parseInt(keyword.color.replace('#', ''), 16) : null,
                            footer: keyword.footer ? { text: keyword.footer } : null,
                            timestamp: keyword.hasTimestamp ? new Date() : null
                        };
                        await message.reply({ embeds: [embed] });
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
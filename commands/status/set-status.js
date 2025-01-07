// commands/set-status.js
const fs = require('fs').promises;
const path = require('path');
const { ActivityType, PermissionFlagsBits } = require('discord.js');
const statusVariables = require('../../utils/statusVariables');
const statusManager = require('../../utils/statusManager');

module.exports = {
    name: 'set-status',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
        }

        const validTypes = ['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING'];
        const type = args[0]?.toUpperCase();
        const activity = args.slice(1).join(' ');

        if (!type || !activity || !validTypes.includes(type)) {
            return message.reply('❌ Usage: !set-status <PLAYING/WATCHING/LISTENING/COMPETING> <status>\n' +
                'Variables disponibles:\n' +
                '- {FivemMembersCount} : Nombre de joueurs connectés\n' +
                '- {FivemMaxMembers} : Nombre maximum de joueurs\n' +
                '- {FivemHostName} : Nom du serveur\n' +
                '- {FivemGameType} : Type de jeu\n' +
                '- {FivemMapName} : Nom de la map\n' +
                '- {FivemStatus} : Status du serveur');
        }

        try {
            // Sauvegarder le statut
            const statusPath = path.join(__dirname, '../../data/status.json');
            await fs.writeFile(statusPath, JSON.stringify({ type, activity }));

            // Mettre à jour le statut avec les variables
            const replacedActivity = statusVariables.replaceVariables(activity);
            await message.client.user.setActivity(replacedActivity, { 
                type: statusManager.mapActivityType(type)
            });

            // Configurer la mise à jour automatique
            statusVariables.onUpdate(async () => {
                const replacedActivity = statusVariables.replaceVariables(activity);
                await message.client.user.setActivity(replacedActivity, { 
                    type: statusManager.mapActivityType(type)
                });
            });

            message.reply(`✅ Statut mis à jour avec succès ! Il sera actualisé automatiquement.`);
        } catch (error) {
            console.error('Erreur lors de la mise à jour du statut:', error);
            message.reply('❌ Une erreur est survenue lors de la mise à jour du statut.');
        }
    },
};
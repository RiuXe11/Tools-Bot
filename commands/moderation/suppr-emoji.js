module.exports = {
    name: 'suppr-emoji',
    async execute(message, args) {
        // Vérifier que la commande est exécutée sur un serveur
        if (!message.guild) {
            return message.reply('❌ Cette commande ne peut être utilisée que sur un serveur.');
        }

        // Vérifier les permissions
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
        }

        try {
            // Récupérer tous les émojis du serveur
            const emojis = message.guild.emojis.cache;
            
            if (emojis.size === 0) {
                return message.reply('⚠️ Ce serveur ne contient aucun émoji.');
            }

            // Message initial
            const statusMsg = await message.reply(`🗑️ Début de la suppression de ${emojis.size} émojis...`);

            // Supprimer chaque émoji
            let deletedCount = 0;
            let failedCount = 0;

            for (const [, emoji] of emojis) {
                try {
                    await emoji.delete();
                    deletedCount++;
                } catch (error) {
                    console.error(`Erreur lors de la suppression de l'émoji ${emoji.name}:`, error);
                    failedCount++;
                }
            }

            // Mettre à jour le message avec le résultat
            await statusMsg.edit(
                `✅ Suppression terminée !\n` +
                `📊 Résultats :\n` +
                `- ${deletedCount} émojis supprimés avec succès\n` +
                `- ${failedCount} échecs de suppression`
            );

        } catch (error) {
            console.error('Erreur lors de la suppression des émojis:', error);
            message.reply('❌ Une erreur est survenue lors de la suppression des émojis.');
        }
    }
};
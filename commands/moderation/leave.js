const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'leave',
    dmPermission: true,
    async execute(message, args) {
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply('❌ Seul le propriétaire du bot peut utiliser cette commande.');
        }

        try {
            if (args[0]) {
                const guild = message.client.guilds.cache.get(args[0]);
                if (!guild) return message.reply('❌ Serveur non trouvé.');
                await guild.leave();
                return message.reply(`✅ J'ai quitté le serveur: ${guild.name}`);
            }

            const serverList = await Promise.all(
                message.client.guilds.cache.map(async guild => {
                    try {
                        const owner = await guild.fetchOwner();
                        return {
                            name: guild.name,
                            id: guild.id,
                            memberCount: guild.memberCount,
                            owner: owner.user.tag
                        };
                    } catch {
                        return {
                            name: guild.name,
                            id: guild.id,
                            memberCount: guild.memberCount,
                            owner: 'Inconnu'
                        };
                    }
                })
            );

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Liste des serveurs')
                .setDescription(serverList.map(server => 
                    `**${server.name}**\n` +
                    `ID: \`${server.id}\`\n` +
                    `Membres: ${server.memberCount}\n` +
                    `Propriétaire: ${server.owner}\n`
                ).join('\n'))
                .setFooter({ text: `Total: ${serverList.length} serveurs` })
                .setTimestamp();

            // Si la commande est exécutée dans un serveur
            if (message.guild) {
                try {
                    await message.author.send({ embeds: [embed] });
                    return message.reply('📬 Je vous ai envoyé la liste des serveurs en message privé.');
                } catch (error) {
                    return message.reply('❌ Je ne peux pas vous envoyer de message privé. Vérifiez vos paramètres de confidentialité.');
                }
            }
            
            // Si la commande est en MP
            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur:', error);
            await message.reply('❌ Une erreur est survenue.');
        }
    },
};
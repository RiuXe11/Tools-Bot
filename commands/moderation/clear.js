const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'clear',
    description: 'Supprime un nombre spécifié de messages',
    
    async execute(message, args) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTimestamp()
            .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL() });

        if (!message.member.permissions.has('ManageMessages')) {
            errorEmbed
                .setTitle('❌ Erreur de Permission')
                .setDescription('Vous n\'avez pas la permission de supprimer des messages.');
            return message.reply({ embeds: [errorEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        }

        if (!args[0]) {
            errorEmbed
                .setTitle('⚠️ Paramètre Manquant')
                .setDescription('Veuillez spécifier un nombre de messages à supprimer.\n- \`!clear [nombre]\` à vous de mettre le nombre souhaité.\n- \`!clear 10\` ici ça supprimera 10 messages !');
            return message.reply({ embeds: [errorEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        }

        const nombreMessages = parseInt(args[0]);

        if (isNaN(nombreMessages) || nombreMessages <= 0) {
            errorEmbed
                .setTitle('⚠️ Paramètre Invalide')
                .setDescription('Veuillez spécifier un nombre valide supérieur à 0.');
            return message.reply({ embeds: [errorEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        }

        try {
            await message.delete();

            const messages = await message.channel.bulkDelete(nombreMessages, true);
            
            const successEmbed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Messages Supprimés')
                .setDescription(`${messages.size} messages ont été supprimés avec succès.`)
                .setTimestamp()
                .setFooter({ text: message.author.tag, iconURL: message.author.displayAvatarURL() });

            const confirmation = await message.channel.send({ embeds: [successEmbed] });
            setTimeout(() => {
                confirmation.delete().catch(() => {});
            }, 5000);
            
        } catch (error) {
            console.error(error);
            
            errorEmbed
                .setTitle('❌ Erreur Technique')
                .setDescription('Impossible de supprimer les messages. Ils sont peut-être trop anciens (+ de 14 jours).');
            
            message.channel.send({ embeds: [errorEmbed] }).then(msg => {
                setTimeout(() => msg.delete().catch(() => {}), 5000);
            });
        }
    },
};
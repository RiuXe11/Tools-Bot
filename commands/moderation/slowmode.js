const { PermissionFlagsBits } = require('discord.js');
const slowmode = require('../../utils/slowmode');

module.exports = {
    name: 'slowmode',
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Vous devez être administrateur pour utiliser cette commande.');
        }

        if (!args[0] || (!args[0].toLowerCase() === 'off' && !args[1])) {
            return message.reply('❌ Utilisation : \`!slowmode #salon <durée/off>\`\n\n> ## Exemples :\n> - 1️⃣ \`!slowmode #general 1w\`\n> - 2️⃣ \`!slowmode #annonces off\`');
        }

        const channel = message.mentions.channels.first();
        if (!channel) {
            return message.reply('❌ Vous devez mentionner un salon valide (#salon).');
        }

        const durationArg = args[1] || args[0];

        if (durationArg.toLowerCase() === 'off') {
            slowmode.removeSlowMode(channel.id);
            return message.reply(`✅ Le slowmode a été désactivé pour ${channel}.`);
        }

        try {
            const duration = slowmode.parseDuration(durationArg);
            slowmode.setSlowMode(channel.id, duration);
            const formattedDuration = slowmode.formatTimeLeft(duration);
            message.reply(`✅ Slowmode configuré sur ${formattedDuration} pour ${channel}.`);
        } catch (error) {
            message.reply(`❌ ${error.message}`);
        }
    },
};
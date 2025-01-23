const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'game',
    description: 'Lancer un jeu',
    execute(message) {
        const gameEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎮 Liste des jeux disponibles')
            .setDescription('Choisissez un jeu pour commencer à jouer!')
            .addFields(
                { name: 'Puissance 4', value: 'Un jeu de stratégie classique où il faut aligner 4 jetons.' },
                { name: 'Morpion', value: 'Le célèbre jeu où il faut aligner 3 symboles.' },
                { name: 'Bataille Navale', value: 'Le jeu classique de guerre navale où il faut couler les bateaux adverses.' },
                { name: 'Pendu', value: 'Jeu où tu dois donner des lettres et deviner le mot caché !' }
            );

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('connect4')
                    .setLabel('Puissance 4')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('tictactoe')
                    .setLabel('Morpion')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('battleship')
                    .setLabel('Bataille Navale')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('hangman')
                    .setLabel('Pendu')
                    .setStyle(ButtonStyle.Primary)
            );

        return message.reply({
            embeds: [gameEmbed],
            components: [row]
        });
    }
};
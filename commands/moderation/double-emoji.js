const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    name: 'double-emoji',
    description: 'Analyse et nettoie les emojis dupliqués du serveur',
    
    async execute(message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ Cette commande est réservée aux administrateurs.');
        }

        try {
            const emojis = await message.guild.emojis.fetch();
            const emojiCount = new Map();
            let totalDuplicates = 0;

            // Compte les doublons
            emojis.forEach(emoji => {
                const key = emoji.name.toLowerCase();
                emojiCount.set(key, (emojiCount.get(key) || 0) + 1);
            });

            // Prépare les groupes d'emojis en double
            let duplicatesList = [];
            for (const [name, count] of emojiCount) {
                if (count > 1) {
                    const duplicates = [...emojis.values()].filter(e => e.name.toLowerCase() === name);
                    duplicatesList.push({ name, count, emojis: duplicates });
                    totalDuplicates += count - 1;
                }
            }

            if (duplicatesList.length === 0) {
                return message.reply('✅ Aucun emoji en double n\'a été trouvé !');
            }

            // Crée des groupes de 5 emojis maximum
            const groupSize = 5;
            const groups = [];
            for (let i = 0; i < duplicatesList.length; i += groupSize) {
                groups.push(duplicatesList.slice(i, i + groupSize));
            }

            // Envoie un embed pour chaque groupe
            const button = new ButtonBuilder()
                .setCustomId('start_cleaning')
                .setLabel('Nettoyer')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🧹');

            const row = new ActionRowBuilder().addComponents(button);

            // Premier message avec le total
            const summaryEmbed = new EmbedBuilder()
                .setColor('#FF5733')
                .setTitle('📊 Analyse des Emojis')
                .setDescription(`J'ai trouvé **${totalDuplicates}** emoji(s) en double à nettoyer.`)
                .setFooter({ text: 'Liste des doublons ci-dessous...' });

            let firstMessage = await message.reply({ embeds: [summaryEmbed] });

            // Variable pour stocker le message avec le bouton
            let interactionMessage;

            // Envoie chaque groupe dans un message séparé
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                let description = '';
                
                group.forEach(({ name, count, emojis }) => {
                    description += `**${count}× :** `;
                    emojis.forEach(emoji => description += `${emoji} `);
                    description += '\n';
                });

                const embed = new EmbedBuilder()
                    .setColor('#FF5733')
                    .setDescription(description)
                    .setFooter({ text: `Page ${i + 1}/${groups.length}` });

                if (i === groups.length - 1) {
                    // Dernier message avec le bouton
                    interactionMessage = await message.channel.send({ embeds: [embed], components: [row] });
                } else {
                    await message.channel.send({ embeds: [embed] });
                }
            }

            const collector = interactionMessage.createMessageComponentCollector({ 
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async interaction => {
                if (interaction.customId === 'start_cleaning' && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    await interaction.deferUpdate();

                    let processed = 0;
                    const button = ButtonBuilder
                        .from(interaction.message.components[0].components[0])
                        .setDisabled(true);

                    await interaction.message.edit({ components: [new ActionRowBuilder().addComponents(button)] });

                    for (const [name, count] of emojiCount) {
                        if (count > 1) {
                            const duplicateEmojis = [...emojis.values()]
                                .filter(e => e.name.toLowerCase() === name)
                                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

                            for (let i = 1; i < duplicateEmojis.length; i++) {
                                try {
                                    await duplicateEmojis[i].delete();
                                    processed++;

                                    const progress = Math.floor((processed / totalDuplicates) * 10);
                                    const progressBar = '🟦'.repeat(progress) + '⬜'.repeat(10 - progress);
                                    const percentage = Math.floor((processed / totalDuplicates) * 100);

                                    const updatedEmbed = new EmbedBuilder()
                                        .setColor('#FF5733')
                                        .setTitle('🧹 Nettoyage des Emojis')
                                        .setDescription(`Nettoyage en cours... ${percentage}% terminé\n*Je garde l'emoji original et supprime les copies.*`)
                                        .addFields(
                                            { name: 'Emojis traités', value: `${processed}/${totalDuplicates}`, inline: true },
                                            { name: 'Progression', value: `${progressBar} ${percentage}%`, inline: true },
                                            { name: 'Emoji en cours', value: `Traitement de ${duplicateEmojis[0]} (gardé)`, inline: false }
                                        )
                                        .setFooter({ text: 'Veuillez patienter...' })
                                        .setTimestamp();

                                    await interaction.message.edit({ embeds: [updatedEmbed] });
                                    await new Promise(resolve => setTimeout(resolve, 1500));
                                } catch (error) {
                                    console.error(`Erreur lors de la suppression de l'emoji ${duplicateEmojis[i].name}:`, error);
                                }
                            }
                        }
                    }

                    const finalEmbed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('✅ Nettoyage Terminé')
                        .setDescription(`Le nettoyage est terminé !\n\n**Résultats:**\n✨ ${processed} copies d'emojis ont été supprimées.\n*Les emojis originaux ont été conservés.*`)
                        .addFields(
                            { name: 'Progression', value: '🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦 100%', inline: true }
                        )
                        .setFooter({ text: 'Nettoyage terminé avec succès!' })
                        .setTimestamp();

                    await interaction.message.edit({ embeds: [finalEmbed], components: [] });
                } else {
                    await interaction.reply({ 
                        content: '❌ Seuls les administrateurs peuvent utiliser cette commande.', 
                        ephemeral: true 
                    });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && interactionMessage) {
                    const disabledButton = ButtonBuilder
                        .from(interactionMessage.components[0].components[0])
                        .setDisabled(true);

                    await interactionMessage.edit({ 
                        components: [new ActionRowBuilder().addComponents(disabledButton)],
                        embeds: [interactionMessage.embeds[0].setFooter({ text: 'Le temps pour nettoyer est écoulé. Utilisez à nouveau la commande.' })]
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Erreur dans la commande double-emoji:', error);
            return message.reply('Une erreur est survenue lors de l\'exécution de la commande.');
        }
    },
};
const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Création du dossier et du fichier si nécessaire
const dataDir = path.join(__dirname, '..', 'data', 'anonyme');
const channelsFile = path.join(dataDir, 'channels.json');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(channelsFile)) {
    fs.writeFileSync(channelsFile, '{}', 'utf-8');
}

// Map pour gérer les cooldowns
const cooldowns = new Map();

// Fonction pour lire les données
function readData() {
    try {
        const data = fs.readFileSync(channelsFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier:', error);
        return {};
    }
}

// Fonction pour sauvegarder les données
function saveData(data) {
    try {
        fs.writeFileSync(channelsFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error('Erreur lors de la sauvegarde du fichier:', error);
    }
}

// Fonction principale pour gérer la commande !anonyme
async function handleAnonymousCommand(message, args) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return message.reply('Vous n\'avez pas la permission de gérer les salons anonymes.');
    }

    // Si aucun argument, afficher le menu de configuration
    if (!args.length) {
        return showMainMenu(message);
    }

    const subCommand = args[0].toLowerCase();

    switch (subCommand) {
        case 'setup':
            return showSetupMenu(message);
        case 'config':
            return showChannelList(message);
        default:
            return message.reply('Commande invalide. Utilisez !anonyme pour voir les options disponibles.');
    }
}

// Fonction pour afficher le menu principal
async function showMainMenu(message) {
    const embed = new EmbedBuilder()
        .setTitle('📝 Système de Messages Anonymes')
        .setColor('#2F3136')
        .setDescription('Choisissez une action:')
        .addFields(
            { name: 'Configuration', value: 'Configurez un nouveau salon anonyme ou gérez les salons existants' }
        );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setup_menu')
                .setLabel('Configurer un salon')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('manage_channels')
                .setLabel('Gérer les salons')
                .setStyle(ButtonStyle.Secondary)
        );

    const msg = await message.channel.send({
        embeds: [embed],
        components: [row]
    });

    const filter = (interaction) => interaction.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ 
        filter, 
        time: 60000,
        componentType: ComponentType.Button 
    });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'setup_menu') {
            await showSetupMenu(message, interaction);
        } else if (interaction.customId === 'manage_channels') {
            await showChannelList(message, interaction);
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
            try {
                const disabledButtons = disableButtons(msg.components);
                await msg.edit({ components: disabledButtons });
            } catch (error) {
                console.error('Erreur lors de la désactivation des boutons:', error);
            }
        }
    });
}

// Fonction pour afficher le menu de configuration
async function showSetupMenu(message, interaction = null) {
    const embed = new EmbedBuilder()
        .setTitle('🔧 Configuration d\'un salon anonyme')
        .setColor('#2F3136')
        .setDescription('Pour configurer un salon en mode anonyme, mentionnez le salon dans votre réponse.\nExemple: #général')
        .setFooter({ text: 'Cette demande expirera dans 30 secondes' });

    const updateOrSend = interaction 
        ? interaction.update.bind(interaction)
        : message.channel.send.bind(message.channel);

    const setupMsg = await updateOrSend({
        embeds: [embed]
    });

    const filter = m => m.author.id === message.author.id && m.mentions.channels.size > 0;
    const collector = message.channel.createMessageCollector({ 
        filter, 
        time: 30000,
        max: 1
    });

    collector.on('collect', async m => {
        const channel = m.mentions.channels.first();
        try {
            await m.delete();
        } catch (error) {
            console.error('Impossible de supprimer le message:', error);
        }
        await setupAnonymousChannel(message, channel.id, { 
            update: async (content) => {
                if (setupMsg.editable) {
                    await setupMsg.edit(content);
                } else {
                    await message.channel.send(content);
                }
            }
        });
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('⏰ Temps écoulé. Aucun salon n\'a été mentionné.');
            
            if (setupMsg.editable) {
                await setupMsg.edit({ embeds: [timeoutEmbed] });
            }
        }
    });
}

// Fonction pour configurer un salon anonyme
async function setupAnonymousChannel(message, channelId, interaction) {
    const data = readData();
    const channelKey = `${message.guild.id}-${channelId}`;

    if (data[channelKey]) {
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('❌ Ce salon est déjà configuré comme anonyme.')],
            components: []
        });
        return;
    }

    data[channelKey] = {
        guildId: message.guild.id,
        channelId: channelId,
        settings: {
            deleteOriginal: true,
            showTimestamp: true,
            customPrefix: "Anonyme",
            allowFiles: false,
            allowReactions: true,
            cooldown: 0,
            maxLength: 2000,
            logsChannelId: null
        }
    };

    saveData(data);

    const embed = new EmbedBuilder()
        .setTitle('✅ Salon Anonyme Activé')
        .setColor('#00FF00')
        .setDescription(`Le salon <#${channelId}> est maintenant en mode anonyme.`)
        .addFields(
            { name: 'Configuration', value: 'Utilisez !anonyme config pour personnaliser les paramètres' }
        );

    await interaction.update({
        embeds: [embed],
        components: []
    });
}

// Fonction pour afficher la liste des salons configurés
async function showChannelList(message, interaction = null) {
    const data = readData();
    const guildChannels = Object.entries(data)
        .filter(([key]) => key.startsWith(message.guild.id))
        .map(([key, value]) => ({ key, ...value }));

    if (guildChannels.length === 0) {
        const noChannelsEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription('❌ Aucun salon anonyme n\'est configuré sur ce serveur.');

        if (interaction) {
            await interaction.update({ embeds: [noChannelsEmbed], components: [] });
        } else {
            await message.reply({ embeds: [noChannelsEmbed] });
        }
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('📋 Salons Anonymes')
        .setColor('#2F3136')
        .setDescription('Sélectionnez un salon à configurer:');

    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    for (const channel of guildChannels.slice(0, 24)) { // Max 24 pour laisser de la place pour "Retour"
        if (buttonCount % 5 === 0 && buttonCount !== 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }

        const channelObj = message.guild.channels.cache.get(channel.channelId);
        if (channelObj) {
            currentRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`config_${channel.channelId}`)
                    .setLabel(channelObj.name)
                    .setStyle(ButtonStyle.Secondary)
            );
            buttonCount++;
        }
    }

    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }

    // Ajout du bouton Retour
    const backRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_main')
                .setLabel('Retour')
                .setStyle(ButtonStyle.Danger)
        );
    rows.push(backRow);

    const updateOrSend = interaction 
        ? interaction.update.bind(interaction)
        : message.channel.send.bind(message.channel);

    const msg = await updateOrSend({
        embeds: [embed],
        components: rows
    });

    if (!msg) return; // En cas d'interaction.update

    const filter = (i) => i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ 
        filter, 
        time: 60000,
        componentType: ComponentType.Button
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'back_to_main') {
            // Supprimer le message en cours
            try {
                await msg.delete();
            } catch (error) {
                console.error('Erreur lors de la suppression du message:', error);
            }
            // Montrer le nouveau menu
            await showMainMenu(message);
            collector.stop();
            return;
        }

        const channelId = i.customId.replace('config_', '');
        await showChannelConfig(message, channelId, i);
        collector.stop();
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && msg && msg.editable) {
            try {
                const disabledButtons = disableButtons(msg.components);
                await msg.edit({ components: disabledButtons });
            } catch (error) {
                console.error('Erreur lors de la désactivation des boutons:', error);
            }
        }
    });
}

// Fonction pour afficher les options de configuration d'un salon
async function showChannelConfig(message, channelId, interaction) {
    const data = readData();
    const channelKey = `${message.guild.id}-${channelId}`;
    const channel = data[channelKey];

    if (!channel) {
        try {
            await interaction.update({
                embeds: [new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription('❌ Ce salon n\'est plus configuré comme anonyme.')],
                components: []
            });
        } catch (error) {
            if (error.code === 10062 || error.code === 'InteractionAlreadyReplied') {
                await message.channel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription('❌ Ce salon n\'est plus configuré comme anonyme.')]
                });
            }
        }
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`⚙️ Configuration: #${message.guild.channels.cache.get(channelId).name}`)
        .setColor('#2F3136')
        .addFields(
            { name: 'Supprimer messages', value: channel.settings.deleteOriginal ? '✅' : '❌', inline: true },
            { name: 'Horodatage', value: channel.settings.showTimestamp ? '✅' : '❌', inline: true },
            { name: 'Préfixe', value: channel.settings.customPrefix, inline: true },
            { name: 'Fichiers', value: channel.settings.allowFiles ? '✅' : '❌', inline: true },
            { name: 'Réactions', value: channel.settings.allowReactions ? '✅' : '❌', inline: true },
            { name: 'Cooldown', value: `${channel.settings.cooldown}s`, inline: true },
            { name: 'Salon des logs', value: channel.settings.logsChannelId ? `<#${channel.settings.logsChannelId}>` : 'Non configuré', inline: true }
        );

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`toggle_delete_${channelId}`)
                .setLabel('Messages')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`toggle_timestamp_${channelId}`)
                .setLabel('Horodatage')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`toggle_files_${channelId}`)
                .setLabel('Fichiers')
                .setStyle(ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`edit_prefix_${channelId}`)
                .setLabel('Préfixe')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`edit_cooldown_${channelId}`)
                .setLabel('Cooldown')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`edit_logs_${channelId}`)
                .setLabel('Logs')
                .setStyle(ButtonStyle.Secondary)
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`back_to_list`)
                .setLabel('Retour')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`disable_${channelId}`)
                .setLabel('Supprimer')
                .setStyle(ButtonStyle.Danger)
        );

    let configMessage;
    try {
        await interaction.update({
            embeds: [embed],
            components: [row1, row2, row3]
        });
        configMessage = interaction.message;
    } catch (error) {
        if (error.code === 10062 || error.code === 'InteractionAlreadyReplied') {
            configMessage = await message.channel.send({
                embeds: [embed],
                components: [row1, row2, row3]
            });
        } else {
            throw error;
        }
    }

    if (configMessage) {
        setupConfigCollector(message, configMessage, channelId);
    }
}

function setupConfigCollector(message, messageToCollect, channelId) {
    const filter = (i) => i.user.id === message.author.id;
    const collector = messageToCollect.createMessageComponentCollector({
        filter,
        time: 300000
    });

    collector.on('collect', async (i) => {
        try {
            const data = readData();
            const channelKey = `${message.guild.id}-${channelId}`;
            const channel = data[channelKey];

            if (!channel) {
                await i.update({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription('❌ Ce salon n\'est plus configuré comme anonyme.')],
                    components: []
                });
                collector.stop();
                return;
            }

            // Gérer les différentes interactions
            switch (i.customId) {
                case 'back_to_list':
                    await showChannelList(message, i);
                    collector.stop();
                    break;

                case `disable_${channelId}`:
                    delete data[channelKey];
                    saveData(data);
                    await i.update({
                        embeds: [new EmbedBuilder()
                            .setColor('#FF0000')
                            .setDescription(`✅ Le salon ${message.guild.channels.cache.get(channelId).name} n'est plus en mode anonyme.`)],
                        components: []
                    });
                    collector.stop();
                    break;

                case `toggle_delete_${channelId}`:
                case `toggle_timestamp_${channelId}`:
                case `toggle_files_${channelId}`:
                    const setting = i.customId.replace(`toggle_`, '').replace(`_${channelId}`, '');
                    const settingMap = {
                        'delete': 'deleteOriginal',
                        'timestamp': 'showTimestamp',
                        'files': 'allowFiles'
                    };
                    
                    channel.settings[settingMap[setting]] = !channel.settings[settingMap[setting]];
                    saveData(data);
                    
                    const embed = new EmbedBuilder()
                        .setTitle(`⚙️ Configuration: #${message.guild.channels.cache.get(channelId).name}`)
                        .setColor('#2F3136')
                        .addFields(
                            { name: 'Supprimer messages', value: channel.settings.deleteOriginal ? '✅' : '❌', inline: true },
                            { name: 'Horodatage', value: channel.settings.showTimestamp ? '✅' : '❌', inline: true },
                            { name: 'Préfixe', value: channel.settings.customPrefix, inline: true },
                            { name: 'Fichiers', value: channel.settings.allowFiles ? '✅' : '❌', inline: true },
                            { name: 'Réactions', value: channel.settings.allowReactions ? '✅' : '❌', inline: true },
                            { name: 'Cooldown', value: `${channel.settings.cooldown}s`, inline: true }
                        );

                    const row1 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`toggle_delete_${channelId}`)
                                .setLabel('Messages')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`toggle_timestamp_${channelId}`)
                                .setLabel('Horodatage')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`toggle_files_${channelId}`)
                                .setLabel('Fichiers')
                                .setStyle(ButtonStyle.Secondary)
                        );

                    const row2 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`edit_prefix_${channelId}`)
                                .setLabel('Préfixe')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId(`edit_cooldown_${channelId}`)
                                .setLabel('Cooldown')
                                .setStyle(ButtonStyle.Primary)
                        );

                    const row3 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('back_to_list')
                                .setLabel('Retour')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId(`disable_${channelId}`)
                                .setLabel('Supprimer')
                                .setStyle(ButtonStyle.Danger)
                        );

                    await i.update({
                        embeds: [embed],
                        components: [row1, row2, row3]
                    });
                    break;

                case `edit_prefix_${channelId}`:
                    await promptForPrefix(message, channelId, i);
                    collector.stop();
                    break;

                case `edit_logs_${channelId}`:
                    await promptForLogs(message, channelId, i);
                    collector.stop();
                    break;

                case `edit_cooldown_${channelId}`:
                    await promptForCooldown(message, channelId, i);
                    collector.stop();
                    break;

                case `disable_${channelId}`:
                    delete data[channelKey];
                    saveData(data);
                    try {
                        await messageToCollect.delete().catch(() => {});
                        await i.reply({
                            embeds: [new EmbedBuilder()
                                .setColor('#FF0000')
                                .setDescription(`✅ Le salon ${message.guild.channels.cache.get(channelId).name} n'est plus en mode anonyme.`)]
                        });
                    } catch (error) {
                        await message.channel.send({
                            embeds: [new EmbedBuilder()
                                .setColor('#FF0000')
                                .setDescription(`✅ Le salon ${message.guild.channels.cache.get(channelId).name} n'est plus en mode anonyme.`)]
                        });
                    }
                    collector.stop();
                    break;
            }
        } catch (error) {
            if (error.code === 10062) {
                // Interaction expirée, rafraîchir l'interface
                const msg = await message.channel.send(createConfigEmbed(message, channelId, data[channelKey]));
                setupConfigCollector(message, msg, channelId);
                collector.stop();
            } else {
                console.error('Erreur lors du traitement de l\'interaction:', error);
            }
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && messageToCollect.editable) {
            try {
                const disabledButtons = disableButtons(messageToCollect.components);
                await messageToCollect.edit({ components: disabledButtons });
            } catch (error) {
                console.error('Erreur lors de la désactivation des boutons:', error);
            }
        }
    });
}

function disableButtons(components) {
    return components.map(row => {
        // Créer une nouvelle ligne
        const newRow = new ActionRowBuilder();
        
        // Recréer chaque bouton avec le statut désactivé
        newRow.addComponents(
            row.components.map(button => {
                return ButtonBuilder.from(button).setDisabled(true);
            })
        );
        
        return newRow;
    });
}

// Fonction pour demander un nouveau préfixe
async function promptForPrefix(message, channelId, interaction) {
    const embed = new EmbedBuilder()
        .setTitle('✏️ Modification du préfixe')
        .setColor('#2F3136')
        .setDescription('Envoyez le nouveau préfixe dans le chat.\nVous avez 30 secondes pour répondre.\nTapez `cancel` pour annuler.');

    await interaction.update({
        embeds: [embed],
        components: []
    });

    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ 
        filter, 
        time: 30000,
        max: 1
    });

    collector.on('collect', async m => {
        if (m.content.toLowerCase() === 'cancel') {
            await showChannelConfig(message, channelId, interaction);
            return;
        }

        const data = readData();
        const channelKey = `${message.guild.id}-${channelId}`;
        if (data[channelKey]) {
            data[channelKey].settings.customPrefix = m.content;
            saveData(data);
        }

        try {
            await m.delete();
        } catch (error) {
            console.error('Impossible de supprimer le message:', error);
        }

        await showChannelConfig(message, channelId, interaction);
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('⏰ Temps écoulé. Aucun préfixe n\'a été défini.');
            
            await interaction.message.edit({
                embeds: [timeoutEmbed],
                components: []
            });

            setTimeout(async () => {
                await showChannelConfig(message, channelId, interaction);
            }, 2000);
        }
    });
}

// Fonction pour demander un nouveau cooldown
async function promptForCooldown(message, channelId, interaction) {
    const embed = new EmbedBuilder()
        .setTitle('⏱️ Modification du cooldown')
        .setColor('#2F3136')
        .setDescription('Envoyez le nouveau cooldown en secondes dans le chat.\nVous avez 30 secondes pour répondre.\nTapez `cancel` pour annuler.');

    await interaction.update({
        embeds: [embed],
        components: []
    });

    const filter = m => m.author.id === message.author.id;
    const collector = message.channel.createMessageCollector({ 
        filter, 
        time: 30000,
        max: 1
    });

    collector.on('collect', async m => {
        if (m.content.toLowerCase() === 'cancel') {
            await showChannelConfig(message, channelId, interaction);
            return;
        }

        const cooldown = parseInt(m.content);
        if (isNaN(cooldown) || cooldown < 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('❌ Le cooldown doit être un nombre positif.');
            
            await interaction.message.edit({
                embeds: [errorEmbed],
                components: []
            });

            setTimeout(async () => {
                await showChannelConfig(message, channelId, interaction);
            }, 2000);
            return;
        }

        const data = readData();
        const channelKey = `${message.guild.id}-${channelId}`;
        if (data[channelKey]) {
            data[channelKey].settings.cooldown = cooldown;
            saveData(data);
        }

        try {
            await m.delete();
        } catch (error) {
            console.error('Impossible de supprimer le message:', error);
        }

        await showChannelConfig(message, channelId, interaction);
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('⏰ Temps écoulé. Aucun cooldown n\'a été défini.');
            
            await interaction.message.edit({
                embeds: [timeoutEmbed],
                components: []
            });

            setTimeout(async () => {
                await showChannelConfig(message, channelId, interaction);
            }, 2000);
        }
    });
}

// Fonction pour gérer les messages dans les salons anonymes
async function handleMessage(message) {
    if (message.author.bot) return;

    const data = readData();
    const channelKey = `${message.guild.id}-${message.channel.id}`;
    const channel = data[channelKey];

    if (!channel) return;

    // Vérifier le cooldown
    if (channel.settings.cooldown > 0) {
        const key = `${message.author.id}-${message.channel.id}`;
        const cooldownExpiration = cooldowns.get(key);
        
        if (cooldownExpiration && Date.now() < cooldownExpiration) {
            const remainingTime = Math.ceil((cooldownExpiration - Date.now()) / 1000);
            try {
                const reply = await message.reply(`Merci d'attendre ${remainingTime} secondes avant d'envoyer un nouveau message.`);
                setTimeout(() => reply.delete().catch(() => {}), 5000);
            } catch (error) {
                console.error('Erreur cooldown:', error);
            }
            return;
        }

        cooldowns.set(key, Date.now() + (channel.settings.cooldown * 1000));
        setTimeout(() => cooldowns.delete(key), channel.settings.cooldown * 1000);
    }

    // Traitement des fichiers
    let attachments = [];
    if (message.attachments.size > 0) {
        if (!channel.settings.allowFiles) {
            try {
                const reply = await message.reply('Les pièces jointes ne sont pas autorisées dans ce salon.');
                setTimeout(() => reply.delete().catch(() => {}), 5000);
                if (channel.settings.deleteOriginal) {
                    await message.delete().catch(() => {});
                }
            } catch (error) {
                console.error('Erreur fichiers:', error);
            }
            return;
        }
        attachments = Array.from(message.attachments.values());
    }

    try {
        const embed = new EmbedBuilder()
            .setColor('#2F3136')
            .setDescription(message.content || '');

        if (channel.settings.showTimestamp) {
            embed.setTimestamp();
        }

        embed.setAuthor({ name: channel.settings.customPrefix });

        // Gestion améliorée des pièces jointes
        if (attachments.length > 0) {
            const imageAttachment = attachments.find(att => att.contentType?.startsWith('image/'));
            if (imageAttachment) {
                embed.setImage(imageAttachment.url);
            }
            
            const otherAttachments = attachments.filter(att => !att.contentType?.startsWith('image/'));
            if (otherAttachments.length > 0) {
                embed.addFields({
                    name: 'Pièces jointes',
                    value: otherAttachments.map(att => `[${att.name}](${att.url})`).join('\n')
                });
            }
        }

        // Envoi du message anonyme avec gestion des erreurs
        const anonymousMessage = await message.channel.send({ embeds: [embed] });

        // Logs avec gestion des erreurs
        if (channel.settings.logsChannelId) {
            try {
                const logsChannel = message.guild.channels.cache.get(channel.settings.logsChannelId);
                if (logsChannel) {
                    const logsEmbed = new EmbedBuilder()
                        .setTitle('Message Anonyme Envoyé')
                        .setColor('#2F3136')
                        .addFields(
                            { name: 'Auteur', value: `${message.author.tag} (${message.author.id})` },
                            { name: 'Salon', value: `${message.channel.name} (${message.channel.id})` },
                            { name: 'Message', value: message.content || '(pas de contenu)' }
                        )
                        .setTimestamp();

                    if (attachments.length > 0) {
                        logsEmbed.addFields({ 
                            name: 'Pièces jointes', 
                            value: attachments.map(a => `${a.name}: ${a.url}`).join('\n') 
                        });
                    }

                    await logsChannel.send({ embeds: [logsEmbed] });
                }
            } catch (error) {
                console.error('Erreur logs:', error);
            }
        }

        // Suppression du message original avec gestion des erreurs
        if (channel.settings.deleteOriginal) {
            try {
                await message.delete();
            } catch (error) {
                if (error.code !== 10008) {
                    console.error('Erreur suppression:', error);
                }
            }
        }

    } catch (error) {
        console.error('Erreur générale:', error);
        try {
            const errorMsg = await message.reply('Une erreur est survenue lors de l\'envoi du message anonyme.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 5000);
        } catch (e) {
            console.error('Erreur notification:', e);
        }
    }
}

async function promptForLogs(message, channelId, interaction) {
    // Récupérer les données actuelles pour afficher le statut des logs
    const data = readData();
    const channelKey = `${message.guild.id}-${channelId}`;
    const channel = data[channelKey];
    
    const currentLogs = channel.settings.logsChannelId ? 
        `Salon actuel : <#${channel.settings.logsChannelId}>` : 
        'Aucun salon de logs configuré';

    const embed = new EmbedBuilder()
        .setTitle('📝 Configuration des logs')
        .setColor('#2F3136')
        .setDescription(`${currentLogs}\n\nMentionnez le salon qui recevra les logs.\nTapez \`disable\` pour désactiver les logs.\nTapez \`cancel\` pour annuler.`);

    try {
        await interaction.update({
            embeds: [embed],
            components: []
        });
    } catch (error) {
        if (error.code === 'InteractionAlreadyReplied') {
            const msg = await message.channel.send({
                embeds: [embed],
                components: []
            });
            setupLogsCollector(message, channelId, msg);
            return;
        }
        throw error;
    }

    setupLogsCollector(message, channelId, interaction.message);
}

function setupLogsCollector(message, channelId, messageToCollect) {
    const filter = m => m.author.id === message.author.id && 
        (m.mentions.channels.size > 0 || ['cancel', 'disable'].includes(m.content.toLowerCase()));

    const collector = message.channel.createMessageCollector({ 
        filter, 
        time: 30000,
        max: 1
    });

    collector.on('collect', async m => {
        if (m.content.toLowerCase() === 'cancel') {
            try {
                await messageToCollect.delete().catch(() => {});
                showChannelConfig(message, channelId, {
                    update: async (content) => {
                        await message.channel.send(content);
                    }
                });
            } catch (error) {
                console.error('Erreur lors de l\'annulation:', error);
            }
            return;
        }

        const data = readData();
        const channelKey = `${message.guild.id}-${channelId}`;
        
        if (data[channelKey]) {
            if (m.content.toLowerCase() === 'disable') {
                data[channelKey].settings.logsChannelId = null;
            } else {
                const logsChannel = m.mentions.channels.first();
                data[channelKey].settings.logsChannelId = logsChannel.id;
            }
            saveData(data);
        }

        try {
            await m.delete();
        } catch (error) {
            console.error('Impossible de supprimer le message:', error);
        }

        try {
            await messageToCollect.delete().catch(() => {});
            showChannelConfig(message, channelId, {
                update: async (content) => {
                    await message.channel.send(content);
                }
            });
        } catch (error) {
            console.error('Erreur lors du retour à la configuration:', error);
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            const timeoutEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setDescription('⏰ Temps écoulé. Aucun salon n\'a été défini.');
            
            try {
                await messageToCollect.edit({ embeds: [timeoutEmbed], components: [] });
                setTimeout(async () => {
                    await messageToCollect.delete().catch(() => {});
                    showChannelConfig(message, channelId, {
                        update: async (content) => {
                            await message.channel.send(content);
                        }
                    });
                }, 2000);
            } catch (error) {
                console.error('Erreur lors de la gestion du timeout:', error);
            }
        }
    });
}

module.exports = {
    handleAnonymousCommand,
    handleMessage
};
// events/interactionCreate.js
const { 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const StreamManager = require('../utils/streamManager');
const { ChannelType } = require('discord.js');

const PLATFORMS = ['Twitch', 'YouTube', 'Kick', 'TikTok'];

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Gestion des boutons
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'stream_platform':
                    await handlePlatformButton(interaction);
                    break;
                case 'stream_channel':
                    await handleChannelButton(interaction);
                    break;
                case 'notification_channel':
                    await handleNotificationChannel(interaction);
                    break;
                case 'stream_message':
                    await handleMessageButton(interaction);
                    break;
                case 'edit_streamer':
                    await handleEditStreamer(interaction);
                    break;
                case 'delete_streamer':
                    await handleDeleteStreamer(interaction);
                    break;
                case 'confirm_delete':
                    await handleConfirmDelete(interaction);
                    break;
                case 'cancel_delete':
                    await handleCancelDelete(interaction);
                    break;
                case 'back_to_streamer':
                    await handleBackToStreamer(interaction);
                    break;
            }
        }
        // Gestion des modals
        else if (interaction.isModalSubmit()) {
            switch (interaction.customId) {
                case 'channel_modal':
                    await handleChannelModal(interaction);
                    break;
                case 'message_modal':
                    await handleMessageModal(interaction);
                    break;
                case 'notification_channel_modal':
                    await handleNotificationChannelModal(interaction);
                    break;
            }
        }
        // Gestion des menus de sélection
        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'streamers_select') {
                await handleStreamerSelect(interaction);
            }
        }

        else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'notification_channel_select') {
                await handleNotificationChannelSelect(interaction);
            }
        }
    }
};

async function handleNotificationChannelModal(interaction) {
    try {
        const channelMention = interaction.fields.getTextInputValue('channel_mention');
        
        // Extraire l'ID du salon de la mention (#channel -> ID)
        let channelId = channelMention.replace(/[<#>]/g, '').trim();
        
        // Si l'utilisateur a juste écrit le nom sans #, essayer de trouver le salon
        if (!/^\d+$/.test(channelId)) {
            const channelName = channelId.replace('#', '').toLowerCase();
            const channel = interaction.guild.channels.cache.find(
                ch => ch.name.toLowerCase() === channelName
            );
            if (channel) {
                channelId = channel.id;
            } else {
                throw new Error('Salon introuvable. Assurez-vous de mentionner le salon avec #');
            }
        }

        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            throw new Error('Salon introuvable');
        }

        // Vérifier que c'est un salon textuel
        if (channel.type !== ChannelType.GuildText) {
            throw new Error('Le salon doit être un salon textuel');
        }

        // Vérifier les permissions dans le salon
        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
            throw new Error('Je n\'ai pas les permissions nécessaires dans ce salon');
        }

        // Sauvegarder la configuration
        const streamer = await StreamManager.getStreamer(interaction.user.id);
        if (!streamer) {
            throw new Error('Veuillez d\'abord configurer votre chaîne de stream');
        }

        await StreamManager.setGuildNotification(interaction.guildId, interaction.user.id, channelId);

        // Confirmer la configuration
        await interaction.reply({
            content: `✅ Les notifications de stream seront envoyées dans ${channel.toString()}`,
            ephemeral: true
        });

        // Envoyer un message de test dans le salon
        await channel.send({
            content: `🔧 Ce salon recevra les notifications de stream de ${interaction.user.toString()}.`
        });

    } catch (error) {
        console.error('Erreur lors de la configuration du salon:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

// Gestion du bouton de plateforme
async function handlePlatformButton(interaction) {
    try {
        // Récupérer la plateforme actuelle depuis le texte du bouton
        const currentButton = interaction.message.components[0].components[0];
        const currentPlatform = currentButton.label.split(': ')[1];
        
        // Trouver la prochaine plateforme dans la rotation
        const currentIndex = PLATFORMS.indexOf(currentPlatform);
        const nextPlatform = PLATFORMS[(currentIndex + 1) % PLATFORMS.length];
        
        // Créer un nouveau bouton avec la nouvelle plateforme
            //
        const platformButton = new ButtonBuilder()
            .setCustomId('stream_platform')
            .setLabel(`Plateforme: ${nextPlatform}`) // ou streamer?.platform || 'Twitch' pour updateStreamersMenu
            .setStyle(ButtonStyle.Primary);
        
        const channelButton = new ButtonBuilder()
            .setCustomId('stream_channel')
            .setLabel('Définir la chaîne')
            .setStyle(ButtonStyle.Success);
        
        const notificationButton = new ButtonBuilder()
            .setCustomId('notification_channel')
            .setLabel('Salon')
            .setStyle(ButtonStyle.Secondary);
        
        const messageButton = new ButtonBuilder()
            .setCustomId('stream_message')
            .setLabel('Message')
            .setStyle(ButtonStyle.Secondary);

        // Récupérer les streamers et créer les options du menu
        const streamers = await StreamManager.getStreamers();
        let options = [];

        if (Object.keys(streamers).length > 0) {
            options = Object.values(streamers).map(streamer => ({
                label: streamer.channelName || 'Streamer sans nom',
                value: streamer.channelName || 'unknown',
                description: `${streamer.platform} - ${streamer.channelUrl}`.slice(0, 100)
            }));
        } else {
            options = [{
                label: 'Aucun streamer configuré',
                value: 'none',
                description: 'Utilisez les boutons ci-dessus pour configurer un streamer'
            }];
        }

        const streamersMenu = new StringSelectMenuBuilder()
            .setCustomId('streamers_select')
            .setPlaceholder('Sélectionner un streamer à modifier')
            .addOptions(options);

        // Créer les nouvelles rangées de composants
        const buttonsRow = new ActionRowBuilder().addComponents(platformButton, channelButton, notificationButton, messageButton);
        const menuRow = new ActionRowBuilder().addComponents(streamersMenu);
        
        // Sauvegarder la nouvelle plateforme si un streamer existe déjà
        const existingStreamer = await StreamManager.getStreamer(interaction.user.id);
        if (existingStreamer) {
            await StreamManager.updateStreamerPlatform(interaction.user.id, nextPlatform);
        }
        
        // Mettre à jour le message avec les nouveaux composants
        await interaction.update({ 
            components: [buttonsRow, menuRow] 
        });
        
        // Envoyer une confirmation
        await interaction.followUp({
            content: `✅ Plateforme changée pour ${nextPlatform}`,
            ephemeral: true
        });
    } catch (error) {
        console.error('Erreur lors du changement de plateforme:', error);
        await interaction.reply({
            content: '❌ Une erreur est survenue lors du changement de plateforme',
            ephemeral: true
        }).catch(console.error);
    }
}

// Gestion du bouton de chaîne
async function handleChannelButton(interaction) {
    try {
        // Récupérer la plateforme actuelle depuis le bouton de plateforme
        const platformButton = interaction.message.components[0].components[0];
        const currentPlatform = platformButton.label.split(': ')[1];
        
        const modal = new ModalBuilder()
            .setCustomId('channel_modal')
            .setTitle(`Configuration de la chaîne ${currentPlatform}`);
        
        let placeholder;
        switch (currentPlatform) {
            case 'Twitch':
                placeholder = 'https://twitch.tv/votre_chaine';
                break;
            case 'YouTube':
                placeholder = 'https://youtube.com/@votre_chaine';
                break;
            case 'Kick':
                placeholder = 'https://kick.com/votre_chaine';
                break;
            case 'TikTok':
                placeholder = 'https://tiktok.com/@votre_compte';
                break;
        }
        
        const channelInput = new TextInputBuilder()
            .setCustomId('channel_url')
            .setLabel(`URL de votre chaîne ${currentPlatform}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(placeholder)
            .setRequired(true);
            
        const nameInput = new TextInputBuilder()
            .setCustomId('channel_name')
            .setLabel('Nom d\'affichage de la chaîne')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nom affiché dans les annonces')
            .setRequired(true);

        // Récupérer le nom actuel s'il existe
        const streamer = await StreamManager.getStreamer(interaction.user.id);
        if (streamer?.channelName) {
            nameInput.setValue(streamer.channelName);
        } else {
            nameInput.setValue(interaction.user.username);
        }
        
        const firstRow = new ActionRowBuilder().addComponents(channelInput);
        const secondRow = new ActionRowBuilder().addComponents(nameInput);
        
        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal:', error);
        await interaction.reply({
            content: '❌ Une erreur est survenue lors de l\'ouverture du formulaire',
            ephemeral: true
        });
    }
}

// Gestion du bouton de message
async function handleMessageButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('message_modal')
        .setTitle('Configuration du message d\'annonce');
    
    const messageInput = new TextInputBuilder()
        .setCustomId('announcement_message')
        .setLabel('Message d\'annonce de stream')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Hey @everyone, je suis en live ! Venez me rejoindre !')
        .setRequired(true);
    
    const row = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

// Gestion du modal de chaîne
async function handleChannelModal(interaction) {
    const channelUrl = interaction.fields.getTextInputValue('channel_url');
    const channelName = interaction.fields.getTextInputValue('channel_name');
    
    try {
        // Récupérer la plateforme actuelle depuis le titre du modal
        const modalTitle = interaction.customId === 'channel_modal' ? interaction.message.components[0].components[0].label.split(': ')[1] : 'Twitch';
        
        let isValid = false;
        switch (modalTitle) {
            case 'Twitch':
                isValid = /^https?:\/\/(www\.)?twitch\.tv\/[\w\-]+\/?$/.test(channelUrl);
                break;
            case 'YouTube':
                isValid = /^https?:\/\/(www\.)?youtube\.com\/@[\w\-]+\/?$/.test(channelUrl);
                break;
            case 'Kick':
                isValid = /^https?:\/\/(www\.)?kick\.com\/[\w\-]+\/?$/.test(channelUrl);
                break;
            case 'TikTok':
                isValid = /^https?:\/\/(www\.)?tiktok\.com\/@[\w\-]+\/?$/.test(channelUrl);
                break;
        }
        
        if (!isValid) {
            throw new Error(`L'URL n'est pas une URL ${modalTitle} valide`);
        }
        
        // Sauvegarder les informations
        await StreamManager.saveStreamer(interaction.user.id, {
            channelUrl,
            channelName,
            platform: modalTitle,
            isCurrentlyLive: false,
            lastCheck: null,
            message: null
        });
        
        await interaction.reply({
            content: '✅ Chaîne configurée avec succès !',
            ephemeral: true
        });
        
        // Mettre à jour le menu des streamers
        await updateStreamersMenu(interaction);
        
    } catch (error) {
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        }).catch(console.error);
    }
}

// Gestion du modal de message
async function handleMessageModal(interaction) {
    const message = interaction.fields.getTextInputValue('announcement_message');
    
    try {
        await StreamManager.updateStreamerMessage(interaction.user.id, message);
        
        await interaction.reply({
            content: '✅ Message d\'annonce configuré avec succès !',
            ephemeral: true
        });
    } catch (error) {
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

// Gestion de la sélection d'un streamer
async function handleStreamerSelect(interaction) {
    const selectedStreamer = await StreamManager.getStreamerByName(interaction.values[0]);
    
    if (!selectedStreamer) {
        await interaction.reply({
            content: '❌ Streamer non trouvé',
            ephemeral: true
        });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle(`Configuration de ${selectedStreamer.channelName}`)
        .setDescription('Informations du streamer')
        .addFields(
            { name: 'Plateforme', value: selectedStreamer.platform, inline: true },
            { name: 'URL', value: selectedStreamer.channelUrl, inline: true },
            { name: 'Message d\'annonce', value: selectedStreamer.message || 'Non configuré', inline: false }
        )
        .setColor('#9146FF');
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('edit_streamer')
                .setLabel('Modifier')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('delete_streamer')
                .setLabel('Supprimer')
                .setStyle(ButtonStyle.Danger)
        );
    
    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

// Fonction utilitaire pour mettre à jour le menu des streamers
async function updateStreamersMenu(interaction) {
    try {
        const streamers = await StreamManager.getStreamers();
        const streamer = await StreamManager.getStreamer(interaction.user.id);
        
        // Recréer les boutons existants
        const platformButton = new ButtonBuilder()
            .setCustomId('stream_platform')
            .setLabel(`Plateforme: ${streamer?.platform || 'Twitch'}`)
            .setStyle(ButtonStyle.Primary);

        const channelButton = new ButtonBuilder()
            .setCustomId('stream_channel')
            .setLabel('Définir la chaîne')
            .setStyle(ButtonStyle.Success);

        const notificationButton = new ButtonBuilder()
            .setCustomId('notification_channel')
            .setLabel('Salon')
            .setStyle(ButtonStyle.Secondary);

        const messageButton = new ButtonBuilder()
            .setCustomId('stream_message')
            .setLabel('Message')
            .setStyle(ButtonStyle.Secondary);

        // Créer les options du menu
        let options = [];

        if (Object.keys(streamers).length > 0) {
            options = Object.values(streamers).map(streamer => ({
                label: streamer.channelName || 'Streamer sans nom',
                value: streamer.channelName || 'unknown',
                description: `${streamer.platform} - ${streamer.channelUrl}`.slice(0, 100)
            }));
        } else {
            options = [{
                label: 'Aucun streamer configuré',
                value: 'none',
                description: 'Utilisez les boutons ci-dessus pour configurer un streamer'
            }];
        }

        // Créer le nouveau menu
        const streamersMenu = new StringSelectMenuBuilder()
            .setCustomId('streamers_select')
            .setPlaceholder('Sélectionner un streamer à modifier')
            .addOptions(options);

        // Créer les nouvelles rangées de composants
        const buttonsRow = new ActionRowBuilder().addComponents(
            platformButton,
            channelButton,
            notificationButton,
            messageButton
        );
        const menuRow = new ActionRowBuilder().addComponents(streamersMenu);

        // Mettre à jour le message
        await interaction.message.edit({ 
            components: [buttonsRow, menuRow] 
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du menu:', error);
    }
}

async function handleNotificationChannel(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('notification_channel_modal')
            .setTitle('Configuration du salon de notification');

        const channelInput = new TextInputBuilder()
            .setCustomId('channel_mention')
            .setLabel('Salon de notification')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Mentionnez le salon avec # (exemple: #annonces)')
            .setRequired(true);

        const firstRow = new ActionRowBuilder().addComponents(channelInput);
        modal.addComponents(firstRow);

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal:', error);
        await interaction.reply({
            content: '❌ Une erreur est survenue lors de la configuration du salon',
            ephemeral: true
        });
    }
}

async function handleNotificationChannelSelect(interaction) {
    try {
        const channelId = interaction.values[0];
        const channel = interaction.guild.channels.cache.get(channelId);
        
        if (!channel) {
            throw new Error('Salon introuvable');
        }

        // Vérifier les permissions dans le salon
        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has('SendMessages') || !permissions.has('ViewChannel')) {
            throw new Error('Je n\'ai pas les permissions nécessaires dans ce salon');
        }

        // Sauvegarder la configuration
        const streamer = await StreamManager.getStreamer(interaction.user.id);
        if (!streamer) {
            throw new Error('Veuillez d\'abord configurer votre chaîne de stream');
        }

        await StreamManager.setGuildNotification(interaction.guildId, interaction.user.id, channelId);

        // Confirmer la configuration
        await interaction.update({
            content: `✅ Les notifications de stream seront envoyées dans ${channel.toString()}`,
            components: [],
            ephemeral: true
        });

        // Envoyer un message de test dans le salon
        await channel.send({
            content: `🔧 Ce salon recevra les notifications de stream de ${interaction.user.toString()}.`,
            ephemeral: false
        });

    } catch (error) {
        console.error('Erreur lors de la configuration du salon:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        }).catch(() => {
            interaction.editReply({
                content: `❌ Erreur: ${error.message}`,
                components: []
            });
        });
    }
}

async function handleEditStreamer(interaction) {
    try {
        const embed = interaction.message.embeds[0];
        const streamerName = embed.title.replace('Configuration de ', '');
        const streamer = await StreamManager.getStreamerByName(streamerName);

        if (!streamer) {
            throw new Error('Streamer non trouvé');
        }

        // Créer les boutons d'édition
        const editButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_platform')
                    .setLabel('Modifier la plateforme')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('edit_channel')
                    .setLabel('Modifier la chaîne')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('edit_message')
                    .setLabel('Modifier le message')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('back_to_streamer')
                    .setLabel('Retour')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.update({
            components: [editButtons],
        });
    } catch (error) {
        console.error('Erreur lors de la modification du streamer:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleDeleteStreamer(interaction) {
    try {
        const embed = interaction.message.embeds[0];
        const streamerName = embed.title.replace('Configuration de ', '');
        const streamer = await StreamManager.getStreamerByName(streamerName);

        if (!streamer) {
            throw new Error('Streamer non trouvé');
        }

        // Créer les boutons de confirmation
        const confirmButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_delete')
                    .setLabel('Confirmer la suppression')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('Confirmation de suppression')
            .setDescription(`Êtes-vous sûr de vouloir supprimer la configuration de ${streamerName} ?`)
            .setColor('#FF0000');

        await interaction.update({
            embeds: [confirmEmbed],
            components: [confirmButtons]
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du streamer:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleConfirmDelete(interaction) {
    try {
        const embed = interaction.message.embeds[0];
        console.log('Embed de confirmation:', embed);

        // S'assurer que nous avons bien un embed avec une description
        if (!embed || !embed.description) {
            throw new Error('Données de l\'embed manquantes');
        }

        // Extraire le nom du streamer avec une expression régulière
        const match = embed.description.match(/la configuration de ([^?]+)/);
        const streamerName = match ? match[1].trim() : null;

        if (!streamerName) {
            throw new Error('Nom du streamer non trouvé dans l\'embed');
        }

        console.log('Nom du streamer à supprimer:', streamerName);

        // Récupérer tous les streamers
        const streamers = await StreamManager.getStreamers();
        console.log('Liste des streamers:', streamers);

        // Trouver le streamer et son ID avec une comparaison insensible à la casse
        let streamerId = null;
        for (const [id, info] of Object.entries(streamers)) {
            console.log(`Comparaison: "${info.channelName}" avec "${streamerName}"`);
            if (info.channelName === streamerName) { // Comparaison exacte pour plus de sécurité
                streamerId = id;
                break;
            }
        }

        if (!streamerId) {
            console.log('Aucun streamer trouvé avec ce nom');
            throw new Error(`Streamer "${streamerName}" non trouvé`);
        }

        console.log('ID du streamer trouvé:', streamerId);

        // Supprimer le streamer
        const deleted = await StreamManager.deleteStreamer(streamerId);
        
        if (!deleted) {
            throw new Error('Erreur lors de la suppression');
        }

        // Confirmer la suppression
        await interaction.update({
            content: `✅ La configuration de ${streamerName} a été supprimée.`,
            embeds: [],
            components: []
        });

        // Mettre à jour le menu principal
        try {
            // Récupérer la nouvelle liste des streamers
            const updatedStreamers = await StreamManager.getStreamers();
            console.log('Liste mise à jour des streamers:', updatedStreamers);
            
            // Trouver le message original
            const originalMessages = await interaction.channel.messages.fetch({ limit: 20 });
            const originalMessage = originalMessages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].title === 'Configuration du Stream'
            );

            if (originalMessage) {
                // Créer les boutons standard
                const platformButton = new ButtonBuilder()
                    .setCustomId('stream_platform')
                    .setLabel('Plateforme: Twitch')
                    .setStyle(ButtonStyle.Primary);

                const channelButton = new ButtonBuilder()
                    .setCustomId('stream_channel')
                    .setLabel('Définir la chaîne')
                    .setStyle(ButtonStyle.Success);

                const notificationButton = new ButtonBuilder()
                    .setCustomId('notification_channel')
                    .setLabel('Salon')
                    .setStyle(ButtonStyle.Secondary);

                const messageButton = new ButtonBuilder()
                    .setCustomId('stream_message')
                    .setLabel('Message')
                    .setStyle(ButtonStyle.Secondary);

                // Mise à jour des options du menu
                let options;
                if (Object.keys(updatedStreamers).length > 0) {
                    options = Object.values(updatedStreamers).map(streamer => ({
                        label: streamer.channelName || 'Streamer sans nom',
                        value: streamer.channelName || 'unknown',
                        description: `${streamer.platform} - ${streamer.channelUrl}`.slice(0, 100)
                    }));
                } else {
                    options = [{
                        label: 'Aucun streamer configuré',
                        value: 'none',
                        description: 'Utilisez les boutons ci-dessus pour configurer un streamer'
                    }];
                }

                const streamersMenu = new StringSelectMenuBuilder()
                    .setCustomId('streamers_select')
                    .setPlaceholder('Sélectionner un streamer à modifier')
                    .addOptions(options);

                const buttonsRow = new ActionRowBuilder().addComponents(
                    platformButton,
                    channelButton,
                    notificationButton,
                    messageButton
                );
                const menuRow = new ActionRowBuilder().addComponents(streamersMenu);

                await originalMessage.edit({ components: [buttonsRow, menuRow] });
                console.log('Menu principal mis à jour avec succès');
            } else {
                console.log('Message original non trouvé');
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour du menu principal:', error);
        }

    } catch (error) {
        console.error('Erreur détaillée lors de la suppression:', {
            error: error.message,
            stack: error.stack
        });

        const errorMessage = {
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        };

        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(errorMessage);
        } else {
            await interaction.followUp(errorMessage);
        }
    }
}


async function handleCancelDelete(interaction) {
    try {
        const streamerName = interaction.message.embeds[0].description.split('de ')[1].replace(' ?', '');
        const streamer = await StreamManager.getStreamerByName(streamerName);

        if (!streamer) {
            throw new Error('Streamer non trouvé');
        }

        // Recréer l'embed original
        const originalEmbed = new EmbedBuilder()
            .setTitle(`Configuration de ${streamer.channelName}`)
            .setDescription('Informations du streamer')
            .addFields(
                { name: 'Plateforme', value: streamer.platform, inline: true },
                { name: 'URL', value: streamer.channelUrl, inline: true },
                { name: 'Message d\'annonce', value: streamer.message || 'Non configuré', inline: false }
            )
            .setColor('#9146FF');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_streamer')
                    .setLabel('Modifier')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('delete_streamer')
                    .setLabel('Supprimer')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({
            embeds: [originalEmbed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleBackToStreamer(interaction) {
    try {
        const streamerName = interaction.message.embeds[0].title.replace('Configuration de ', '');
        const streamer = await StreamManager.getStreamerByName(streamerName);

        if (!streamer) {
            throw new Error('Streamer non trouvé');
        }

        // Recréer l'embed original
        const originalEmbed = new EmbedBuilder()
            .setTitle(`Configuration de ${streamer.channelName}`)
            .setDescription('Informations du streamer')
            .addFields(
                { name: 'Plateforme', value: streamer.platform, inline: true },
                { name: 'URL', value: streamer.channelUrl, inline: true },
                { name: 'Message d\'annonce', value: streamer.message || 'Non configuré', inline: false }
            )
            .setColor('#9146FF');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_streamer')
                    .setLabel('Modifier')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('delete_streamer')
                    .setLabel('Supprimer')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.update({
            embeds: [originalEmbed],
            components: [row]
        });
    } catch (error) {
        console.error('Erreur lors du retour:', error);
        await interaction.reply({
            content: `❌ Erreur: ${error.message}`,
            ephemeral: true
        });
    }
}
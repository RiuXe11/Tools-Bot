// utils/serviceManager.js
const { 
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    Collection
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const getTimeString = () => new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Paris'
});

const getDateString = () => new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Paris'
});

class ServiceManager {
    static configPath = path.join(__dirname, '../data/serviceConfig.json');
    static settingChannels = new Collection();

    // Configuration de base
    static getDefaultConfig() {
        return {
            enabled: false,
            logsChannel: null,
            serviceChannel: null,
            buttons: {
                pds: {
                    label: 'PDS',
                    emoji: '🟢',
                    style: ButtonStyle.Success
                },
                fds: {
                    label: 'FDS',
                    emoji: '🔴',
                    style: ButtonStyle.Danger
                }
            },
            roles: {
                required: null,
                service: null
            }
        };
    }

    static createConfigButtons() {
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('set_logs_channel')
                    .setLabel('Salon Logs')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('set_service_channel')
                    .setLabel('Salon Service')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('toggle_system')
                    .setLabel('Activer/Désactiver')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔄')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(                  
                new ButtonBuilder()
                    .setCustomId('configure_roles')
                    .setLabel('Configurer Rôles')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('👥'),
                new ButtonBuilder()
                    .setCustomId('view_stats')
                    .setLabel('Statistiques')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📈')
            );
        
        const row3 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('save_service')
                    .setLabel('Sauvegarder')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('💾')  
            )

        return [row1, row2, row3];
    }

    // Gestion du fichier de configuration
    static async initConfig() {
        if (!fs.existsSync(path.dirname(this.configPath))) {
            fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
        }
        if (!fs.existsSync(this.configPath)) {
            fs.writeFileSync(this.configPath, JSON.stringify({}));
        }
    }

    static async getConfig(guildId) {
        await this.initConfig();
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return config[guildId] || this.getDefaultConfig();
    }

    static async saveConfig(guildId, config) {
        await this.initConfig();
        const allConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        allConfig[guildId] = config;
        fs.writeFileSync(this.configPath, JSON.stringify(allConfig, null, 2));
    }

    // Commande principale
    static async createConfigEmbed(message) {
        const config = await this.getConfig(message.guild.id);
        
        const configEmbed = new EmbedBuilder()
            .setTitle('⚙️ Configuration du Système Service')
            .setDescription('Utilisez les boutons ci-dessous pour configurer le système.')
            .setColor('#2F3136')
            .addFields(
                { 
                    name: '📋 Configuration Actuelle', 
                    value: await this.getConfigStatus(message.guild.id)
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });

        return { 
            embeds: [configEmbed], 
            components: this.createConfigButtons()
        };
    }

    // Gestion des interactions
    static async handleInteraction(interaction) {
        switch(interaction.customId) {
            case 'set_logs_channel':
                await this.handleSetLogsChannel(interaction);
                break;
            case 'set_service_channel':
                await this.handleSetServiceChannel(interaction);
                break;
            case 'customize_buttons':
                await this.handleCustomizeButtons(interaction);
                break;
            case 'toggle_system':
                await this.handleToggleSystem(interaction);
                break;
            case 'configure_roles':
                await this.handleConfigureRoles(interaction);
                break;
            case 'view_stats':
                await this.handleViewStats(interaction);
                break;
            case 'save_service':
                await this.handleSaveService(interaction);
                break;
            case 'pds_button':
                await this.handlePDS(interaction);
                break;
            case 'fds_button':
                await this.handleFDS(interaction);
                break;
        }
    }

    static async createServiceEmbed(guild) {
        const config = await this.getConfig(guild.id);

        const serviceEmbed = new EmbedBuilder()
            .setTitle('🕒 Système de Service')
            .setDescription('Utilisez les boutons ci-dessous pour gérer votre service.')
            .setColor('#2F3136')
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pds_button')
                    .setLabel(config.buttons.pds.label)
                    .setStyle(config.buttons.pds.style)
                    .setEmoji(config.buttons.pds.emoji),
                new ButtonBuilder()
                    .setCustomId('fds_button')
                    .setLabel(config.buttons.fds.label)
                    .setStyle(config.buttons.fds.style)
                    .setEmoji(config.buttons.fds.emoji)
            );

        return { 
            embeds: [serviceEmbed], 
            components: [row] 
        };
    }

    static async handleSaveService(interaction) {
        const config = await this.getConfig(interaction.guildId);
        
        if (!config.serviceChannel) {
            await interaction.reply({
                content: '❌ Veuillez d\'abord configurer un salon de service.',
                ephemeral: true
            });
            return;
        }
    
        const serviceChannel = interaction.guild.channels.cache.get(config.serviceChannel);
        if (!serviceChannel) {
            await interaction.reply({
                content: '❌ Le salon de service configuré est invalide.',
                ephemeral: true
            });
            return;
        }
    
        // Créer l'embed pour le système de service
        const serviceEmbed = new EmbedBuilder()
            .setTitle('🕒 Système de Service')
            .setDescription('Utilisez les boutons ci-dessous pour gérer votre service.')
            .setColor('#2F3136')
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });
    
        // Créer les boutons PDS/FDS
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pds_button')
                    .setLabel('PDS')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🟢'),
                new ButtonBuilder()
                    .setCustomId('fds_button')
                    .setLabel('FDS')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔴')
            );
    
        // Vérifier si un message existe déjà
        const messages = await serviceChannel.messages.fetch({ limit: 100 });
        const existingMessage = messages.find(msg => 
            msg.author.id === interaction.client.user.id && 
            msg.embeds[0]?.title === '🕒 Système de Service'
        );
    
        if (existingMessage) {
            await existingMessage.edit({ embeds: [serviceEmbed], components: [row] });
            await interaction.reply({ 
                content: '✅ Le message de service a été mis à jour !',
                ephemeral: true
            });
        } else {
            await serviceChannel.send({ embeds: [serviceEmbed], components: [row] });
            await interaction.reply({ 
                content: '✅ Le message de service a été créé !',
                ephemeral: true
            });
        }
    }

    static async handleCustomizeButtons(interaction) {
        await interaction.reply({
            content: '📝 Veuillez envoyer le nouveau texte pour les boutons dans ce format :\nPDS=Nouveau texte PDS, FDS=Nouveau texte FDS',
            ephemeral: true
        });
        this.settingChannels.set(interaction.channel.id, {
            type: 'customize_buttons',
            interaction: interaction
        });
    }
    
    static async handleConfigureRoles(interaction) {
        try {
            await interaction.reply({
                content: '👥 Pour configurer les rôles :\n1. Rôle requis pour utiliser le système (@role)\n2. Rôle attribué pendant le service (@role)',
                ephemeral: true
            });
            
            // Stocker l'interaction pour le traitement ultérieur
            this.settingChannels.set(interaction.channelId, {
                type: 'configure_roles',
                interaction: interaction
            });
        } catch (error) {
            console.error('Erreur lors de la configuration des rôles:', error);
            await interaction.reply({
                content: '❌ Une erreur est survenue lors de la configuration des rôles.',
                ephemeral: true
            });
        }
    }
    
    static async handleViewStats(interaction) {
        const config = await this.getConfig(interaction.guildId);
        
        const statsEmbed = new EmbedBuilder()
            .setTitle('📊 Statistiques du Système Service')
            .setColor('#2F3136')
            .addFields(
                { 
                    name: '⚙️ Configuration', 
                    value: `État: ${config.enabled ? 'Activé ✅' : 'Désactivé ❌'}\nSalon Logs: ${config.logsChannel ? `<#${config.logsChannel}>` : 'Non configuré'}\nSalon Service: ${config.serviceChannel ? `<#${config.serviceChannel}>` : 'Non configuré'}`,
                    inline: false 
                },
                { 
                    name: '👥 Rôles', 
                    value: `Requis: ${config.roles.required ? `<@&${config.roles.required}>` : 'Non configuré'}\nService: ${config.roles.service ? `<@&${config.roles.service}>` : 'Non configuré'}`,
                    inline: false 
                },
                { 
                    name: '🔘 Boutons', 
                    value: `PDS: ${config.buttons.pds.label}\nFDS: ${config.buttons.fds.label}`,
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });
    
        await interaction.reply({
            embeds: [statsEmbed],
            ephemeral: true
        });
    }

    static async handlePDS(interaction) {
        const config = await this.getConfig(interaction.guildId);
        
        if (!config.enabled) {
            await interaction.reply({
                content: '❌ Le système de service est actuellement désactivé.',
                ephemeral: true
            });
            return;
        }
    
        // Vérification du rôle requis
        if (config.roles.required) {
            if (!interaction.member.roles.cache.has(config.roles.required)) {
                await interaction.reply({
                    content: '❌ Vous n\'avez pas le rôle requis pour utiliser le système.',
                    ephemeral: true
                });
                return;
            }
        }
    
        // Ajout du rôle de service
        if (config.roles.service) {
            await interaction.member.roles.add(config.roles.service).catch(console.error);
        }
    
        const pdsEmbed = new EmbedBuilder()
            .setTitle('🟢 Prise de Service')
            .setDescription(`${interaction.user} a pris son service`)
            .setColor('#00FF00')
            .addFields(
                { name: 'Début du service', value: getTimeString(), inline: true },
                { name: 'Date', value: getDateString(), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });
    
        if (config.logsChannel) {
            const logsChannel = interaction.guild.channels.cache.get(config.logsChannel);
            if (logsChannel) {
                await logsChannel.send({ embeds: [pdsEmbed] });
            }
        }
    
        await interaction.reply({
            content: '✅ Votre prise de service a été enregistrée !',
            ephemeral: true
        });
    }

    static async handleFDS(interaction) {
        const config = await this.getConfig(interaction.guildId);
        
        if (!config.enabled) {
            await interaction.reply({
                content: '❌ Le système de service est actuellement désactivé.',
                ephemeral: true
            });
            return;
        }

        if (config.roles.required) {
            if (!interaction.member.roles.cache.has(config.roles.required)) {
                await interaction.reply({
                    content: '❌ Vous n\'avez pas le rôle requis pour utiliser le système.',
                    ephemeral: true
                });
                return;
            }
        }
    
        // Retrait du rôle de service
        if (config.roles.service) {
            await interaction.member.roles.remove(config.roles.service).catch(console.error);
        }
    
        const fdsEmbed = new EmbedBuilder()
            .setTitle('🔴 Fin de Service')
            .setDescription(`${interaction.user} a terminé son service`)
            .setColor('#FF0000')
            .addFields(
                { name: 'Fin du service', value: getTimeString(), inline: true },
                { name: 'Date', value: getDateString(), inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Service • ' + getTimeString() });

        // Envoyer dans le salon des logs si configuré
        if (config.logsChannel) {
            const logsChannel = interaction.guild.channels.cache.get(config.logsChannel);
            if (logsChannel) {
                await logsChannel.send({ embeds: [fdsEmbed] });
            }
        }

        await interaction.reply({
            content: '✅ Votre fin de service a été enregistrée !',
            ephemeral: true
        });
    }

    // Messages handlers
    static async handleMessage(message) {
        const settingData = this.settingChannels.get(message.channel.id);
        if (!settingData) return;
    
        const { type, interaction } = settingData;

        try {
        
            if (type === 'logs' || type === 'service') {
                const channel = message.mentions.channels.first();
                if (!channel) {
                    const errorMsg = await message.reply('❌ Veuillez mentionner un salon valide (#salon).');
                    setTimeout(() => errorMsg.delete().catch(() => {}), 2000);
                    message.delete().catch(() => {});
                    return;
                }
        
                const config = await this.getConfig(message.guild.id);
                if (type === 'logs') {
                    config.logsChannel = channel.id;
                } else {
                    config.serviceChannel = channel.id;
                }
        
                await this.saveConfig(message.guild.id, config);
                const updatedConfig = await this.createConfigEmbed(interaction.message);
                await interaction.message.edit(updatedConfig);
                
                const confirmMsg = await message.reply(`✅ Le salon ${type === 'logs' ? 'des logs' : 'de service'} a été configuré sur ${channel}.`);
                setTimeout(() => confirmMsg.delete().catch(() => {}), 2000);
                message.delete().catch(() => {});
                
                this.settingChannels.delete(message.channel.id);
            }
        
            if (type === 'configure_roles') {
                const mentionedRoles = message.mentions.roles;
                
                if (mentionedRoles.size !== 2) {
                    const errorMsg = await message.reply('❌ Veuillez mentionner exactement 2 rôles dans l\'ordre demandé.');
                    setTimeout(() => errorMsg.delete().catch(() => {}), 2000);
                    message.delete().catch(() => {});
                    return;
                }

                const rolesArray = Array.from(mentionedRoles.values());
                const config = await this.getConfig(message.guild.id);
                
                config.roles.required = rolesArray[0].id;
                config.roles.service = rolesArray[1].id;

                await this.saveConfig(message.guild.id, config);
                const updatedConfig = await this.createConfigEmbed(interaction.message);
                await interaction.message.edit(updatedConfig);

                const confirmMsg = await message.reply('✅ Les rôles ont été configurés.');
                setTimeout(() => confirmMsg.delete().catch(() => {}), 2000);
                message.delete().catch(() => {});

                this.settingChannels.delete(message.channel.id);
                return;
            }

            if (type === 'customize_buttons') {
                const parts = message.content.split(',');
                if (parts.length !== 2) {
                    const errorMsg = await message.reply('❌ Format invalide. Utilisez: PDS=texte1, FDS=texte2');
                    setTimeout(() => errorMsg.delete().catch(() => {}), 2000);
                    message.delete().catch(() => {});
                    return;
                }
            
                const pdsText = parts[0].split('=')[1]?.trim();
                const fdsText = parts[1].split('=')[1]?.trim();
            
                if (!pdsText || !fdsText) {
                    const errorMsg = await message.reply('❌ Format invalide. Utilisez: PDS=texte1, FDS=texte2');
                    setTimeout(() => errorMsg.delete().catch(() => {}), 2000);
                    message.delete().catch(() => {});
                    return;
                }
            
                const config = await this.getConfig(message.guild.id);
                config.buttons.pds.label = pdsText;
                config.buttons.fds.label = fdsText;
                
                await this.saveConfig(message.guild.id, config);
                const updatedConfig = await this.createConfigEmbed(interaction.message);
                await interaction.message.edit(updatedConfig);
            
                const confirmMsg = await message.reply('✅ Les boutons ont été personnalisés.');
                setTimeout(() => confirmMsg.delete().catch(() => {}), 2000);
                message.delete().catch(() => {});
                this.settingChannels.delete(message.channel.id);
            }
        } catch (error) {
            console.error('Erreur dans handleMessage:', error);
            const errorMsg = await message.reply('❌ Une erreur est survenue lors du traitement de votre demande.');
            setTimeout(() => errorMsg.delete().catch(() => {}), 2000);
            if (message.deletable) await message.delete().catch(() => {});
        }
    }

    // Handlers des boutons
    static async handleSetLogsChannel(interaction) {
        const reply = await interaction.reply({
            content: '📝 Veuillez mentionner le salon qui servira pour les logs (#salon)',
            ephemeral: true
        });
        this.settingChannels.set(interaction.channel.id, {
            type: 'logs',
            interaction: interaction
        });
    }

    static async handleSetServiceChannel(interaction) {
        const reply = await interaction.reply({
            content: '📊 Veuillez mentionner le salon qui servira pour les services (#salon)',
            ephemeral: true
        });
        this.settingChannels.set(interaction.channel.id, {
            type: 'service',
            interaction: interaction
        });
    }

    static async handleToggleSystem(interaction) {
        const config = await this.getConfig(interaction.guildId);
        config.enabled = !config.enabled;
        await this.saveConfig(interaction.guildId, config);

        const updatedConfig = await this.createConfigEmbed(interaction.message);
        await interaction.update(updatedConfig);
    }

    // Gestion PDS/FDS
    static async getConfigStatus(guildId) {
        const config = await this.getConfig(guildId);
        return `Système: ${config.enabled ? 'Activé ✅' : 'Désactivé ❌'}
Salon Logs: ${config.logsChannel ? `<#${config.logsChannel}>` : 'Non configuré ❌'}
Salon Service: ${config.serviceChannel ? `<#${config.serviceChannel}>` : 'Non configuré ❌'}
Rôle Requis: ${config.roles.required ? `<@&${config.roles.required}>` : 'Non configuré ❌'}
Rôle Service: ${config.roles.service ? `<@&${config.roles.service}>` : 'Non configuré ❌'}`;
    }
}

module.exports = ServiceManager;
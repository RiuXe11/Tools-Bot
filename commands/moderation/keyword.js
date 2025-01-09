const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const colorManager = require(path.join(process.cwd(), 'utils', 'colors.js'));

const KEYWORDS_FILE = path.join(__dirname, '../../data/keyword/keyword.json');

const SANCTION_TYPES = {
    NONE: 'Aucune',
    WARN: 'Avertissement',
    MUTE: 'Mute temporaire',
    KICK: 'Expulsion',
    BAN: 'Bannissement'
};

function normalizeText(text) {
    // Normalise les caractères spéciaux en caractères basiques
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function cleanSpaces(text) {
    // Supprime tous les espaces
    return text.replace(/\s/g, '');
}

const WARNINGS_FILE = path.join(__dirname, '../../data/keyword/warnings.json');

async function ensureWarningsFile() {
    try {
        await fs.access(WARNINGS_FILE);
    } catch {
        await fs.mkdir(path.dirname(WARNINGS_FILE), { recursive: true });
        await fs.writeFile(WARNINGS_FILE, JSON.stringify({}, null, 2));
    }
}

async function loadWarnings() {
    await ensureWarningsFile();
    try {
        const data = await fs.readFile(WARNINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lors du chargement des avertissements:', error);
        return {};
    }
}

async function saveWarnings(warnings) {
    await fs.writeFile(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

async function getUserWarnings(userId, keyword) {
    const warnings = await loadWarnings();
    return (warnings[userId]?.[keyword] || 0);
}

async function updateUserWarnings(userId, keyword, count) {
    const warnings = await loadWarnings();
    if (!warnings[userId]) warnings[userId] = {};
    warnings[userId][keyword] = count;
    await saveWarnings(warnings);
}

async function loadKeywords() {
    try {
        await ensureFile();
        const data = await fs.readFile(KEYWORDS_FILE, 'utf8');
        let keywords = [];
        try {
            keywords = JSON.parse(data);
            if (!Array.isArray(keywords)) {
                keywords = [];
                await saveKeywords(keywords);
            }
        } catch (parseError) {
            console.error('Erreur lors du parsing du JSON:', parseError);
            keywords = [];
            await saveKeywords(keywords);
        }
        return keywords;
    } catch (error) {
        console.error('Erreur lors du chargement des mots-clés:', error);
        return [];
    }
}

async function ensureFile() {
    try {
        await fs.access(KEYWORDS_FILE);
        const data = await fs.readFile(KEYWORDS_FILE, 'utf8');
        try {
            const content = JSON.parse(data);
            if (!Array.isArray(content)) {
                throw new Error('Le contenu n\'est pas un tableau');
            }
        } catch (error) {
            await fs.writeFile(KEYWORDS_FILE, JSON.stringify([], null, 2));
        }
    } catch {
        await fs.mkdir(path.dirname(KEYWORDS_FILE), { recursive: true });
        await fs.writeFile(KEYWORDS_FILE, JSON.stringify([], null, 2));
    }
}

async function saveKeywords(keywords) {
    await fs.writeFile(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
}

const createMainEmbed = (keywords, guild) => {
    const embed = new EmbedBuilder()
        .setTitle('Système de mots-clés')
        .setDescription('Gérez vos mots-clés qui déclencheront des sanctions automatiques.')
        .setColor(guild ? colorManager.getColor(guild.id) : '#0099ff');

    if (keywords.length > 0) {
        keywords.forEach(k => {
            embed.addFields({
                name: `📝 ${k.keyword}`,
                value: `Sanction: ${k.sanction ? k.sanction.type : 'Aucune'}${k.sanction?.duration ? ` (${k.sanction.duration}min)` : ''}
                ${k.logsChannel ? `Logs: <#${k.logsChannel}>` : 'Pas de salon logs'}`,
                inline: true
            });
        });
    }

    return embed;
};

const handleKeywordList = async (interaction, config) => {
    await interaction.reply({
        content: "Entrez les mots-clés supplémentaires (un par ligne) :",
        ephemeral: true
    });

    try {
        const collected = await interaction.channel.awaitMessages({
            filter: m => m.author.id === interaction.user.id,
            max: 1,
            time: 30000
        });

        const keywords = collected.first().content.split('\n').map(k => k.trim()).filter(k => k);
        config.keywordList = keywords;
        
        await collected.first().delete().catch(() => {});
        interaction.client.keywordConfig.set(interaction.user.id, config);

        await interaction.editReply({
            content: `✅ Liste de mots-clés ajoutée (${keywords.length} mots)`,
            ephemeral: true
        });

        await interaction.message.edit({
            embeds: [createConfigEmbed(config)],
            components: updateButtons(config, false)
        });
    } catch (error) {
        await interaction.editReply({
            content: "Temps écoulé ou erreur, veuillez réessayer.",
            ephemeral: true
        });
    }
};

// Modifiez la fonction checkKeyword qui sera utilisée dans messageCreate.js
function checkKeyword(message, keyword) {
    let messageContent = message.content.toLowerCase();
    let keywordText = keyword.keyword.toLowerCase();
    let keywordList = keyword.keywordList || [];
    
    // Créer la liste complète des mots à vérifier
    let wordsToCheck = [keywordText, ...keywordList];

    // Appliquer les transformations selon les options
    if (keyword.detectCharacters) {
        messageContent = normalizeText(messageContent);
        wordsToCheck = wordsToCheck.map(word => normalizeText(word));
    }

    if (keyword.detectSpaces) {
        messageContent = cleanSpaces(messageContent);
        wordsToCheck = wordsToCheck.map(word => cleanSpaces(word));
    }

    if (keyword.detectFont) {
        // Transformation supplémentaire pour la police si nécessaire
        messageContent = messageContent.normalize('NFKC');
        wordsToCheck = wordsToCheck.map(word => word.normalize('NFKC'));
    }

    // Vérifier si l'un des mots est présent
    return wordsToCheck.some(word => messageContent.includes(word));
}

const createConfigEmbed = (config, guild) => {
    const embed = new EmbedBuilder()
        .setTitle('Configuration du mot-clé')
        .setDescription('Configurez votre nouveau mot-clé en utilisant les boutons ci-dessous.')
        .setColor(guild ? colorManager.getColor(guild.id) : '#0099ff');

    if (config) {
        const fields = [];
        
        // Mot-clé principal toujours en premier
        if (config.keyword) {
            fields.push({ 
                name: '📝 Mot-clé principal', 
                value: config.keyword, 
                inline: true 
            });
        }

        // Liste des variantes ensuite
        if (config.keywordList?.length > 0) {
            fields.push({ 
                name: '📋 Liste des variantes', 
                value: config.keywordList.join(', '), 
                inline: false 
            });
        }

        // Options de détection
        const detectionOptions = [];
        if (config.detectCharacters) detectionOptions.push('✅ Caractères spéciaux');
        if (config.detectFont) detectionOptions.push('✅ Police');
        if (config.detectSpaces) detectionOptions.push('✅ Espaces');
        
        if (detectionOptions.length > 0) {
            fields.push({ 
                name: '🔍 Options de détection', 
                value: detectionOptions.join('\n'), 
                inline: false 
            });
        }

        // Salon de logs
        if (config.logsChannel) {
            fields.push({
                name: 'Salon Logs',
                value: `<#${config.logsChannel}>`,
                inline: true
            });
        }

        // Sanctions à la fin
        if (config.sanction) {
            if (config.sanction.type === SANCTION_TYPES.WARN) {
                fields.push({
                    name: 'Type de sanction',
                    value: 'Système d\'avertissements',
                    inline: true
                });
            
                config.sanction.warnings.forEach((warning, index) => {
                    let warnDetails = `**Avertissement ${index + 1}/${config.sanction.maxWarnings}**\n`;
                    if (warning.role) warnDetails += `• Rôle: <@&${warning.role}>\n`;
                    if (warning.sanction) warnDetails += `• Sanction: ${warning.sanction}`;
                    if (warning.duration) warnDetails += ` (${warning.duration}min)`;
                    
                    fields.push({
                        name: `⚠️ Niveau ${index + 1}`,
                        value: warnDetails,
                        inline: false
                    });
                });
            } else {
                fields.push({
                    name: 'Sanction',
                    value: `${config.sanction.type}${config.sanction.duration ? ` (${config.sanction.duration} minutes)` : ''}`,
                    inline: true
                });
            }
        } else {
            fields.push({
                name: 'Sanction',
                value: 'Aucune',
                inline: true
            });
        }
        
        if (fields.length > 0) {
            embed.addFields(fields);
        }
    }

    return embed;
};

const updateButtons = (config, isEditing = false) => {
    const buttons1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('keyword-set-keyword')
                .setLabel('Mot-clé')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('keyword-set-list')
                .setLabel('Liste')
                .setStyle(ButtonStyle.Primary)
        );

    const buttons2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('keyword-set-sanction')
                .setLabel('Sanction')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('keyword-set-logs')
                .setLabel('Salon Logs')
                .setStyle(ButtonStyle.Secondary)
        );

    const buttons3 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('keyword-toggle-caractere')
                .setLabel('Caractère')
                .setStyle(config.detectCharacters ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('keyword-toggle-police')
                .setLabel('Police')
                .setStyle(config.detectFont ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('keyword-toggle-space')
                .setLabel('Space')
                .setStyle(config.detectSpaces ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

    const buttons4 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('keyword-save')
                .setLabel('Sauvegarder')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('keyword-cancel')
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
        );

    if (isEditing) {
        buttons4.addComponents(
            new ButtonBuilder()
                .setCustomId('keyword-delete')
                .setLabel('Supprimer')
                .setStyle(ButtonStyle.Danger)
        );
    }

    return [buttons1, buttons2, buttons3, buttons4];
};

const handleWarningConfig = async (interaction, config, warningNumber, totalWarnings) => {
    // Configuration d'un avertissement spécifique
    const warning = {
        number: warningNumber,
        role: null,
        sanction: null,
        duration: null
    };

    // 1. Demander le rôle
    await interaction.editReply({
        content: `Configuration de l'avertissement ${warningNumber}/${totalWarnings}\nMentionnez un rôle à attribuer (ou tapez "aucun") :`,
        components: []
    });

    try {
        const roleResponse = await interaction.channel.awaitMessages({
            filter: m => m.author.id === interaction.user.id,
            max: 1,
            time: 30000
        });

        const roleMsg = roleResponse.first();
        if (roleMsg.mentions.roles.size > 0) {
            warning.role = roleMsg.mentions.roles.first().id;
        }
        await roleMsg.delete().catch(() => {});

        // 2. Demander la sanction
        const sanctionSelect = new StringSelectMenuBuilder()
            .setCustomId('warning-sanction-select')
            .setPlaceholder('Choisissez la sanction')
            .addOptions([
                { label: 'Aucune', value: 'NONE' },
                { label: 'Mute temporaire', value: 'MUTE' },
                { label: 'Expulsion', value: 'KICK' },
                { label: 'Bannissement', value: 'BAN' }
            ]);

        const row = new ActionRowBuilder().addComponents(sanctionSelect);

        await interaction.editReply({
            content: `Avertissement ${warningNumber}/${totalWarnings} - Choisissez la sanction :`,
            components: [row]
        });

        const sanctionResponse = await interaction.channel.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id && i.customId === 'warning-sanction-select',
            time: 30000
        });

        warning.sanction = SANCTION_TYPES[sanctionResponse.values[0]];

        // 3. Si c'est un mute, demander la durée
        if (sanctionResponse.values[0] === 'MUTE') {
            await interaction.editReply({
                content: 'Entrez la durée du mute en minutes :',
                components: []
            });

            const durationResponse = await interaction.channel.awaitMessages({
                filter: m => m.author.id === interaction.user.id && !isNaN(m.content),
                max: 1,
                time: 30000
            });

            warning.duration = parseInt(durationResponse.first().content);
            await durationResponse.first().delete().catch(() => {});
        }

        return warning;

    } catch (error) {
        console.error('Erreur lors de la configuration de l\'avertissement:', error);
        await interaction.editReply({
            content: 'Temps écoulé ou erreur, configuration annulée.',
            components: []
        });
        return null;
    }
};

const handleSanctionSelect = async (interaction, config) => {
    const sanctionSelect = new StringSelectMenuBuilder()
        .setCustomId('sanction-type-select')
        .setPlaceholder('Choisissez un type de sanction')
        .addOptions(
            Object.entries(SANCTION_TYPES).map(([key, value]) => ({
                label: value,
                value: key
            }))
        );

    const row = new ActionRowBuilder().addComponents(sanctionSelect);

    await interaction.reply({
        content: 'Sélectionnez le type de sanction :',
        components: [row],
        ephemeral: true
    });

    try {
        const response = await interaction.channel.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id && i.customId === 'sanction-type-select',
            time: 30000
        });

        const selectedSanction = response.values[0];

        if (selectedSanction === 'WARN') {
            // Configuration du système d'avertissements
            await response.update({
                content: 'Entrez le nombre d\'avertissements avant la sanction finale :',
                components: []
            });

            const warningCountResponse = await interaction.channel.awaitMessages({
                filter: m => m.author.id === interaction.user.id && !isNaN(m.content) && parseInt(m.content) > 0,
                max: 1,
                time: 30000
            });

            const warningCount = parseInt(warningCountResponse.first().content);
            await warningCountResponse.first().delete().catch(() => {});

            config.sanction = {
                type: SANCTION_TYPES[selectedSanction],
                maxWarnings: warningCount,
                warnings: []
            };

            // Configurer chaque niveau d'avertissement
            for (let i = 1; i <= warningCount; i++) {
                const warning = await handleWarningConfig(interaction, config, i, warningCount);
                if (warning) {
                    config.sanction.warnings.push(warning);
                }
            }

        } else if (selectedSanction === 'MUTE') {
            await response.update({
                content: 'Veuillez entrer la durée du mute en minutes :',
                components: []
            });

            const durationResponse = await interaction.channel.awaitMessages({
                filter: m => m.author.id === interaction.user.id && !isNaN(m.content),
                max: 1,
                time: 30000
            });

            const duration = parseInt(durationResponse.first().content);
            config.sanction = {
                type: SANCTION_TYPES[selectedSanction],
                duration: duration
            };

            await durationResponse.first().delete().catch(() => {});
        } else if (selectedSanction !== 'NONE') {
            config.sanction = {
                type: SANCTION_TYPES[selectedSanction]
            };
        } else {
            config.sanction = null;
        }

        interaction.client.keywordConfig.set(interaction.user.id, config);
        
        await interaction.editReply({
            content: 'Sanction configurée !',
            components: []
        });

        await interaction.message.edit({
            embeds: [createConfigEmbed(config)],
            components: updateButtons(config, false)
        });

    } catch (error) {
        console.error('Erreur lors de la configuration de la sanction:', error);
        await interaction.editReply({
            content: 'Temps écoulé ou erreur, veuillez réessayer.',
            components: []
        });
    }
};

// Modification de la fonction applySanction pour gérer les avertissements progressifs
const applySanction = async (message, keyword) => {
    if (!keyword.sanction) return;

    const member = message.member;
    if (!member) return;

    try {
        // Supprimer le message contenant le mot-clé
        await message.delete().catch(console.error);

        let logMessage = `🚨 **Sanction Automatique**\n`;
        logMessage += `👤 Utilisateur : <@${member.id}> (${member.id})\n`;
        logMessage += `💬 Message supprimé : \`${message.content}\`\n`;
        logMessage += `📝 Mot-clé détecté : \`${keyword.keyword}\`\n`;

        if (keyword.sanction.type === SANCTION_TYPES.WARN) {
            // Gérer les avertissements progressifs
            const userWarnings = await getUserWarnings(member.id, keyword.keyword) + 1;
            const warning = keyword.sanction.warnings[userWarnings - 1];

            if (warning) {
                // Appliquer le rôle si configuré
                if (warning.role) {
                    const role = message.guild.roles.cache.get(warning.role);
                    if (role) await member.roles.add(role);
                }

                // Appliquer la sanction correspondante
                if (warning.sanction) {
                    switch (warning.sanction) {
                        case SANCTION_TYPES.MUTE:
                            if (warning.duration && member.moderatable) {
                                await member.timeout(warning.duration * 60 * 1000);
                                logMessage += `\n🔇 Mute pendant ${warning.duration} minutes`;
                            }
                            break;
                        case SANCTION_TYPES.KICK:
                            if (member.kickable) {
                                await member.kick();
                                logMessage += `\n👢 Expulsion`;
                            }
                            break;
                        case SANCTION_TYPES.BAN:
                            if (member.bannable) {
                                await member.ban();
                                logMessage += `\n🔨 Bannissement`;
                            }
                            break;
                    }
                }

                logMessage += `\n⚠️ Avertissement ${userWarnings}/${keyword.sanction.maxWarnings}`;
                await updateUserWarnings(member.id, keyword.keyword, userWarnings);
            }
        } else {
            // Gérer les sanctions directes comme avant
            switch (keyword.sanction.type) {
                case SANCTION_TYPES.MUTE:
                    if (member.moderatable) {
                        await member.timeout(keyword.sanction.duration * 60 * 1000);
                        logMessage += `🔇 Sanction : Mute pendant ${keyword.sanction.duration} minutes`;
                    }
                    break;
                case SANCTION_TYPES.KICK:
                    if (member.kickable) {
                        await member.kick();
                        logMessage += `👢 Sanction : Expulsion`;
                    }
                    break;
                case SANCTION_TYPES.BAN:
                    if (member.bannable) {
                        await member.ban();
                        logMessage += `🔨 Sanction : Bannissement`;
                    }
                    break;
            }
        }

        // Envoi des logs
        if (keyword.logsChannel) {
            const logsChannel = message.guild.channels.cache.get(keyword.logsChannel);
            if (logsChannel) {
                await logsChannel.send({
                    embeds: [new EmbedBuilder()
                        .setColor('#FF0000')
                        .setDescription(logMessage)
                        .setTimestamp()]
                });
            }
        }

    } catch (error) {
        console.error('Erreur lors de l\'application de la sanction:', error);
    }
};

module.exports = {
    name: 'keyword',
    loadKeywords,
    applySanction,
    getUserWarnings,
    updateUserWarnings,
    checkKeyword,

    async execute(message, args) {
        const keywords = await loadKeywords();
        const embed = createMainEmbed(keywords, message.guild);
        
        // Création du menu de sélection
        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('keyword-select')
                    .setPlaceholder('Sélectionnez une option')
                    .addOptions([
                        {
                            label: '➕ Créer une option',
                            description: '👉 Créer un nouveau mot-clé',
                            value: 'create'
                        },
                        ...keywords.map(k => ({
                            label: k.keyword,
                            description: 'Voir/Modifier ce mot-clé',
                            value: k.keyword
                        }))
                    ])
            );
    
        await message.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        if (interaction.isStringSelectMenu() && interaction.customId === 'keyword-select') {
            const keywords = await loadKeywords();
            
            if (interaction.values[0] === 'create') {
                const config = {};
                const embed = createConfigEmbed(config);
                const buttons = updateButtons(config, false);
                
                await interaction.update({ embeds: [embed], components: buttons });
                interaction.client.keywordConfig = interaction.client.keywordConfig || new Map();
                interaction.client.keywordConfig.set(interaction.user.id, config);
            } else {
                const selectedKeyword = keywords.find(k => k.keyword === interaction.values[0]);
                if (selectedKeyword) {
                    const embed = createConfigEmbed(selectedKeyword);
                    const buttons = updateButtons(selectedKeyword, true);
                    
                    await interaction.update({ embeds: [embed], components: buttons });
                    interaction.client.keywordConfig = interaction.client.keywordConfig || new Map();
                    interaction.client.keywordConfig.set(interaction.user.id, selectedKeyword);
                }
            }
            return;
        }
    
        // Gestionnaire pour les boutons
        if (interaction.isButton()) {
            if (!interaction.client.keywordConfig) {
                interaction.client.keywordConfig = new Map();
            }
    
            let config = interaction.client.keywordConfig.get(interaction.user.id) || {};
    
            switch (interaction.customId) {
                case 'keyword-set-keyword':
                    await interaction.reply({ content: 'Veuillez entrer le mot-clé :', ephemeral: true });
                    try {
                        const collected = await interaction.channel.awaitMessages({
                            filter: m => m.author.id === interaction.user.id,
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        });
                        
                        config.keyword = collected.first().content;
                        interaction.client.keywordConfig.set(interaction.user.id, config);
                        await collected.first().delete().catch(() => {});
                        await interaction.editReply({ content: 'Mot-clé enregistré !', ephemeral: true });
                        await interaction.message.edit({
                            embeds: [createConfigEmbed(config)],
                            components: updateButtons(config, false)
                        });
                    } catch (error) {
                        await interaction.editReply({ content: 'Temps écoulé, veuillez réessayer.', ephemeral: true });
                    }
                    break;
    
                case 'keyword-set-sanction':
                    await handleSanctionSelect(interaction, config);
                    break;
    
                case 'keyword-set-logs':
                    await interaction.reply({ 
                        content: 'Veuillez mentionner le salon où seront envoyés les logs (ex: #logs) :', 
                        ephemeral: true 
                    });
                    try {
                        const collected = await interaction.channel.awaitMessages({
                            filter: m => m.author.id === interaction.user.id && m.mentions.channels.size > 0,
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        });
                        
                        const channel = collected.first().mentions.channels.first();
                        config.logsChannel = channel.id;
                        
                        interaction.client.keywordConfig.set(interaction.user.id, config);
                        await collected.first().delete().catch(() => {});
                        await interaction.editReply({ content: `✅ Salon de logs configuré : ${channel}`, ephemeral: true });
                        await interaction.message.edit({
                            embeds: [createConfigEmbed(config)],
                            components: updateButtons(config, false)
                        });
                    } catch (error) {
                        await interaction.editReply({ content: 'Temps écoulé ou salon invalide, veuillez réessayer.', ephemeral: true });
                    }
                    break;
    
                case 'keyword-save':
                    if (!config.keyword) {
                        await interaction.reply({
                            content: '❌ Vous devez définir un mot-clé !',
                            ephemeral: true
                        });
                        return;
                    }
    
                    try {
                        const keywords = await loadKeywords();
                        const existingIndex = keywords.findIndex(k => k.keyword.toLowerCase() === config.keyword.toLowerCase());
                        
                        if (existingIndex !== -1) {
                            keywords[existingIndex] = config;
                        } else {
                            keywords.push(config);
                        }
    
                        await saveKeywords(keywords);
                        interaction.client.keywordConfig.delete(interaction.user.id);
    
                        const mainEmbed = createMainEmbed(keywords, interaction.guild);
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('keyword-select')
                                    .setPlaceholder('Sélectionnez une option')
                                    .addOptions([
                                        {
                                            label: '➕ Créer une option',
                                            description: '👉 Créer un nouveau mot-clé',
                                            value: 'create'
                                        },
                                        ...keywords.map(k => ({
                                            label: k.keyword,
                                            description: 'Voir/Modifier ce mot-clé',
                                            value: k.keyword
                                        }))
                                    ])
                            );
    
                        await interaction.update({
                            embeds: [mainEmbed],
                            components: [row]
                        });
    
                        await interaction.followUp({
                            content: '✅ Mot-clé sauvegardé avec succès !',
                            ephemeral: true
                        });
                    } catch (error) {
                        await interaction.reply({
                            content: '❌ Une erreur est survenue lors de la sauvegarde.',
                            ephemeral: true
                        });
                    }
                    break;
    
                case 'keyword-cancel':
                    try {
                        interaction.client.keywordConfig.delete(interaction.user.id);
                        const keywords = await loadKeywords();
                        const mainEmbed = createMainEmbed(keywords, interaction.guild);
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('keyword-select')
                                    .setPlaceholder('Sélectionnez une option')
                                    .addOptions([
                                        {
                                            label: '➕ Créer une option',
                                            description: '👉 Créer un nouveau mot-clé',
                                            value: 'create'
                                        },
                                        ...keywords.map(k => ({
                                            label: k.keyword,
                                            description: 'Voir/Modifier ce mot-clé',
                                            value: k.keyword
                                        }))
                                    ])
                            );
    
                        await interaction.update({
                            embeds: [mainEmbed],
                            components: [row]
                        });
    
                        await interaction.followUp({
                            content: '✅ Configuration annulée.',
                            ephemeral: true
                        });
                    } catch (error) {
                        await interaction.reply({
                            content: '❌ Une erreur est survenue lors de l\'annulation.',
                            ephemeral: true
                        });
                    }
                    break;
    
                case 'keyword-delete':
                    try {
                        const keywords = await loadKeywords();
                        const updatedKeywords = keywords.filter(k => k.keyword.toLowerCase() !== config.keyword.toLowerCase());
                        await saveKeywords(updatedKeywords);
                        
                        const mainEmbed = createMainEmbed(updatedKeywords, interaction.guild);
                        const row = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('keyword-select')
                                    .setPlaceholder('Sélectionnez une option')
                                    .addOptions([
                                        {
                                            label: '➕ Créer une option',
                                            description: '👉 Créer un nouveau mot-clé',
                                            value: 'create'
                                        },
                                        ...updatedKeywords.map(k => ({
                                            label: k.keyword,
                                            description: 'Voir/Modifier ce mot-clé',
                                            value: k.keyword
                                        }))
                                    ])
                            );
    
                        await interaction.update({
                            embeds: [mainEmbed],
                            components: [row]
                        });
    
                        await interaction.followUp({
                            content: '✅ Mot-clé supprimé avec succès !',
                            ephemeral: true
                        });
    
                        interaction.client.keywordConfig.delete(interaction.user.id);
                    } catch (error) {
                        await interaction.reply({
                            content: '❌ Une erreur est survenue lors de la suppression.',
                            ephemeral: true
                        });
                    }
                    break;

                case 'keyword-set-list':
                    await handleKeywordList(interaction, config);
                    break;
                
                case 'keyword-toggle-caractere':
                    config.detectCharacters = !config.detectCharacters;
                    interaction.client.keywordConfig.set(interaction.user.id, config);
                    await interaction.update({
                        embeds: [createConfigEmbed(config)],
                        components: updateButtons(config, false)
                    });
                    break;
                
                case 'keyword-toggle-police':
                    config.detectFont = !config.detectFont;
                    interaction.client.keywordConfig.set(interaction.user.id, config);
                    await interaction.update({
                        embeds: [createConfigEmbed(config)],
                        components: updateButtons(config, false)
                    });
                    break;
                
                case 'keyword-toggle-space':
                    config.detectSpaces = !config.detectSpaces;
                    interaction.client.keywordConfig.set(interaction.user.id, config);
                    await interaction.update({
                        embeds: [createConfigEmbed(config)],
                        components: updateButtons(config, false)
                    });
                    break;
            }
        }
    }
}

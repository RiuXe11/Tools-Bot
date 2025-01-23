const { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const fs = require('fs');
const colorManager = require(path.join(process.cwd(), 'utils', 'colors.js'));

// Fonction pour charger la configuration du préfixe
function loadPrefixConfig() {
    const configPath = path.join(process.cwd(), 'data/set-prefix/config.json');
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath));
            return config.currentPrefix;
        }
        return '!';
    } catch (error) {
        console.error('Erreur lors du chargement du préfixe:', error);
        return '!';
    }
}

// Organiser les commandes par catégories
function getCommandsByCategory(prefix) {
    return {
        "🌍 FiveM": [
            { name: `${prefix}fivem`, description: 'Permet de gérer le status FiveM.' },
            { name: `${prefix}anonyme`, description: 'Permet de paramétrer le système d\'anonymat ' }
        ],
        "⚙️ Moderation": [
            { name: `${prefix}slowmode <#salon> <30s,1h,1j,1w>`, description: 'Permet de mettre en place le slowmode sur un salon.' },
            { name: `${prefix}set-status <PLAYING, WATCHING, LISTENING, COMPETING> <Message>`, description: 'Permet de modifier le status du bot.' },
            { name: `${prefix}set-prefix`, description: 'Permet de modifier le prefix du bot.' },
            { name: `${prefix}set-color`, description: 'Permet de modifier la couleur du bot.' },
            { name: `${prefix}slowmode`, description: 'Permet de mettre en place un slowmode sur un salon défini.' },
            { name: `${prefix}suppr-emoji`, description: 'Permet de supprimer l\'ensemble des émojis du serveur.' },
            { name: `${prefix}double-emoji`, description: 'Permet de supprimer les émojis en double, triple, etc...' },
        ],
    };

}

module.exports = {
    name: 'help',
    description: 'Affiche la liste des commandes disponibles',
    async execute(message) {
        const serverColor = colorManager.getColor(message.guild.id);
        const currentPrefix = loadPrefixConfig();
        const categories = getCommandsByCategory(currentPrefix);
        const categoryNames = Object.keys(categories);
        let currentPage = 0;

        // Création des boutons
        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('◀️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('▶️')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Fonction pour générer l'embed d'une page
        function generateEmbed(pageIndex) {
            const categoryName = categoryNames[pageIndex];
            const commands = categories[categoryName];
            
            return new EmbedBuilder()
                .setColor(serverColor)
                .setTitle(`${categoryName}`)
                .setDescription(
                    commands.map(cmd => `\`${cmd.name}\`\n└ ${cmd.description}`).join('\n\n')
                )
                .setFooter({ 
                    text: `Page ${pageIndex + 1}/${categoryNames.length} | Préfixe actuel : ${currentPrefix} | ${currentPrefix}help` 
                });
        }

        // Envoyer le message initial
        const helpMessage = await message.channel.send({
            embeds: [generateEmbed(currentPage)],
            components: [buttons]
        });

        // Créer le collecteur pour les interactions avec les boutons
        const collector = helpMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async interaction => {
            // Vérifier que c'est l'auteur du message qui clique
            if (interaction.user.id !== message.author.id) {
                await interaction.reply({
                    content: 'Vous ne pouvez pas utiliser ces boutons.',
                    ephemeral: true
                });
                return;
            }

            // Mettre à jour la page selon le bouton cliqué
            if (interaction.customId === 'previous') {
                currentPage = currentPage > 0 ? currentPage - 1 : categoryNames.length - 1;
            } else if (interaction.customId === 'next') {
                currentPage = currentPage < categoryNames.length - 1 ? currentPage + 1 : 0;
            }

            // Mettre à jour le message
            await interaction.update({
                embeds: [generateEmbed(currentPage)],
                components: [buttons]
            });
        });

        // Quand le temps est écoulé, désactiver les boutons
        collector.on('end', () => {
            buttons.components.forEach(button => button.setDisabled(true));
            helpMessage.edit({ components: [buttons] }).catch(console.error);
        });
    },
};
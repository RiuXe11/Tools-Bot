const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const SERVERS_FILE = path.join(__dirname, '../../data/servers.json');

async function ensureServersFile() {
    try {
        await fs.access(SERVERS_FILE);
    } catch {
        await fs.mkdir(path.dirname(SERVERS_FILE), { recursive: true });
        await fs.writeFile(SERVERS_FILE, '{}');
    }
}

async function getServerAddress(guildId) {
    await ensureServersFile();
    const servers = JSON.parse(await fs.readFile(SERVERS_FILE, 'utf8'));
    return servers[guildId];
}

async function setServerAddress(guildId, address) {
    await ensureServersFile();
    const servers = JSON.parse(await fs.readFile(SERVERS_FILE, 'utf8'));
    servers[guildId] = address;
    await fs.writeFile(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

async function removeServerAddress(guildId) {
    await ensureServersFile();
    const servers = JSON.parse(await fs.readFile(SERVERS_FILE, 'utf8'));
    delete servers[guildId];
    await fs.writeFile(SERVERS_FILE, JSON.stringify(servers, null, 2));
}

async function validateAddress(address) {
    address = address.trim().toLowerCase();
    console.log('Validating address:', address);
    
    // Format CFX - vérifie d'abord
    if (address.includes('cfx.re/join/') || /^[a-z0-9]+$/i.test(address)) {
        try {
            const cfxId = address.includes('cfx.re/join/') 
                ? address.split('cfx.re/join/')[1].replace(/[^a-zA-Z0-9]/g, '')
                : address;
            
            console.log('CFX ID:', cfxId);
            const url = `https://servers-frontend.fivem.net/api/servers/single/${cfxId}`;
            console.log('Requesting URL:', url);
            
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            });
            
            return {
                valid: true,
                data: response.data,
                type: 'cfx',
                address: `cfx.re/join/${cfxId}`
            };
        } catch (error) {
            console.error('CFX validation error:', error.message);
            return { valid: false, data: null };
        }
    }
    
    // Format IP:PORT ensuite
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):(?:\d{1,5})$/;
    if (ipRegex.test(address)) {
        try {
            const [ip, port] = address.split(':');
            const response = await axios.get(`http://${ip}:${port}/info.json`, { timeout: 5000 });
            return { valid: true, data: response.data, type: 'ip', address };
        } catch {
            return { valid: false, data: null };
        }
    }
    
    return { valid: false, data: null };
}

module.exports = {
    name: 'fivem',
    async execute(message) {
        if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
            await message.reply('❌ Vous devez être administrateur.');
            return;
        }

        const server = await getServerAddress(message.guildId);
        const row = new ActionRowBuilder();

        if (server) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('fivem_change')
                    .setLabel('Changer le serveur')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fivem_remove')
                    .setLabel('Supprimer le serveur')
                    .setStyle(ButtonStyle.Danger)
            );
        } else {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('fivem_add')
                    .setLabel('Ajouter un serveur')
                    .setStyle(ButtonStyle.Success)
            );
        }

        const embed = new EmbedBuilder()
            .setColor(server ? '#00ff00' : '#ff0000')
            .setTitle('Configuration FiveM')
            .setDescription(server ? `Serveur actuel: ${server}` : 'Aucun serveur configuré')
            .setTimestamp();

        await message.reply({ embeds: [embed], components: [row] });
    },

    async handleInteraction(interaction) {
        if (!interaction.isButton()) return;
        
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: '❌ Vous devez être administrateur.', ephemeral: true });
            return;
        }

        const action = interaction.customId.split('_')[1];

        switch (action) {
            case 'add':
            case 'change':
                await interaction.reply({
                    content: 'Entrez l\'adresse du serveur FiveM\nFormat attendu: IP:PORT (ex: 1.2.3.4:30120) ou CFX (ex: cfx.re/join/abcdef)',
                    ephemeral: true
                });

                const filter = m => m.author.id === interaction.user.id;
                try {
                    const collected = await interaction.channel.awaitMessages({
                        filter,
                        max: 1,
                        time: 30000,
                        errors: ['time']
                    });

                    const addressInput = collected.first().content;
                    const validation = await validateAddress(addressInput);

                    if (!validation.valid) {
                        await interaction.followUp({
                            content: '❌ Format invalide ou serveur inaccessible. Utilisez IP:PORT ou cfx.re/join/XXXXX',
                            ephemeral: true
                        });
                        return;
                    }

                    await setServerAddress(interaction.guildId, validation.address);
                    await interaction.followUp({
                        content: '✅ Serveur configuré avec succès!',
                        ephemeral: true
                    });

                    // Supprimer le message de l'utilisateur
                    try {
                        await collected.first().delete();
                    } catch {
                        // Ignorer si on ne peut pas supprimer
                    }
                } catch (error) {
                    await interaction.followUp({
                        content: 'Temps écoulé ou erreur.',
                        ephemeral: true
                    });
                }
                break;

            case 'remove':
                await removeServerAddress(interaction.guildId);
                await interaction.reply({
                    content: '✅ Serveur supprimé.',
                    ephemeral: true
                });
                break;
        }

        // Mise à jour de l'embed
        const server = await getServerAddress(interaction.guildId);
        const row = new ActionRowBuilder();

        if (server) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('fivem_change')
                    .setLabel('Changer le serveur')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('fivem_remove')
                    .setLabel('Supprimer le serveur')
                    .setStyle(ButtonStyle.Danger)
            );
        } else {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('fivem_add')
                    .setLabel('Ajouter un serveur')
                    .setStyle(ButtonStyle.Success)
            );
        }

        const embed = new EmbedBuilder()
            .setColor(server ? '#00ff00' : '#ff0000')
            .setTitle('Configuration FiveM')
            .setDescription(server ? `Serveur actuel: ${server}` : 'Aucun serveur configuré')
            .setTimestamp();

        await interaction.message.edit({ embeds: [embed], components: [row] });
    }
};
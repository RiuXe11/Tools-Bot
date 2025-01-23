require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessageReactions 
    ],
    partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
    ws: {
        properties: {
            $browser: 'Discord Android',
            $device: 'Discord Android',
            $os: 'Android'
        }
    }
});

// Collections
client.commands = new Collection();

// Gestionnaire d'erreurs global
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
    console.error('Discord client error:', error);
});

// Chargement des événements
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Chargement des commandes
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const command = require(path.join(folderPath, file));
        client.commands.set(command.name, command);
    }
}

// Gestion propre de la fermeture
process.on('SIGINT', () => {
    console.log('Bot is shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Bot is shutting down...');
    client.destroy();
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN)
    .catch(error => {
        console.error('Error during login:', error);
        process.exit(1);
    });
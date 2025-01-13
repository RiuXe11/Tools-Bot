const { ActivityType, version: djsversion } = require('discord.js');
const figlet = require('figlet');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const statusVariables = require('../utils/statusVariables');
const { getServerAddress } = require('../utils/fivem');
const slowmode = require('../utils/slowmode');
const statusManager = require('../utils/statusManager');
const hourlyRecorder = require('../utils/hourlyRecorder');
const serverMonitor = require('../utils/serverMonitor');

// Codes de couleur ANSI étendus
const colors = {
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    bright: {
        cyan: '\x1b[96m',
        blue: '\x1b[94m',
        green: '\x1b[92m',
        yellow: '\x1b[93m',
        magenta: '\x1b[95m',
        red: '\x1b[91m',
        white: '\x1b[97m'
    },
    bg: {
        blue: '\x1b[44m',
        magenta: '\x1b[45m'
    },
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underline: '\x1b[4m'
};

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    return `${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

class BotInitializer {
    constructor(client) {
        this.client = client;
    }

    async initSlowmode() {
        await slowmode.loadData();
        return true;
    }

    async initFiveM() {
        const serversPath = path.join(__dirname, '../data/servers.json');
        try {
            const servers = JSON.parse(await fs.readFile(serversPath, 'utf8'));
            const firstGuildId = Object.keys(servers)[0];
            
            if (firstGuildId) {
                const serverAddress = servers[firstGuildId];
                await statusVariables.initializeWithAddress(serverAddress);
                return true;
            }
        } catch (error) {
            console.log(colors.bright.yellow + '⚠️  Aucune configuration FiveM trouvée' + colors.reset);
        }
        return false;
    }

    async initServerMonitor() {
        try {
            serverMonitor.start(this.client);
            return true;
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du moniteur de serveur:', error);
            return false;
        }
    }

    async setupStatus() {
        try {
            // Charger et appliquer le statut personnalisé
            if (await statusManager.setStatus(this.client)) {
                console.log(colors.bright.green + '✅ Statut personnalisé chargé' + colors.reset);
                return;
            }
    
            // Si aucun statut personnalisé n'est configuré, utiliser le statut par défaut
            this.client.user.setActivity(`${this.client.guilds.cache.size} serveurs`, { 
                type: ActivityType.Watching 
            });
            console.log(colors.bright.yellow + '⚠️  Utilisation du statut par défaut' + colors.reset);
        } catch (error) {
            console.error('Erreur lors de la configuration du statut:', error);
        }
    }

    async setupShutdownHandlers() {
        const handleShutdown = async (signal) => {
            console.log(`\n${colors.bright.red}🛑 Signal ${signal} reçu. Arrêt en cours...${colors.reset}`);
            try {
                await slowmode.saveAllData();
                await hourlyRecorder.stop();
                serverMonitor.stop(); // Ajout de l'arrêt du moniteur
                console.log(colors.bright.green + '✅ Données sauvegardées avec succès' + colors.reset);
            } catch (error) {
                console.error(colors.red + '❌ Erreur lors de la sauvegarde:' + colors.reset, error);
            }
            process.exit(0);
        };
    
        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    }

    async initialize() {
        return new Promise((resolve) => {
            figlet(this.client.user.username, {
                font: 'Elite',
                horizontalLayout: 'default',
                verticalLayout: 'default'
            }, async (err, data) => {
                if (err) {
                    console.log(colors.red + 'Erreur lors de l\'affichage du logo' + colors.reset);
                    return;
                }

                // Logo et bannière
                console.log('\n' + colors.bright.white + '═'.repeat(80) + colors.reset);
                console.log('\n' + colors.bright.cyan + data + colors.reset);
                console.log('\n' + colors.bright.white + '═'.repeat(80) + '\n' + colors.reset);

                // Initialisation des systèmes
                console.log(colors.bold + colors.bright.magenta + '⚙️  INITIALISATION DES SYSTÈMES' + colors.reset);
                console.log(colors.bright.green + '┌─ Slowmode: ' + colors.white + (await this.initSlowmode() ? '✅' : '❌'));
                console.log(colors.bright.green + '├─ FiveM: ' + colors.white + (await this.initFiveM() ? '✅' : '❌'));
                console.log(colors.bright.green + '└─ Server Monitor: ' + colors.white + (await this.initServerMonitor() ? '✅' : '❌'));

                // Informations du bot
                console.log(colors.bold + colors.bright.magenta + '⭐ INFORMATIONS DU BOT' + colors.reset);
                console.log(colors.bright.green + `┌─ 🤖 Bot Tag: ${colors.white}${this.client.user.tag}`);
                console.log(colors.bright.green + `├─ 📊 Serveurs: ${colors.white}${this.client.guilds.cache.size}`);
                console.log(colors.bright.green + `├─ 👥 Utilisateurs: ${colors.white}${this.client.users.cache.size}`);
                console.log(colors.bright.green + `└─ ⚡ Ping: ${colors.white}${this.client.ws.ping}ms\n`);

                // Statistiques système
                console.log(colors.bold + colors.bright.cyan + '🖥️  STATISTIQUES SYSTÈME' + colors.reset);
                console.log(colors.bright.blue + `┌─ 💻 Plateforme: ${colors.white}${process.platform}`);
                console.log(colors.bright.blue + `├─ 🧮 Mémoire: ${colors.white}${formatBytes(process.memoryUsage().heapUsed)}`);
                console.log(colors.bright.blue + `├─ ⚙️  CPU: ${colors.white}${os.cpus()[0].model}`);
                console.log(colors.bright.blue + `└─ 🕒 Uptime: ${colors.white}${formatUptime(this.client.uptime)}\n`);

                // Versions
                console.log(colors.bold + colors.bright.yellow + '📦 VERSIONS' + colors.reset);
                console.log(colors.bright.yellow + `┌─ Node.js: ${colors.white}${process.version}`);
                console.log(colors.bright.yellow + `├─ Discord.js: ${colors.white}v${djsversion}`);
                console.log(colors.bright.yellow + `├─ Bot: ${colors.white}v1.0.0`);
                console.log(colors.bright.yellow + `└─ Author: ${colors.white}Zira | zira.off` + colors.reset + '\n');

                // Ligne de séparation finale
                console.log(colors.bright.white + '═'.repeat(80) + colors.reset + '\n');

                // Configuration des gestionnaires
                await this.setupShutdownHandlers();
                await this.setupStatus();
                await hourlyRecorder.start();

                resolve();
            });
        });
    }
}

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        const initializer = new BotInitializer(client);
        await initializer.initialize();
    }
};
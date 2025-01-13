const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const CACHE_DURATION = 15000; // 15 secondes de cache
let lastFetch = 0;
let cachedData = null;

const SERVERS_FILE = path.join(__dirname, '../data/servers.json');

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

async function validateAndFormatAddress(address) {
    address = address.trim().toLowerCase();
    
    // Validation IP:PORT
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?):(?:\d{1,5})$/;
    if (ipRegex.test(address)) {
        return { type: 'ip', address };
    }
    
    // Validation CFX.re
    if (address.includes('cfx.re/join/')) {
        const cfxId = address.split('cfx.re/join/').pop().replace(/[^a-zA-Z0-9]/g, '');
        if (!cfxId) throw new Error('ID CFX invalide');
        return { type: 'cfx', address: `cfx.re/join/${cfxId}` };
    }
    
    throw new Error('Format d\'adresse invalide. Utilisez IP:PORT ou cfx.re/join/XXXXX');
}

async function getFivemServerInfo(addressData, guildId) {
    if (cachedData && Date.now() - lastFetch < CACHE_DURATION) {
        return cachedData;
    }
    
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'fr,fr-FR;q=0.9,en;q=0.8'
        };

        let endpoint;
        let playerList = [];
        
        if (addressData.type === 'cfx') {
            const cfxId = addressData.address.split('cfx.re/join/').pop();
            endpoint = `https://servers-frontend.fivem.net/api/servers/single/${cfxId}`;
            // Pour CFX, les joueurs sont inclus dans la réponse principale
        } else {
            const [ip, port] = addressData.address.split(':');
            endpoint = `http://${ip}:${port}/info.json`;
            // Pour IP:PORT, on fait une requête séparée pour les joueurs
            playerList = await getPlayerList(ip, port);
        }

        const response = await axios.get(endpoint, {
            headers,
            timeout: 5000,
            validateStatus: status => status < 500
        });

        if (response.status === 429) {
            console.warn('Rate limit atteint, attente avant nouvelle tentative');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return getFivemServerInfo(addressData);
        }

        const serverData = addressData.type === 'cfx' ? response.data.Data : response.data;
        
        // Si c'est un serveur CFX, on extrait la liste des joueurs de la réponse
        if (addressData.type === 'cfx' && serverData.players) {
            playerList = serverData.players;
        }

        const realPlayers = serverData?.clients || serverData?.players?.length || 0;
        const displayedPlayers = realPlayers === 0 ? 3 : realPlayers + 3;

        // Préparer les données des joueurs pour le tracker
        const playerInfos = playerList.map(player => ({
            id: player.id || player.identifiers?.find(id => id.startsWith('steam:')) || player.name,
            name: player.name,
            // Ajoutez d'autres informations si disponibles
        }));

        // Mettre à jour le tracker de joueurs
        if (guildId) {  // Assurez-vous d'avoir le guildId
            await playerTracker.updatePlayers(guildId, playerInfos);
        }

        const serverInfo = {
            hostname: serverData?.hostname || 'Non disponible',
            gametype: serverData?.vars?.gametype || serverData?.gametype || 'Non disponible',
            mapname: serverData?.vars?.mapname || serverData?.mapname || 'Non disponible',
            players: displayedPlayers,
            realPlayers: realPlayers,
            maxPlayers: serverData?.sv_maxclients || serverData?.maxPlayers || 0,
            status: true,
            playerList: playerInfos // Ajouter la liste des joueurs aux informations du serveur
        };
        
        lastFetch = Date.now();
        cachedData = serverInfo;
        return serverInfo;
    } catch (error) {
        console.error('Erreur lors de la récupération des informations:', error.message);
        return {
            hostname: 'Non disponible',
            gametype: 'Non disponible',
            mapname: 'Non disponible',
            players: 3,
            realPlayers: 0,
            maxPlayers: 0,
            status: false,
            playerList: []
        };
    }
}

async function getPlayerList(addressData) {
    try {
        let endpoint;
        if (addressData.type === 'cfx') {
            const cfxId = addressData.address.split('cfx.re/join/').pop();
            endpoint = `https://servers-frontend.fivem.net/api/servers/single/${cfxId}`;
            const response = await axios.get(endpoint);
            return response.data.Data.players || [];
        } else {
            const [ip, port] = addressData.address.split(':');
            endpoint = `http://${ip}:${port}/players.json`;
            const response = await axios.get(endpoint, {
                timeout: 5000,
                validateStatus: status => status < 500
            });
            return response.data;
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des joueurs:', error.message);
        return [];
    }
}

module.exports = {
    getFivemServerInfo,
    getServerAddress,
    setServerAddress,
    validateAndFormatAddress
};
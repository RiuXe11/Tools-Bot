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

const SPECIAL_CHARS_MAP = {
    // Style Mathématique Double Trait
    '𝔸': 'A', '𝔹': 'B', 'ℂ': 'C', '𝔻': 'D', '𝔼': 'E', '𝔽': 'F', '𝔾': 'G', 'ℍ': 'H', '𝕀': 'I',
    '𝕁': 'J', '𝕂': 'K', '𝕃': 'L', '𝕄': 'M', 'ℕ': 'N', '𝕆': 'O', 'ℙ': 'P', 'ℚ': 'Q', 'ℝ': 'R',
    '𝕊': 'S', '𝕋': 'T', '𝕌': 'U', '𝕍': 'V', '𝕎': 'W', '𝕏': 'X', '𝕐': 'Y', 'ℤ': 'Z',
    '𝕒': 'a', '𝕓': 'b', '𝕔': 'c', '𝕕': 'd', '𝕖': 'e', '𝕗': 'f', '𝕘': 'g', '𝕙': 'h', '𝕚': 'i',
    '𝕛': 'j', '𝕜': 'k', '𝕝': 'l', '𝕞': 'm', '𝕟': 'n', '𝕠': 'o', '𝕡': 'p', '𝕢': 'q', '𝕣': 'r',
    '𝕤': 's', '𝕥': 't', '𝕦': 'u', '𝕧': 'v', '𝕨': 'w', '𝕩': 'x', '𝕪': 'y', '𝕫': 'z',

    // Style Gothique
    '𝔄': 'A', '𝔅': 'B', 'ℭ': 'C', '𝔇': 'D', '𝔈': 'E', '𝔉': 'F', '𝔊': 'G', '𝔋': 'H', '𝔌': 'I',
    '𝔍': 'J', '𝔎': 'K', '𝔏': 'L', '𝔐': 'M', '𝔑': 'N', '𝔒': 'O', '𝔓': 'P', '𝔔': 'Q', '𝔕': 'R',
    '𝔖': 'S', '𝔗': 'T', '𝔘': 'U', '𝔙': 'V', '𝔚': 'W', '𝔛': 'X', '𝔜': 'Y', 'ℨ': 'Z',
    '𝔞': 'a', '𝔟': 'b', '𝔠': 'c', '𝔡': 'd', '𝔢': 'e', '𝔣': 'f', '𝔤': 'g', '𝔥': 'h', '𝔦': 'i',
    '𝔧': 'j', '𝔨': 'k', '𝔩': 'l', '𝔪': 'm', '𝔫': 'n', '𝔬': 'o', '𝔭': 'p', '𝔮': 'q', '𝔯': 'r',
    '𝔰': 's', '𝔱': 't', '𝔲': 'u', '𝔳': 'v', '𝔴': 'w', '𝔵': 'x', '𝔶': 'y', '𝔷': 'z',

    // Style Serif Gras
    '𝐀': 'A', '𝐁': 'B', '𝐂': 'C', '𝐃': 'D', '𝐄': 'E', '𝐅': 'F', '𝐆': 'G', '𝐇': 'H', '𝐈': 'I',
    '𝐉': 'J', '𝐊': 'K', '𝐋': 'L', '𝐌': 'M', '𝐍': 'N', '𝐎': 'O', '𝐏': 'P', '𝐐': 'Q', '𝐑': 'R',
    '𝐒': 'S', '𝐓': 'T', '𝐔': 'U', '𝐕': 'V', '𝐖': 'W', '𝐗': 'X', '𝐘': 'Y', '𝐙': 'Z',
    '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g', '𝐡': 'h', '𝐢': 'i',
    '𝐣': 'j', '𝐤': 'k', '𝐥': 'l', '𝐦': 'm', '𝐧': 'n', '𝐨': 'o', '𝐩': 'p', '𝐪': 'q', '𝐫': 'r',
    '𝐬': 's', '𝐭': 't', '𝐮': 'u', '𝐯': 'v', '𝐰': 'w', '𝐱': 'x', '𝐲': 'y', '𝐳': 'z',

    // Style Italique
    '𝐴': 'A', '𝐵': 'B', '𝐶': 'C', '𝐷': 'D', '𝐸': 'E', '𝐹': 'F', '𝐺': 'G', '𝐻': 'H', '𝐼': 'I',
    '𝐽': 'J', '𝐾': 'K', '𝐿': 'L', '𝑀': 'M', '𝑁': 'N', '𝑂': 'O', '𝑃': 'P', '𝑄': 'Q', '𝑅': 'R',
    '𝑆': 'S', '𝑇': 'T', '𝑈': 'U', '𝑉': 'V', '𝑊': 'W', '𝑋': 'X', '𝑌': 'Y', '𝑍': 'Z',
    '𝑎': 'a', '𝑏': 'b', '𝑐': 'c', '𝑑': 'd', '𝑒': 'e', '𝑓': 'f', '𝑔': 'g', '𝘩': 'h', '𝑖': 'i',
    '𝑗': 'j', '𝑘': 'k', '𝑙': 'l', '𝑚': 'm', '𝑛': 'n', '𝑜': 'o', '𝑝': 'p', '𝑞': 'q', '𝑟': 'r',
    '𝑠': 's', '𝑡': 't', '𝑢': 'u', '𝑣': 'v', '𝑤': 'w', '𝑥': 'x', '𝑦': 'y', '𝑧': 'z',

    // Style Script
    '𝒜': 'A', 'ℬ': 'B', '𝒞': 'C', '𝒟': 'D', 'ℰ': 'E', 'ℱ': 'F', '𝒢': 'G', 'ℋ': 'H', 'ℐ': 'I',
    '𝒥': 'J', '𝒦': 'K', 'ℒ': 'L', 'ℳ': 'M', '𝒩': 'N', '𝒪': 'O', '𝒫': 'P', '𝒬': 'Q', 'ℛ': 'R',
    '𝒮': 'S', '𝒯': 'T', '𝒰': 'U', '𝒱': 'V', '𝒲': 'W', '𝒳': 'X', '𝒴': 'Y', '𝒵': 'Z',
    '𝒶': 'a', '𝒷': 'b', '𝒸': 'c', '𝒹': 'd', 'ℯ': 'e', '𝒻': 'f', 'ℊ': 'g', '𝒽': 'h', '𝒾': 'i',
    '𝒿': 'j', '𝓀': 'k', '𝓁': 'l', '𝓂': 'm', '𝓃': 'n', 'ℴ': 'o', '𝓅': 'p', '𝓆': 'q', '𝓇': 'r',
    '𝓈': 's', '𝓉': 't', '𝓊': 'u', '𝓋': 'v', '𝓌': 'w', '𝓍': 'x', '𝓎': 'y', '𝓏': 'z',

    // Style Cercle
    'Ⓐ': 'A', 'Ⓑ': 'B', 'Ⓒ': 'C', 'Ⓓ': 'D', 'Ⓔ': 'E', 'Ⓕ': 'F', 'Ⓖ': 'G', 'Ⓗ': 'H', 'Ⓘ': 'I',
    'Ⓙ': 'J', 'Ⓚ': 'K', 'Ⓛ': 'L', 'Ⓜ': 'M', 'Ⓝ': 'N', 'Ⓞ': 'O', 'Ⓟ': 'P', 'Ⓠ': 'Q', 'Ⓡ': 'R',
    'Ⓢ': 'S', 'Ⓣ': 'T', 'Ⓤ': 'U', 'Ⓥ': 'V', 'Ⓦ': 'W', 'Ⓧ': 'X', 'Ⓨ': 'Y', 'Ⓩ': 'Z',
    'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e', 'ⓕ': 'f', 'ⓖ': 'g', 'ⓗ': 'h', 'ⓘ': 'i',
    'ⓙ': 'j', 'ⓚ': 'k', 'ⓛ': 'l', 'ⓜ': 'm', 'ⓝ': 'n', 'ⓞ': 'o', 'ⓟ': 'p', 'ⓠ': 'q', 'ⓡ': 'r',
    'ⓢ': 's', 'ⓣ': 't', 'ⓤ': 'u', 'ⓥ': 'v', 'ⓦ': 'w', 'ⓧ': 'x', 'ⓨ': 'y', 'ⓩ': 'z',

    // Style Carré
    '🄰': 'A', '🄱': 'B', '🄲': 'C', '🄳': 'D', '🄴': 'E', '🄵': 'F', '🄶': 'G', '🄷': 'H', '🄸': 'I',
    '🄹': 'J', '🄺': 'K', '🄻': 'L', '🄼': 'M', '🄽': 'N', '🄾': 'O', '🄿': 'P', '🅀': 'Q', '🅁': 'R',
    '🅂': 'S', '🅃': 'T', '🅄': 'U', '🅅': 'V', '🅆': 'W', '🅇': 'X', '🅈': 'Y', '🅉': 'Z',

    // Caractères accentués
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'á': 'a', 'à': 'a', 'â': 'a', 'ä': 'a', 'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', 'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'ö': 'o', 'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O',
    'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', 'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'ý': 'y', 'ÿ': 'y', 'Ý': 'Y', 'ñ': 'n', 'Ñ': 'N', 'ç': 'c', 'Ç': 'C',

    // Ligatures
    'æ': 'ae', 'Æ': 'AE',
    'œ': 'oe', 'Œ': 'OE',

    // Caractères nordiques
    'å': 'a', 'Å': 'A',
    'ø': 'o', 'Ø': 'O',
    'æ': 'ae', 'Æ': 'AE',

    // Style Small Caps
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i',
    'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ꞯ': 'q', 'ʀ': 'r',
    'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'x': 'x', 'ʏ': 'y', 'ᴢ': 'z',

    // Style monospace
    '𝚊': 'a', '𝚋': 'b', '𝚌': 'c', '𝚍': 'd', '𝚎': 'e', '𝚏': 'f', '𝚐': 'g', '𝚑': 'h', '𝚒': 'i',
    '𝚓': 'j', '𝚔': 'k', '𝚕': 'l', '𝚖': 'm', '𝚗': 'n', '𝚘': 'o', '𝚙': 'p', '𝚚': 'q', '𝚛': 'r',
    '𝚜': 's', '𝚝': 't', '𝚞': 'u', '𝚟': 'v', '𝚠': 'w', '𝚡': 'x', '𝚢': 'y', '𝚣': 'z',
    '𝙰': 'A', '𝙱': 'B', '𝙲': 'C', '𝙳': 'D', '𝙴': 'E', '𝙵': 'F', '𝙶': 'G', '𝙷': 'H', '𝙸': 'I',
    '𝙹': 'J', '𝙺': 'K', '𝙻': 'L', '𝙼': 'M', '𝙽': 'N', '𝙾': 'O', '𝙿': 'P', '𝚀': 'Q', '𝚁': 'R',
    '𝚂': 'S', '𝚃': 'T', '𝚄': 'U', '𝚅': 'V', '𝚆': 'W', '𝚇': 'X', '𝚈': 'Y', '𝚉': 'Z',

    // Style Bubble (Symboles supplémentaires)
    '🅐': 'a', '🅑': 'b', '🅒': 'c', '🅓': 'd', '🅔': 'e', '🅕': 'f', '🅖': 'g', '🅗': 'h', '🅘': 'i',
    '🅙': 'j', '🅚': 'k', '🅛': 'l', '🅜': 'm', '🅝': 'n', '🅞': 'o', '🅟': 'p', '🅠': 'q', '🅡': 'r',
    '🅢': 's', '🅣': 't', '🅤': 'u', '🅥': 'v', '🅦': 'w', '🅧': 'x', '🅨': 'y', '🅩': 'z',

    // Caractères spéciaux similaires à des lettres
    '0': 'o', 'ø': 'o', 'ⓞ': 'o',
    '1': 'i', 'ℹ': 'i',
    '3': 'e', 'ε': 'e',
    '4': 'a', '₳': 'a',
    '5': 's', '$': 's',
    '7': 't',
    '8': 'b',
    '@': 'a',

    // Caractères inversés
    'ɐ': 'a', 'q': 'b', 'ɔ': 'c', 'p': 'd', 'ǝ': 'e', 'ɟ': 'f', 'ƃ': 'g', 'ɥ': 'h', 'ᴉ': 'i',
    'ɾ': 'j', 'ʞ': 'k', 'ʃ': 'l', 'ɯ': 'm', 'u': 'n', 'o': 'o', 'd': 'p', 'b': 'q', 'ɹ': 'r',
    's': 's', 'ʇ': 't', 'n': 'u', 'ʌ': 'v', 'ʍ': 'w', 'x': 'x', 'ʎ': 'y', 'z': 'z',

    // Caractères mathématiques supplémentaires
    '∀': 'A', '𝔹': 'B', 'ℂ': 'C', '𝔻': 'D', '𝔼': 'E', '𝔽': 'F', '𝔾': 'G', 'ℍ': 'H', '𝕀': 'I',
    '𝕁': 'J', '𝕂': 'K', '𝕃': 'L', '𝕄': 'M', 'ℕ': 'N', '𝕆': 'O', 'ℙ': 'P', 'ℚ': 'Q', 'ℝ': 'R',
    '𝕊': 'S', '𝕋': 'T', '𝕌': 'U', '𝕍': 'V', '𝕎': 'W', '𝕏': 'X', '𝕐': 'Y', 'ℤ': 'Z',

    // Autres variations de caractères
    'ă': 'a', 'ą': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
    'ć': 'c', 'č': 'c', 'ċ': 'c',
    'ď': 'd', 'đ': 'd',
    'ę': 'e', 'ě': 'e', 'ė': 'e',
    'ğ': 'g', 'ģ': 'g', 'ġ': 'g',
    'ħ': 'h', 'ĥ': 'h',
    'ĩ': 'i', 'ī': 'i', 'ĭ': 'i',
    'ķ': 'k',
    'ł': 'l', 'ļ': 'l', 'ĺ': 'l',
    'ń': 'n', 'ň': 'n', 'ņ': 'n',
    'ő': 'o', 'ō': 'o', 'ŏ': 'o',
    'ŕ': 'r', 'ř': 'r',
    'ś': 's', 'š': 's', 'ş': 's',
    'ť': 't', 'ţ': 't',
    'ũ': 'u', 'ū': 'u', 'ŭ': 'u',
    'ŵ': 'w',
    'ŷ': 'y',
    'ź': 'z', 'ž': 'z', 'ż': 'z',
};

function normalizeSpecialChars(text) {
    return text.split('').map(char => SPECIAL_CHARS_MAP[char] || char).join('');
}

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
    
    // Liste des variantes à vérifier
    let wordsToCheck = [keywordText, ...keywordList];

    // Normalisation du message selon les options
    if (keyword.detectFont) {
        messageContent = normalizeSpecialChars(messageContent.normalize('NFKC'));
        wordsToCheck = wordsToCheck.map(word => 
            normalizeSpecialChars(word.normalize('NFKC'))
        );
    }

    if (keyword.detectCharacters) {
        messageContent = normalizeText(messageContent);
        wordsToCheck = wordsToCheck.map(word => normalizeText(word));
    }

    if (keyword.detectSpaces) {
        messageContent = cleanSpaces(messageContent);
        wordsToCheck = wordsToCheck.map(word => cleanSpaces(word));
    }

    // Vérifier si l'un des mots est inclus dans le message
    return wordsToCheck.some(word => {
        // Ignorer la casse et les caractères spéciaux
        const processedWord = word.toLowerCase();
        return messageContent.includes(processedWord);
    });
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

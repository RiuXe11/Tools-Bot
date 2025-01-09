const { AttachmentBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const axios = require('axios');

module.exports = {
    name: 'recup-emoji',
    description: 'Télécharge tous les emojis du serveur dans un fichier zip',
    async execute(message, args) {
        // Vérifier les permissions
        if (!message.member.permissions.has('ManageEmojisAndStickers')) {
            return message.reply('❌ Vous n\'avez pas la permission de gérer les emojis.');
        }

        try {
            // Créer un message de chargement
            const loadingMsg = await message.reply('⌛ Récupération des emojis en cours...');

            // Créer le dossier temporaire
            const tempDir = path.join(__dirname, '../../temp/emojis');
            await fs.mkdir(tempDir, { recursive: true });

            // Créer une nouvelle instance de zip
            const zip = new AdmZip();

            // Récupérer tous les emojis
            const emojis = message.guild.emojis.cache;
            let downloadedCount = 0;

            // Télécharger chaque emoji
            for (const [id, emoji] of emojis) {
                const extension = emoji.animated ? 'gif' : 'png';
                const fileName = `${emoji.name}-${id}.${extension}`;

                try {
                    // Télécharger l'emoji
                    const response = await axios.get(emoji.url, { responseType: 'arraybuffer' });
                    
                    // Ajouter au zip
                    zip.addFile(fileName, Buffer.from(response.data));
                    
                    downloadedCount++;

                    // Mettre à jour le message de chargement tous les 5 emojis
                    if (downloadedCount % 5 === 0) {
                        await loadingMsg.edit(`⌛ Téléchargement des emojis... ${downloadedCount}/${emojis.size}`);
                    }
                } catch (err) {
                    console.error(`Erreur lors du téléchargement de l'emoji ${emoji.name}:`, err);
                }
            }

            // Générer le fichier zip
            const zipPath = path.join(tempDir, 'emojis.zip');
            zip.writeZip(zipPath);

            // Envoyer le fichier
            const attachment = new AttachmentBuilder(zipPath, {
                name: `${message.guild.name}-emojis.zip`
            });

            await message.reply({
                content: `✅ Archive des emojis créée ! ${downloadedCount} emojis sur ${emojis.size} récupérés.`,
                files: [attachment]
            });

            // Nettoyer les fichiers temporaires
            await fs.rm(tempDir, { recursive: true, force: true });
            await loadingMsg.delete().catch(() => {});

        } catch (error) {
            console.error('Erreur lors de la récupération des emojis:', error);
            return message.reply('❌ Une erreur est survenue lors de la récupération des emojis.');
        }
    },
};
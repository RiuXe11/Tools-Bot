const { handleAnonymousCommand } = require('../../utils/anonymeManager');

module.exports = {
    name: 'anonyme',
    description: 'Gère les salons anonymes',
    category: 'moderation',
    usage: '[setup/disable/config]',
    execute(message, args) {
        return handleAnonymousCommand(message, args);
    }
};
/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.addConstraint(
    'user_editable_games',
    'user_editable_games_user_wallet_address_game_name_key',
    {
      unique: ['user_wallet_address', 'game_name'],
    }
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropConstraint(
    'user_editable_games',
    'user_editable_games_user_wallet_address_game_name_key'
  );
};

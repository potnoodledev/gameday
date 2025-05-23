/* eslint-disable @typescript-eslint/naming-convention */

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('user_editable_games', {
    username: {
      type: 'VARCHAR(255)',
      notNull: true,
      default: 'Anonymous' // Temporary default value for existing rows
    }
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropColumn('user_editable_games', 'username');
}; 
/* eslint-disable @typescript-eslint/naming-convention */

// For more information about node-pg-migrate actions and types:
// https://salsita.github.io/node-pg-migrate/#/migrations?id=defining-migrations

/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.addColumn('user_profiles', {
    username: {
      type: 'VARCHAR(255)',
      unique: true,
      // Nullable by default, which is what we want
    }
  });
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropColumn('user_profiles', 'username');
}; 
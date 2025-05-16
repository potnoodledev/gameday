/* eslint-disable @typescript-eslint/naming-convention */

// For more information about node-pg-migrate actions and types:
// https://salsita.github.io/node-pg-migrate/#/migrations?id=defining-migrations

/**
 * @type {import('node-pg-migrate').ColumnDefinitions}
 */
exports.shorthands = undefined;

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  // Step 1: Add profile_picture_data to the user_profiles table
  pgm.addColumn('user_profiles', {
    profile_picture_data: { type: 'BYTEA' } // BYTEA is suitable for binary data in PostgreSQL
  });

  // Step 2: Create the user_editable_games table
  pgm.createTable('user_editable_games', {
    id: 'id', // This creates a SERIAL PRIMARY KEY by default for this table
    user_wallet_address: { // Changed from user_id to reflect the target PK
      type: 'TEXT',         // Matching the type of user_profiles.wallet_address
      notNull: true,
      references: 'user_profiles(wallet_address)', // Referencing user_profiles table and wallet_address column
      onDelete: 'CASCADE'   // If a user_profile is deleted, their games are also deleted
    },
    game_name: { type: 'VARCHAR(255)' }, // Optional: if games have names/titles
    html_content: { type: 'TEXT', notNull: true }, // For storing the game's HTML content
    created_at: {
      type: 'TIMESTAMP WITH TIME ZONE',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'TIMESTAMP WITH TIME ZONE',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  // Optional: Create an index for faster lookups of games by user_wallet_address
  pgm.createIndex('user_editable_games', 'user_wallet_address');
};

/**
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  // Actions to reverse the 'up' migration
  // Order is typically the reverse of the 'up' migration

  pgm.dropIndex('user_editable_games', 'user_wallet_address');
  pgm.dropTable('user_editable_games');
  pgm.dropColumn('user_profiles', 'profile_picture_data');
}; 
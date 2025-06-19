-- Disable foreign key constraints temporarily to allow safe table deletion
PRAGMA foreign_keys = OFF;

-- Drop all tables in any order (foreign key constraints are disabled)
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS ai_assistants;
DROP TABLE IF EXISTS ai_models;
DROP TABLE IF EXISTS ai_providers;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;
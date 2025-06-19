CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `account_providerId_accountId_idx` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE TABLE `rateLimit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`count` integer,
	`lastRequest` integer
);
--> statement-breakpoint
CREATE INDEX `rateLimit_key_idx` ON `rateLimit` (`key`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `session_token_idx` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `todo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`userId` text NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_userId_idx` ON `todo` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `ai_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`base_url` text,
	`api_version` text,
	`status` text DEFAULT 'active' NOT NULL,
	`details` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `ai_providers__status__idx` ON `ai_providers` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_providers__slug__unq` ON `ai_providers` (`slug`);--> statement-breakpoint
CREATE TABLE `ai_models` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` text,
	`aliases` text DEFAULT '[]',
	`provider_id` text NOT NULL,
	`input_modalities` text DEFAULT '[]',
	`output_modalities` text DEFAULT '[]',
	`is_preview_model` integer DEFAULT false NOT NULL,
	`is_premium_model` integer DEFAULT false NOT NULL,
	`max_input_tokens` integer,
	`max_output_tokens` integer,
	`documentation_link` text,
	`details` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	`deleted_at` integer,
	FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_models__provider_id__idx` ON `ai_models` (`provider_id`);--> statement-breakpoint
CREATE INDEX `ai_models__status__idx` ON `ai_models` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_models__slug__unq` ON `ai_models` (`slug`);--> statement-breakpoint
CREATE TABLE `ai_assistants` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`init_messages` text,
	`status` text DEFAULT 'active' NOT NULL,
	`mode` text DEFAULT 'instant' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`scope` text DEFAULT 'user' NOT NULL,
	`details` text,
	`model_id` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	`deleted_at` integer,
	FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ai_assistants__slug__idx` ON `ai_assistants` (`slug`);--> statement-breakpoint
CREATE INDEX `ai_assistants__model_id__idx` ON `ai_assistants` (`model_id`);--> statement-breakpoint
CREATE INDEX `ai_assistants__scope__idx` ON `ai_assistants` (`scope`);--> statement-breakpoint
CREATE INDEX `ai_assistants__status__idx` ON `ai_assistants` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_assistants__slug__unq` ON `ai_assistants` (`slug`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`parts` text,
	`attachments` text,
	`status` text DEFAULT 'received' NOT NULL,
	`reference_id` text,
	`details` text,
	`user_id` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	`deleted_at` integer,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_messages__conversation_id__idx` ON `chat_messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `chat_messages__role__idx` ON `chat_messages` (`role`);--> statement-breakpoint
CREATE INDEX `chat_messages__reference_id__idx` ON `chat_messages` (`reference_id`);--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`assistant_id` text,
	`user_id` text,
	`model_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`history` text DEFAULT 'persistent' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`details` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000),
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000),
	`is_deleted` integer DEFAULT false,
	`deleted_by` text,
	`deleted_at` integer,
	`last_message_at` integer,
	FOREIGN KEY (`assistant_id`) REFERENCES `ai_assistants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `ai_models`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chat_conversations__assistant_id__idx` ON `chat_conversations` (`assistant_id`);--> statement-breakpoint
CREATE INDEX `chat_conversations__user_id__idx` ON `chat_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `chat_conversations__status__idx` ON `chat_conversations` (`status`);--> statement-breakpoint
CREATE INDEX `chat_conversations__visibility__idx` ON `chat_conversations` (`visibility`);--> statement-breakpoint
CREATE INDEX `chat_conversations__created_at__idx` ON `chat_conversations` (`created_at`);--> statement-breakpoint
CREATE INDEX `chat_conversations__last_message_at__idx` ON `chat_conversations` (`last_message_at`);
-- CreateTable
CREATE TABLE `audit_cycles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `units` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `username` VARCHAR(190) NULL,
    `password` VARCHAR(255) NULL,
    `sso_id` VARCHAR(190) NULL,
    `role` ENUM('superadmin', 'lpm_admin', 'lpm_member', 'auditee_head', 'auditee_member', 'pengunjung') NOT NULL,
    `unit_id` INTEGER NULL,
    `is_unit_head` BOOLEAN NOT NULL DEFAULT false,
    `is_lpm_head` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `session_version` INTEGER NOT NULL DEFAULT 0,
    `consented_at` DATETIME(3) NULL,
    `consent_version` VARCHAR(40) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_unit_id_idx`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_memberships` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL DEFAULT 'member',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `unit_memberships_unit_id_idx`(`unit_id`),
    INDEX `unit_memberships_user_id_idx`(`user_id`),
    UNIQUE INDEX `unit_memberships_user_id_unit_id_key`(`user_id`, `unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `type` ENUM('penetapan', 'evaluasi') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(255) NULL,
    `link` VARCHAR(500) NULL,
    `uploaded_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `documents_cycle_id_idx`(`cycle_id`),
    INDEX `documents_type_idx`(`type`),
    INDEX `documents_file_path_idx`(`file_path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_standards` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `scope_type` VARCHAR(20) NOT NULL DEFAULT 'all',
    `scope_category` VARCHAR(80) NULL,
    `scope_unit_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `audit_standards_cycle_id_idx`(`cycle_id`),
    INDEX `audit_standards_scope_unit_id_idx`(`scope_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `standard_id` INTEGER NOT NULL,
    `question_text` TEXT NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `scope_type` VARCHAR(20) NOT NULL DEFAULT 'all',
    `scope_category` VARCHAR(80) NULL,
    `scope_unit_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `audit_questions_cycle_id_idx`(`cycle_id`),
    INDEX `audit_questions_standard_id_idx`(`standard_id`),
    INDEX `audit_questions_scope_unit_id_idx`(`scope_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `audit_question_id` INTEGER NOT NULL,
    `answer` ENUM('ya', 'tidak') NULL,
    `evidence_file` VARCHAR(255) NULL,
    `evidence_link` VARCHAR(500) NULL,
    `reason` TEXT NULL,
    `status` ENUM('pending', 'verified', 'revision') NOT NULL DEFAULT 'pending',
    `lpm_notes` TEXT NULL,
    `rtl` TEXT NULL,
    `verified_by` INTEGER NULL,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `audit_responses_unit_id_idx`(`unit_id`),
    INDEX `audit_responses_cycle_id_idx`(`cycle_id`),
    INDEX `audit_responses_status_idx`(`status`),
    INDEX `audit_responses_evidence_file_idx`(`evidence_file`),
    UNIQUE INDEX `audit_responses_cycle_id_unit_id_audit_question_id_key`(`cycle_id`, `unit_id`, `audit_question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_progress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cycle_id` INTEGER NOT NULL,
    `unit_id` INTEGER NOT NULL,
    `status` VARCHAR(40) NOT NULL DEFAULT 'belum_mulai',
    `last_updated_by` INTEGER NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `unit_progress_cycle_id_unit_id_key`(`cycle_id`, `unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `app_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(120) NOT NULL,
    `value` TEXT NULL,
    `is_secret` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` INTEGER NULL,

    UNIQUE INDEX `app_settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(190) NOT NULL,
    `user_id` INTEGER NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `method` VARCHAR(20) NOT NULL DEFAULT 'password',
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(400) NULL,
    `message` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_logs_created_at_idx`(`created_at`),
    INDEX `login_logs_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `user_name` VARCHAR(160) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entity` VARCHAR(80) NULL,
    `entity_id` VARCHAR(80) NULL,
    `detail` VARCHAR(500) NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_created_at_idx`(`created_at`),
    INDEX `activity_logs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_memberships` ADD CONSTRAINT `unit_memberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_memberships` ADD CONSTRAINT `unit_memberships_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_standards` ADD CONSTRAINT `fk_audit_standards_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_standards` ADD CONSTRAINT `fk_audit_standards_scope_unit` FOREIGN KEY (`scope_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_questions` ADD CONSTRAINT `fk_audit_questions_cycle` FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_questions` ADD CONSTRAINT `fk_audit_questions_standard` FOREIGN KEY (`standard_id`) REFERENCES `audit_standards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_questions` ADD CONSTRAINT `fk_audit_questions_scope_unit` FOREIGN KEY (`scope_unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_audit_question_id_fkey` FOREIGN KEY (`audit_question_id`) REFERENCES `audit_questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_verified_by_fkey` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_progress` ADD CONSTRAINT `unit_progress_cycle_id_fkey` FOREIGN KEY (`cycle_id`) REFERENCES `audit_cycles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_progress` ADD CONSTRAINT `unit_progress_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_progress` ADD CONSTRAINT `unit_progress_last_updated_by_fkey` FOREIGN KEY (`last_updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

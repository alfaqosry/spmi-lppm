-- Migrasi manual: cakupan (scope) pada audit_standards + penamaan ulang FK.
-- Sumber perubahan skema: commit e7095b2 (alfaqosry, 20 Okt 2026).
--
-- Mengapa manual: `prisma db push` (Prisma 6.19, MySQL) menghasilkan DROP FOREIGN KEY
-- ganda untuk perubahan ini dan gagal di tengah jalan ("Can't DROP
-- 'audit_standards_cycle_id_fkey'"). Skrip ini setara dengan skema baru; setelah
-- dijalankan `prisma migrate diff` terhadap schema.prisma harus kosong.
--
-- Keamanan data: TIDAK ada DROP TABLE / DROP COLUMN / DELETE / UPDATE. Hanya:
--   + 3 kolom baru (scope_type default 'all' => standar lama berlaku untuk semua unit)
--   - unique index (cycle_id, name)  -> nama standar boleh sama bila cakupannya berbeda
--   ~ nama constraint FK (struktur & aturan ON DELETE tetap sama)
-- Diuji pada salinan produksi 20 Okt 2026: jumlah baris 12 tabel identik sebelum/sesudah.

ALTER TABLE `audit_questions`
  DROP FOREIGN KEY `audit_questions_cycle_id_fkey`,
  DROP FOREIGN KEY `audit_questions_scope_unit_id_fkey`,
  DROP FOREIGN KEY `audit_questions_standard_id_fkey`;

ALTER TABLE `audit_standards`
  DROP FOREIGN KEY `audit_standards_cycle_id_fkey`;

DROP INDEX `audit_standards_cycle_id_name_key` ON `audit_standards`;

ALTER TABLE `audit_standards`
  ADD COLUMN `scope_type` VARCHAR(20) NOT NULL DEFAULT 'all',
  ADD COLUMN `scope_category` VARCHAR(80) NULL,
  ADD COLUMN `scope_unit_id` INT NULL;

CREATE INDEX `audit_standards_scope_unit_id_idx` ON `audit_standards` (`scope_unit_id`);

ALTER TABLE `audit_standards`
  ADD CONSTRAINT `fk_audit_standards_cycle` FOREIGN KEY (`cycle_id`)
    REFERENCES `audit_cycles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_standards_scope_unit` FOREIGN KEY (`scope_unit_id`)
    REFERENCES `units` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `audit_questions`
  ADD CONSTRAINT `fk_audit_questions_cycle` FOREIGN KEY (`cycle_id`)
    REFERENCES `audit_cycles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_questions_standard` FOREIGN KEY (`standard_id`)
    REFERENCES `audit_standards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_audit_questions_scope_unit` FOREIGN KEY (`scope_unit_id`)
    REFERENCES `units` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

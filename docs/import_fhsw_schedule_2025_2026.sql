-- Import scraped from:
-- https://historycznesztukiwalki.pl/grafik-treningow/
--
-- Target DB: MySQL/MariaDB schema used by backend.
-- This import is idempotent by training_form.name, season.name and exact schedule slot.
--
-- Regular weekly classes use one season:
--   FHSW 2025/2026, 2025-09-29 .. 2026-06-28
--
-- Montante and Bicze have explicit irregular dates on the source page.
-- The current schedule model only supports weekly / bi-weekly / monthly cycles,
-- so these are represented as one-day seasons with one WEEKLY schedule each.

START TRANSACTION;

SET @main_season_name = 'FHSW 2025/2026';

INSERT INTO season (name, start_date, end_date, is_finished, created_at)
SELECT @main_season_name, '2025-09-29', '2026-06-28', 0, NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM season
    WHERE name = @main_season_name
);

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_training_form;
CREATE TEMPORARY TABLE tmp_fhsw_training_form (
    name VARCHAR(100) NOT NULL PRIMARY KEY,
    description VARCHAR(500) NULL
);

INSERT INTO tmp_fhsw_training_form (name, description) VALUES
('Rapier (Grupa Zaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Historyczny (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Walka w Zbroi', 'Import z grafiku FHSW 2025/2026.'),
('Kenjutsu (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Szabla (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Turniejowy (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Szabla (Grupa Zaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Poleaxe', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Turniejowy (Grupa Zaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Arena', 'Import z grafiku FHSW 2025/2026.'),
('Łucznictwo Tradycyjne', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Historyczny (Grupa Średniozaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Historyczny (Grupa Zaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Rapier (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Miecz Długi Blossfechten', 'Import z grafiku FHSW 2025/2026.'),
('Rapier (Grupa Średniozaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Miecz i puklerz', 'Import z grafiku FHSW 2025/2026.'),
('Forum', 'Import z grafiku FHSW 2025/2026.'),
('Miecz i Tarcza (Grupa Początkująca)', 'Import z grafiku FHSW 2025/2026.'),
('Kord / Messer', 'Import z grafiku FHSW 2025/2026.'),
('Miecz i Tarcza (Grupa Zaawansowana)', 'Import z grafiku FHSW 2025/2026.'),
('Zapasy Historyczne', 'Import z grafiku FHSW 2025/2026.'),
('Montante - Iberyjski Miecz Dwuręczny', 'Import z grafiku FHSW 2025/2026. Zajęcia w konkretnych terminach.'),
('Bicze', 'Import z grafiku FHSW 2025/2026. Zajęcia w konkretnych terminach.');

INSERT IGNORE INTO training_form (name, description, created_at)
SELECT name, description, NOW()
FROM tmp_fhsw_training_form;

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_weekly_schedule;
CREATE TEMPORARY TABLE tmp_fhsw_weekly_schedule (
    training_form_name VARCHAR(100) NOT NULL,
    day_of_week VARCHAR(16) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

INSERT INTO tmp_fhsw_weekly_schedule (training_form_name, day_of_week, start_time, end_time) VALUES
('Rapier (Grupa Zaawansowana)', 'MONDAY', '18:00:00', '19:30:00'),
('Miecz Długi Historyczny (Grupa Początkująca)', 'MONDAY', '18:00:00', '19:30:00'),
('Miecz Długi Historyczny (Grupa Początkująca)', 'MONDAY', '19:30:00', '21:00:00'),
('Walka w Zbroi', 'MONDAY', '19:30:00', '21:00:00'),
('Kenjutsu (Grupa Początkująca)', 'TUESDAY', '18:00:00', '19:00:00'),
('Szabla (Grupa Początkująca)', 'TUESDAY', '18:00:00', '19:00:00'),
('Miecz Długi Turniejowy (Grupa Początkująca)', 'TUESDAY', '19:00:00', '20:00:00'),
('Szabla (Grupa Zaawansowana)', 'TUESDAY', '19:00:00', '20:00:00'),
('Poleaxe', 'TUESDAY', '20:00:00', '21:00:00'),
('Miecz Długi Turniejowy (Grupa Zaawansowana)', 'TUESDAY', '20:00:00', '21:30:00'),
('Arena', 'TUESDAY', '21:30:00', '22:30:00'),
('Łucznictwo Tradycyjne', 'WEDNESDAY', '17:30:00', '19:00:00'),
('Miecz Długi Historyczny (Grupa Początkująca)', 'WEDNESDAY', '17:30:00', '19:00:00'),
('Miecz Długi Historyczny (Grupa Średniozaawansowana)', 'WEDNESDAY', '19:00:00', '20:30:00'),
('Miecz Długi Historyczny (Grupa Zaawansowana)', 'WEDNESDAY', '20:30:00', '22:00:00'),
('Rapier (Grupa Początkująca)', 'THURSDAY', '18:00:00', '19:30:00'),
('Miecz Długi Blossfechten', 'THURSDAY', '18:15:00', '19:30:00'),
('Rapier (Grupa Średniozaawansowana)', 'THURSDAY', '19:30:00', '21:00:00'),
('Miecz i puklerz', 'THURSDAY', '19:30:00', '20:45:00'),
('Forum', 'THURSDAY', '20:30:00', '21:30:00'),
('Łucznictwo Tradycyjne', 'FRIDAY', '17:30:00', '19:00:00'),
('Miecz Długi Turniejowy (Grupa Początkująca)', 'FRIDAY', '19:00:00', '20:00:00'),
('Miecz i Tarcza (Grupa Początkująca)', 'FRIDAY', '19:00:00', '20:30:00'),
('Kord / Messer', 'FRIDAY', '19:00:00', '20:30:00'),
('Miecz i Tarcza (Grupa Zaawansowana)', 'FRIDAY', '20:30:00', '22:00:00'),
('Zapasy Historyczne', 'SATURDAY', '10:00:00', '12:00:00'),
('Zapasy Historyczne', 'SATURDAY', '12:00:00', '13:00:00');

INSERT INTO schedule (
    training_form_id,
    season_id,
    day_of_week,
    schedule_cycle,
    start_time,
    end_time,
    max_participants,
    is_deleted,
    created_at
)
SELECT
    tf.id,
    s.id,
    weekly.day_of_week,
    'WEEKLY',
    weekly.start_time,
    weekly.end_time,
    NULL,
    0,
    NOW()
FROM tmp_fhsw_weekly_schedule weekly
JOIN training_form tf ON tf.name = weekly.training_form_name
JOIN season s ON s.name = @main_season_name
WHERE NOT EXISTS (
    SELECT 1
    FROM schedule existing
    WHERE existing.training_form_id = tf.id
      AND existing.season_id = s.id
      AND existing.day_of_week = weekly.day_of_week
      AND existing.schedule_cycle = 'WEEKLY'
      AND existing.start_time = weekly.start_time
      AND existing.end_time = weekly.end_time
);

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_one_off_schedule;
CREATE TEMPORARY TABLE tmp_fhsw_one_off_schedule (
    series_name VARCHAR(32) NOT NULL,
    training_form_name VARCHAR(100) NOT NULL,
    event_date DATE NOT NULL,
    day_of_week VARCHAR(16) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    PRIMARY KEY (series_name, event_date)
);

INSERT INTO tmp_fhsw_one_off_schedule (
    series_name,
    training_form_name,
    event_date,
    day_of_week,
    start_time,
    end_time
) VALUES
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-10-04', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-10-11', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-11-08', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-11-16', 'SUNDAY', '13:00:00', '16:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-12-06', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2025-12-13', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-01-17', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-01-24', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-02-07', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-02-14', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-03-07', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-03-15', 'SUNDAY', '13:00:00', '16:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-04-18', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-04-25', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-05-09', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-05-23', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-06-06', 'SATURDAY', '13:00:00', '15:00:00'),
('Montante', 'Montante - Iberyjski Miecz Dwuręczny', '2026-06-27', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2025-10-18', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2025-10-25', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2025-11-15', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2025-11-29', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2025-12-20', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-01-03', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-01-10', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-01-31', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-02-21', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-02-28', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-03-21', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-04-11', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-05-02', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-05-16', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-06-13', 'SATURDAY', '13:00:00', '15:00:00'),
('Bicze', 'Bicze', '2026-06-20', 'SATURDAY', '13:00:00', '15:00:00');

INSERT INTO season (name, start_date, end_date, is_finished, created_at)
SELECT DISTINCT
    CONCAT('FHSW one-off ', one_off.event_date, ' ', one_off.series_name),
    one_off.event_date,
    one_off.event_date,
    0,
    NOW()
FROM tmp_fhsw_one_off_schedule one_off
WHERE NOT EXISTS (
    SELECT 1
    FROM season existing
    WHERE existing.name = CONCAT('FHSW one-off ', one_off.event_date, ' ', one_off.series_name)
);

INSERT INTO schedule (
    training_form_id,
    season_id,
    day_of_week,
    schedule_cycle,
    start_time,
    end_time,
    max_participants,
    is_deleted,
    created_at
)
SELECT
    tf.id,
    s.id,
    one_off.day_of_week,
    'WEEKLY',
    one_off.start_time,
    one_off.end_time,
    NULL,
    0,
    NOW()
FROM tmp_fhsw_one_off_schedule one_off
JOIN training_form tf ON tf.name = one_off.training_form_name
JOIN season s ON s.name = CONCAT('FHSW one-off ', one_off.event_date, ' ', one_off.series_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM schedule existing
    WHERE existing.training_form_id = tf.id
      AND existing.season_id = s.id
      AND existing.day_of_week = one_off.day_of_week
      AND existing.schedule_cycle = 'WEEKLY'
      AND existing.start_time = one_off.start_time
      AND existing.end_time = one_off.end_time
);

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_one_off_schedule;
DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_weekly_schedule;
DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_training_form;

COMMIT;

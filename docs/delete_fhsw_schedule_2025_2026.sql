-- Delete data inserted by docs/import_fhsw_schedule_2025_2026.sql.
--
-- Target DB: MySQL/MariaDB schema used by backend.
-- This removes only FHSW import records identified by imported season names
-- and training form descriptions/names.

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_season_ids;
CREATE TEMPORARY TABLE tmp_fhsw_import_season_ids (
    id INT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_fhsw_import_season_ids (id)
SELECT id
FROM season
WHERE name = 'FHSW 2025/2026'
   OR name LIKE 'FHSW one-off % Montante'
   OR name LIKE 'FHSW one-off % Bicze';

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_training_form_ids;
CREATE TEMPORARY TABLE tmp_fhsw_import_training_form_ids (
    id INT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_fhsw_import_training_form_ids (id)
SELECT id
FROM training_form
WHERE description LIKE 'Import z grafiku FHSW 2025/2026.%'
   OR name IN (
      'Rapier (Grupa Zaawansowana)',
      'Miecz Długi Historyczny (Grupa Początkująca I)',
      'Miecz Długi Historyczny (Grupa Początkująca III - od marca)',
      'Walka w Zbroi (wszystkie poziomy zaawansowania)',
      'Kenjutsu (Grupa Początkująca)',
      'Szabla (Grupa Początkująca)',
      'Miecz Długi Turniejowy (Grupa Początkująca I)',
      'Szabla (Grupa Zaawansowana)',
      'Poleaxe (wszystkie poziomy zaawansowania)',
      'Miecz Długi Turniejowy (Grupa Zaawansowana I)',
      'Arena (wszystkie poziomy zaawansowania)',
      'Łucznictwo Tradycyjne (Wolne Tory do Strzelania)',
      'Miecz Długi Historyczny (Grupa Początkująca II)',
      'Miecz Długi Historyczny (Grupa Średniozaawansowana)',
      'Miecz Długi Historyczny (Grupa Zaawansowana)',
      'Rapier (Grupa Początkująca)',
      'Miecz Długi Blossfechten (Grupa Średniozaawansowana i Zaawansowana)',
      'Rapier (Grupa Średniozaawansowana)',
      'Miecz i puklerz (wszystkie poziomy zaawansowania)',
      'Forum (wszystkie poziomy zaawansowania)',
      'Miecz Długi Turniejowy (Grupa Początkująca II - od marca)',
      'Miecz i Tarcza (Grupa Początkująca)',
      'Kord / Messer (wszystkie poziomy zaawansowania)',
      'Miecz i Tarcza (Grupa Zaawansowana)',
      'Zapasy Historyczne (Grupa Początkująca)',
      'Zapasy Historyczne (Grupa Zaawansowana)',
      'Montante - Iberyjski Miecz Dwuręczny (wszystkie poziomy zaawansowania)',
      'Bicze (wszystkie poziomy zaawansowania)'
   );

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_schedule_ids;
CREATE TEMPORARY TABLE tmp_fhsw_import_schedule_ids (
    id INT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_fhsw_import_schedule_ids (id)
SELECT schedule.id
FROM schedule
JOIN tmp_fhsw_import_season_ids season_ids ON season_ids.id = schedule.season_id
JOIN tmp_fhsw_import_training_form_ids form_ids ON form_ids.id = schedule.training_form_id;

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_training_session_ids;
CREATE TEMPORARY TABLE tmp_fhsw_import_training_session_ids (
    id INT NOT NULL PRIMARY KEY
);

INSERT INTO tmp_fhsw_import_training_session_ids (id)
SELECT training_session.id
FROM training_session
JOIN tmp_fhsw_import_schedule_ids schedule_ids ON schedule_ids.id = training_session.schedule_id;

-- Attendance audit logs reference attendances and sessions, so delete them before sessions/attendance.
DELETE attendance_change_log
FROM attendance_change_log
LEFT JOIN training_session_attendance_m2m attendance
    ON attendance.id = attendance_change_log.attendance_id
LEFT JOIN tmp_fhsw_import_training_session_ids session_ids_by_log
    ON session_ids_by_log.id = attendance_change_log.session_id
LEFT JOIN tmp_fhsw_import_training_session_ids session_ids_by_attendance
    ON session_ids_by_attendance.id = attendance.session_id
WHERE session_ids_by_log.id IS NOT NULL
   OR session_ids_by_attendance.id IS NOT NULL;

DELETE attendance
FROM training_session_attendance_m2m attendance
JOIN tmp_fhsw_import_training_session_ids session_ids
    ON session_ids.id = attendance.session_id;

DELETE training_session
FROM training_session
JOIN tmp_fhsw_import_training_session_ids session_ids
    ON session_ids.id = training_session.id;

DELETE schedule
FROM schedule
JOIN tmp_fhsw_import_schedule_ids schedule_ids
    ON schedule_ids.id = schedule.id;

DELETE season
FROM season
JOIN tmp_fhsw_import_season_ids season_ids
    ON season_ids.id = season.id;

DELETE training_form
FROM training_form
JOIN tmp_fhsw_import_training_form_ids form_ids
    ON form_ids.id = training_form.id
WHERE NOT EXISTS (
    SELECT 1
    FROM schedule
    WHERE schedule.training_form_id = training_form.id
);

DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_training_session_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_schedule_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_training_form_ids;
DROP TEMPORARY TABLE IF EXISTS tmp_fhsw_import_season_ids;

COMMIT;

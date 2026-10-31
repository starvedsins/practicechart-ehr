CREATE FUNCTION next_record_number(prefix text, sequence_name regclass) RETURNS text LANGUAGE plpgsql AS $$
DECLARE number_text text;
BEGIN
  number_text := nextval(sequence_name)::text;
  RETURN prefix || lpad(number_text, greatest(6, length(number_text)), '0');
END$$;
ALTER TABLE patients ALTER COLUMN mrn SET DEFAULT next_record_number('PC-', 'mrn_seq');
ALTER TABLE invoices ALTER COLUMN number SET DEFAULT next_record_number('INV-', 'invoice_seq');
ALTER TABLE patients DROP CONSTRAINT patients_dob_check;
ALTER TABLE patients ADD CONSTRAINT patient_dob_clinic_day CHECK(dob <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Jamaica')::date);

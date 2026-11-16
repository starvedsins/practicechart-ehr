ALTER TABLE patients ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE patients ADD COLUMN email_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN reviewed_by uuid REFERENCES users(id);
ALTER TABLE patients ADD COLUMN reviewed_at timestamptz;
ALTER TABLE patients ADD COLUMN review_reason text NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN visit_id uuid REFERENCES visits(id);
CREATE FUNCTION guard_document_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.visit_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM visits WHERE id=NEW.visit_id AND patient_id=NEW.patient_id) THEN
  RAISE EXCEPTION 'Document and visit must belong to the same patient' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_visit_guard BEFORE INSERT OR UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION guard_document_visit();
CREATE TABLE registration_intakes(
 id uuid PRIMARY KEY, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','accepted','rejected')),
 patient_id uuid REFERENCES patients(id), reviewed_by uuid REFERENCES users(id),
 review_reason text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE TABLE public_form_limits(bucket text PRIMARY KEY, attempts integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE notification_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL REFERENCES appointments(id),
 appointment_version integer NOT NULL, kind text NOT NULL CHECK(kind IN('confirmation','reminder')),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN('queued','sending','sent','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 provider_id text, last_error text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 UNIQUE(appointment_id,appointment_version,kind)
);
CREATE INDEX notification_due_idx ON notification_outbox(next_attempt_at) WHERE status IN('queued','failed','sending');
CREATE FUNCTION queue_appointment_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='confirmed' AND (TG_OP='INSERT' OR NEW.start_at IS DISTINCT FROM OLD.start_at OR NEW.end_at IS DISTINCT FROM OLD.end_at) THEN
  INSERT INTO notification_outbox(appointment_id,appointment_version,kind) VALUES(NEW.id,NEW.version,'confirmation') ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER appointment_email_queue AFTER INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION queue_appointment_email();

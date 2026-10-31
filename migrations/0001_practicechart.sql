CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SEQUENCE mrn_seq;
CREATE SEQUENCE invoice_seq;
CREATE TABLE users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE, name text NOT NULL, role text NOT NULL CHECK(role IN ('doctor','front_desk')), password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, protected boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions(id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE login_attempts(key text PRIMARY KEY, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE TABLE patients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), mrn text NOT NULL UNIQUE DEFAULT ('PC-' || lpad(nextval('mrn_seq')::text,6,'0')), first_name text NOT NULL,last_name text NOT NULL,dob date NOT NULL CHECK(dob <= CURRENT_DATE), phone text NOT NULL,address text NOT NULL,gender text NOT NULL DEFAULT 'Not stated',emergency_contact text NOT NULL DEFAULT '',insurance text NOT NULL DEFAULT '',provisional_reason text NOT NULL DEFAULT '',merged_into uuid REFERENCES patients(id),archived boolean NOT NULL DEFAULT false,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(), CHECK(merged_into IS NULL OR merged_into<>id));
CREATE INDEX patient_name_idx ON patients(lower(last_name),lower(first_name));
CREATE TABLE doctor_hours(doctor_id uuid NOT NULL REFERENCES users(id),weekday integer NOT NULL CHECK(weekday BETWEEN 1 AND 7),start_min integer NOT NULL CHECK(start_min>=0),end_min integer NOT NULL CHECK(end_min<=1440 AND end_min>start_min),PRIMARY KEY(doctor_id,weekday));
CREATE TABLE appointments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES patients(id),doctor_id uuid NOT NULL REFERENCES users(id), start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','arrived','in_consultation','completed','cancelled')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),CHECK(end_at>start_at),CHECK(end_at-start_at<=interval '4 hours'),EXCLUDE USING gist(doctor_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&) WHERE(status IN ('confirmed','arrived','in_consultation')),EXCLUDE USING gist(patient_id WITH =,tstzrange(start_at,end_at,'[)') WITH &&) WHERE(status IN ('confirmed','arrived','in_consultation')));
CREATE INDEX appointments_date_idx ON appointments(start_at);
CREATE TABLE schedule_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),doctor_id uuid NOT NULL REFERENCES users(id),start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,CHECK(end_at>start_at));
CREATE TABLE visits(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES patients(id),doctor_id uuid NOT NULL REFERENCES users(id),appointment_id uuid UNIQUE REFERENCES appointments(id),status text NOT NULL DEFAULT 'open' CHECK(status IN('open','ready','filed')),revision integer NOT NULL DEFAULT 0,visit_at timestamptz NOT NULL DEFAULT now(),filed_at timestamptz);
CREATE TABLE clinical_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visit_id uuid NOT NULL REFERENCES visits(id),revision integer NOT NULL,author_id uuid NOT NULL REFERENCES users(id),state text NOT NULL CHECK(state IN('draft','final')),content jsonb NOT NULL,reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(visit_id,revision));
CREATE TABLE prescriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),visit_id uuid NOT NULL REFERENCES visits(id),revision_id uuid NOT NULL REFERENCES clinical_revisions(id),patient_id uuid NOT NULL REFERENCES patients(id),content jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),patient_id uuid NOT NULL REFERENCES patients(id),title text NOT NULL,kind text NOT NULL CHECK(kind IN('Lab report','Diagnostic report')),pathname text NOT NULL UNIQUE,mime text NOT NULL CHECK(mime IN('application/pdf','image/png','image/jpeg')),size integer NOT NULL CHECK(size BETWEEN 1 AND 4194304),sha256 text NOT NULL,replaces_id uuid REFERENCES documents(id),author_id uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),number text NOT NULL UNIQUE DEFAULT ('INV-'||lpad(nextval('invoice_seq')::text,6,'0')),patient_id uuid NOT NULL REFERENCES patients(id),lines jsonb NOT NULL,total_cents integer NOT NULL CHECK(total_cents>=0),status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','issued','void')),version integer NOT NULL DEFAULT 1,reason text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE audit_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES users(id),action text NOT NULL,entity text NOT NULL,entity_id text NOT NULL DEFAULT '',metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX audit_date_idx ON audit_events(created_at DESC);
CREATE TABLE reminders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),appointment_id uuid NOT NULL REFERENCES appointments(id),due_date date NOT NULL,UNIQUE(appointment_id,due_date));
CREATE TABLE backup_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text NOT NULL,pathname text,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'This history is append only' USING ERRCODE='23514'; END$$;
CREATE TRIGGER revisions_immutable BEFORE UPDATE OR DELETE ON clinical_revisions FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE TRIGGER prescriptions_immutable BEFORE UPDATE OR DELETE ON prescriptions FOR EACH ROW EXECUTE FUNCTION immutable_record();
CREATE FUNCTION guard_doctor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(4001001);
 IF OLD.role='doctor' AND OLD.active AND (NOT NEW.active OR NEW.role<>'doctor') AND NOT EXISTS(SELECT 1 FROM users WHERE role='doctor' AND active AND id<>OLD.id) THEN RAISE EXCEPTION 'Keep at least one active doctor' USING ERRCODE='23514'; END IF;
 RETURN NEW; END$$;
CREATE TRIGGER doctor_guard BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION guard_doctor();
CREATE FUNCTION validate_booking() RETURNS trigger LANGUAGE plpgsql AS $$DECLARE local_start timestamp;local_end timestamp; BEGIN
 PERFORM 1 FROM users WHERE id=NEW.doctor_id AND role='doctor' AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Doctor is not available' USING ERRCODE='23514'; END IF;
 IF NEW.status IN('confirmed','arrived','in_consultation') THEN
 local_start:=NEW.start_at AT TIME ZONE 'America/Jamaica';local_end:=NEW.end_at AT TIME ZONE 'America/Jamaica';
 IF local_start::date<>local_end::date OR NOT EXISTS(SELECT 1 FROM doctor_hours WHERE doctor_id=NEW.doctor_id AND weekday=extract(isodow FROM local_start) AND extract(epoch FROM local_start::time)/60>=start_min AND extract(epoch FROM local_end::time)/60<=end_min) THEN RAISE EXCEPTION 'Outside doctor hours' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM schedule_blocks WHERE doctor_id=NEW.doctor_id AND tstzrange(start_at,end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')) THEN RAISE EXCEPTION 'Doctor time is blocked' USING ERRCODE='23514'; END IF;
 END IF;RETURN NEW;END$$;
CREATE TRIGGER booking_hours BEFORE INSERT OR UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION validate_booking();
CREATE FUNCTION validate_block() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 PERFORM 1 FROM users WHERE id=NEW.doctor_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM appointments WHERE doctor_id=NEW.doctor_id AND status IN('confirmed','arrived','in_consultation') AND tstzrange(start_at,end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')) THEN RAISE EXCEPTION 'This block conflicts with an appointment' USING ERRCODE='23514'; END IF;RETURN NEW;END$$;
CREATE TRIGGER block_guard BEFORE INSERT OR UPDATE ON schedule_blocks FOR EACH ROW EXECUTE FUNCTION validate_block();

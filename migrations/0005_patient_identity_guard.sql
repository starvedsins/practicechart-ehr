CREATE FUNCTION patient_identity_key(given_name text,family_name text,birth_date date,contact_phone text,home_address text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(
   regexp_replace(lower(btrim(given_name)),'\s+',' ','g'),
   regexp_replace(lower(btrim(family_name)),'\s+',' ','g'),
   birth_date - DATE '1900-01-01',
   regexp_replace(contact_phone,'[^0-9]','','g'),
   regexp_replace(lower(btrim(home_address)),'\s+',' ','g')
 )::text,'UTF8')),'hex')
$$;
ALTER TABLE patients ADD COLUMN identity_key text;
ALTER TABLE patients ADD COLUMN duplicate_review boolean NOT NULL DEFAULT false;
-- Keep all historical rows and clinical links. One normal record owns each key.
WITH ranked AS (
 SELECT id,patient_identity_key(first_name,last_name,dob,phone,address) AS key,
 row_number() OVER(PARTITION BY patient_identity_key(first_name,last_name,dob,phone,address) ORDER BY created_at,id) AS position
 FROM patients WHERE btrim(provisional_reason)='' AND merged_into IS NULL
)
UPDATE patients p SET identity_key=CASE WHEN r.position=1 THEN r.key ELSE NULL END,duplicate_review=(r.position>1) FROM ranked r WHERE p.id=r.id;
CREATE UNIQUE INDEX patients_identity_unique ON patients(identity_key);
CREATE FUNCTION guard_patient_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE new_key text;
BEGIN
 IF btrim(NEW.provisional_reason)<>'' OR NEW.merged_into IS NOT NULL THEN
  NEW.identity_key:=NULL;
  NEW.duplicate_review:=false;
  RETURN NEW;
 END IF;
 new_key:=patient_identity_key(NEW.first_name,NEW.last_name,NEW.dob,NEW.phone,NEW.address);
 IF TG_OP='UPDATE' AND OLD.duplicate_review AND OLD.identity_key IS NULL AND
    new_key=patient_identity_key(OLD.first_name,OLD.last_name,OLD.dob,OLD.phone,OLD.address) THEN
  -- Allow unrelated changes to a historical duplicate pending staff review.
  NEW.identity_key:=NULL;
  NEW.duplicate_review:=true;
 ELSE
  NEW.identity_key:=new_key;
  NEW.duplicate_review:=false;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER patient_identity_guard BEFORE INSERT OR UPDATE OF first_name,last_name,dob,phone,address,provisional_reason,merged_into,identity_key,duplicate_review ON patients FOR EACH ROW EXECUTE FUNCTION guard_patient_identity();
INSERT INTO audit_events(action,entity,metadata) SELECT 'mark_existing_duplicates','patient',jsonb_build_object('count',count(*)) FROM patients WHERE duplicate_review;

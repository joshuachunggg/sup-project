

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."collateral_status" AS ENUM (
    'none',
    'hold_pending',
    'hold_active',
    'hold_failed',
    'captured',
    'released',
    'refunded'
);


ALTER TYPE "public"."collateral_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_spots"("table_id_in" integer) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update public.tables
  set spots_filled = spots_filled - 1
  where id = table_id_in and spots_filled > 0;
$$;


ALTER FUNCTION "public"."decrement_spots"("table_id_in" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_distinct_upcoming_dates"() RETURNS SETOF "date"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select distinct dinner_date::date
  from public.tables
  where dinner_date >= now()
  order by dinner_date::date
  limit 8;
end;
$$;


ALTER FUNCTION "public"."get_distinct_upcoming_dates"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "day" "text" NOT NULL,
    "time" "text" NOT NULL,
    "neighborhood" "text" NOT NULL,
    "age_range" "text" NOT NULL,
    "city" "text" DEFAULT 'NYC'::text NOT NULL,
    "total_spots" integer NOT NULL,
    "spots_filled" integer NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "dinner_date" timestamp with time zone NOT NULL,
    "is_cancelled" boolean DEFAULT false,
    "theme" "text",
    "min_spots" integer
);


ALTER TABLE "public"."tables" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tables_for_day"("day_string" "text") RETURNS SETOF "public"."tables"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select *
  from public.tables
  where dinner_date >= day_string::date
    and dinner_date < (day_string::date + interval '1 day');
end;
$$;


ALTER FUNCTION "public"."get_tables_for_day"("day_string" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_spots"("table_id_in" integer) RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update public.tables
  set spots_filled = spots_filled + 1
  where id = table_id_in;
$$;


ALTER FUNCTION "public"."increment_spots"("table_id_in" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collateral_holds" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "table_id" bigint NOT NULL,
    "booking_id" bigint,
    "collateral_cents" integer NOT NULL,
    "strategy" "text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_setup_intent_id" "text",
    "status" "public"."collateral_status" DEFAULT 'none'::"public"."collateral_status" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "collateral_holds_collateral_cents_check" CHECK (("collateral_cents" > 0)),
    CONSTRAINT "collateral_holds_strategy_check" CHECK (("strategy" = ANY (ARRAY['manual_hold'::"text", 'setup_then_hold'::"text"])))
);


ALTER TABLE "public"."collateral_holds" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."collateral_holds_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."collateral_holds_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."collateral_holds_id_seq" OWNED BY "public"."collateral_holds"."id";



CREATE TABLE IF NOT EXISTS "public"."signups" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" bigint NOT NULL
);


ALTER TABLE "public"."signups" OWNER TO "postgres";


ALTER TABLE "public"."signups" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."signups_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."tables" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."tables_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" NOT NULL,
    "phone_number" "text" NOT NULL,
    "age_range" "text" DEFAULT '23-27'::"text" NOT NULL,
    "is_suspended" boolean DEFAULT false,
    "suspension_end_date" timestamp with time zone,
    "referral_source" "text",
    "marketing_opt_in" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "auth_user_id" "uuid",
    "email" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlists" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "table_id" bigint NOT NULL
);


ALTER TABLE "public"."waitlists" OWNER TO "postgres";


ALTER TABLE "public"."waitlists" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."waitlists_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."collateral_holds" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."collateral_holds_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."collateral_holds"
    ADD CONSTRAINT "collateral_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signups"
    ADD CONSTRAINT "signups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signups"
    ADD CONSTRAINT "signups_user_table_unique" UNIQUE ("user_id", "table_id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlists"
    ADD CONSTRAINT "unique_user_table" UNIQUE ("user_id", "table_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_number_key" UNIQUE ("phone_number");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlists"
    ADD CONSTRAINT "waitlists_pkey" PRIMARY KEY ("id");



CREATE INDEX "collateral_holds_table_idx" ON "public"."collateral_holds" USING "btree" ("table_id");



CREATE INDEX "collateral_holds_user_idx" ON "public"."collateral_holds" USING "btree" ("user_id");



CREATE INDEX "users_auth_user_id_idx" ON "public"."users" USING "btree" ("auth_user_id");



CREATE INDEX "users_email_idx" ON "public"."users" USING "btree" ("email");



CREATE INDEX "users_stripe_customer_id_idx" ON "public"."users" USING "btree" ("stripe_customer_id");



CREATE OR REPLACE TRIGGER "On New Signup Notification" AFTER INSERT OR UPDATE ON "public"."signups" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://ennlvlcogzowropkwbiu.supabase.co/functions/v1/send-signup-notification', 'POST', '{}', '{}', '5000');



CREATE OR REPLACE TRIGGER "new_sign_up_noti" AFTER INSERT OR UPDATE ON "public"."signups" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://ennlvlcogzowropkwbiu.supabase.co/functions/v1/send-signup-notification', 'POST', '{"Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVubmx2bGNvZ3pvd3JvcGt3Yml1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMjIxMCwiZXhwIjoyMDY5NDg4MjEwfQ.HHkBfWcY7eFOHEMEO7nVTxp112srTdl9tcqeN6lH30E"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "trg_touch_collateral_holds" BEFORE UPDATE ON "public"."collateral_holds" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."collateral_holds"
    ADD CONSTRAINT "collateral_holds_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collateral_holds"
    ADD CONSTRAINT "collateral_holds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."signups"
    ADD CONSTRAINT "signups_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."signups"
    ADD CONSTRAINT "signups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."waitlists"
    ADD CONSTRAINT "waitlists_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



CREATE POLICY "Allow public read access to tables" ON "public"."tables" FOR SELECT USING (true);



ALTER TABLE "public"."collateral_holds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no client writes" ON "public"."collateral_holds" TO "authenticated" USING (false) WITH CHECK (false);



CREATE POLICY "read own holds" ON "public"."collateral_holds" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_select_self" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "users_update_self" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth_user_id" = "auth"."uid"()));



CREATE POLICY "users_upsert_self" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth_user_id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."decrement_spots"("table_id_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_spots"("table_id_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_spots"("table_id_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_distinct_upcoming_dates"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_distinct_upcoming_dates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_distinct_upcoming_dates"() TO "service_role";



GRANT ALL ON TABLE "public"."tables" TO "anon";
GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tables_for_day"("day_string" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tables_for_day"("day_string" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tables_for_day"("day_string" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_spots"("table_id_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_spots"("table_id_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_spots"("table_id_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";
























GRANT ALL ON TABLE "public"."collateral_holds" TO "anon";
GRANT ALL ON TABLE "public"."collateral_holds" TO "authenticated";
GRANT ALL ON TABLE "public"."collateral_holds" TO "service_role";



GRANT ALL ON SEQUENCE "public"."collateral_holds_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."collateral_holds_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."collateral_holds_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."signups" TO "anon";
GRANT ALL ON TABLE "public"."signups" TO "authenticated";
GRANT ALL ON TABLE "public"."signups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."signups_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."signups_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."signups_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."tables_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."waitlists" TO "anon";
GRANT ALL ON TABLE "public"."waitlists" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlists" TO "service_role";



GRANT ALL ON SEQUENCE "public"."waitlists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."waitlists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."waitlists_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;

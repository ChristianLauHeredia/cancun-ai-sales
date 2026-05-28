-- Demo seed data for Cancun AI Sales Platform

-- Sample leads at different pipeline stages
insert into leads (first_name, last_name, email, phone, country, state, city, status, score, dental_needs, preferred_timeline, estimated_budget, source, utm_source, utm_medium, utm_campaign) values
  ('Sarah', 'Johnson', 'sarah.j@email.com', '+14155551234', 'US', 'CA', 'San Francisco', 'qualified_hot', 85, array['dental_implants', 'crown'], '1-3 months', '$5,000-$10,000', 'landing_page', 'google', 'cpc', 'dental_implants_ca'),
  ('Michael', 'Williams', 'mike.w@email.com', '+12125559876', 'US', 'NY', 'New York', 'qualified_warm', 65, array['veneers'], '3-6 months', '$3,000-$5,000', 'landing_page', 'facebook', 'paid', 'veneers_nyc'),
  ('Emily', 'Davis', 'emily.d@email.com', '+16045551111', 'CA', 'BC', 'Vancouver', 'call_scheduled', 40, array['root_canal', 'cleaning'], '1-3 months', '$1,000-$3,000', 'landing_page', 'google', 'organic', null),
  ('James', 'Brown', 'james.b@email.com', '+13125552222', 'US', 'IL', 'Chicago', 'no_answer', 30, array['dental_implants'], 'not_sure', '$5,000-$10,000', 'csv_import', null, null, null),
  ('Jennifer', 'Martinez', 'jen.m@email.com', '+17135553333', 'US', 'TX', 'Houston', 'new', 10, array['cosmetic'], '6+ months', '$3,000-$5,000', 'landing_page', 'instagram', 'paid', 'smile_makeover'),
  ('Robert', 'Anderson', 'rob.a@email.com', '+14165554444', 'CA', 'ON', 'Toronto', 'follow_up', 55, array['dental_implants', 'bone_graft'], '1-3 months', '$10,000+', 'referral', null, null, null),
  ('Lisa', 'Thompson', 'lisa.t@email.com', '+16175555555', 'US', 'MA', 'Boston', 'converted', 95, array['full_mouth_restoration'], 'ASAP', '$15,000+', 'landing_page', 'google', 'cpc', 'full_restoration'),
  ('David', 'Garcia', 'david.g@email.com', '+12135556666', 'US', 'CA', 'Los Angeles', 'qualified_cold', 25, array['cleaning', 'whitening'], '6+ months', 'under $1,000', 'landing_page', 'tiktok', 'paid', 'dental_tourism');

-- Consent logs for all leads
insert into consent_logs (lead_id, consent_type, ip_address, consent_text, trusted_form_cert_url)
select id, 'tcpa_call', '198.51.100.1'::inet,
  'I consent to receive calls, including automated calls, from Cancun Dental Partners at the phone number provided.',
  'https://cert.trustedform.com/demo-' || id::text
from leads;

insert into consent_logs (lead_id, consent_type, ip_address, consent_text)
select id, 'tcpa_sms', '198.51.100.1'::inet,
  'I consent to receive SMS messages from Cancun Dental Partners. Reply STOP to opt out.'
from leads;

-- Sample calls
insert into calls (lead_id, retell_call_id, agent_id, status, outcome, duration_seconds, summary, sentiment, started_at, ended_at)
select id, 'retell_call_' || id::text, 'agent_dental_qualifier_v1', 'completed', 'answered_qualified', 187,
  'Patient interested in dental implants. Has insurance that covers 50%. Wants to schedule consultation within 2 weeks. Positive about traveling to Cancun.',
  'positive',
  now() - interval '2 days', now() - interval '2 days' + interval '187 seconds'
from leads where status = 'qualified_hot' limit 1;

insert into calls (lead_id, retell_call_id, agent_id, status, outcome, duration_seconds, summary, sentiment, started_at, ended_at)
select id, 'retell_call_warm_' || id::text, 'agent_dental_qualifier_v1', 'completed', 'answered_callback_requested', 95,
  'Patient considering veneers but wants to compare local prices first. Asked to call back next week.',
  'neutral',
  now() - interval '1 day', now() - interval '1 day' + interval '95 seconds'
from leads where status = 'qualified_warm' limit 1;

insert into calls (lead_id, retell_call_id, agent_id, status, outcome, duration_seconds, started_at, ended_at)
select id, 'retell_call_na_' || id::text, 'agent_dental_qualifier_v1', 'completed', 'no_answer', 30,
  now() - interval '3 hours', now() - interval '3 hours' + interval '30 seconds'
from leads where status = 'no_answer' limit 1;

-- Sample messages
insert into messages (lead_id, channel, direction, to_number, body, status, sent_at, delivered_at)
select id, 'sms', 'outbound', phone,
  'Hi Sarah! This is Cancun Dental Partners. We tried reaching you about your dental implant inquiry. Save 60-70% vs US prices with our certified clinics. Reply YES to schedule a free consultation!',
  'delivered', now() - interval '1 day', now() - interval '1 day' + interval '3 seconds'
from leads where first_name = 'Sarah' limit 1;

insert into messages (lead_id, channel, direction, from_number, body, status, sent_at)
select id, 'sms', 'inbound', phone,
  'YES please! When can we talk?',
  'read', now() - interval '23 hours'
from leads where first_name = 'Sarah' limit 1;

-- Sample follow-up sequence
insert into follow_up_sequences (name, channel, steps) values
  ('No Answer - SMS Drip', 'sms', '[
    {"step": 1, "delay_hours": 1, "template": "Hi {{first_name}}, we tried calling about your dental inquiry. Save 60-70% on procedures in Cancun! Reply YES for info."},
    {"step": 2, "delay_hours": 24, "template": "{{first_name}}, patients like you save $5,000+ on dental implants in Cancun. Want to learn how? Reply YES."},
    {"step": 3, "delay_hours": 72, "template": "Last chance {{first_name}}! Free consultation with top Cancun dental clinics. Limited spots this month. Reply YES or STOP to opt out."}
  ]'::jsonb),
  ('Warm Lead - Email Nurture', 'email', '[
    {"step": 1, "delay_hours": 2, "template": "dental_tourism_guide"},
    {"step": 2, "delay_hours": 48, "template": "patient_testimonials"},
    {"step": 3, "delay_hours": 120, "template": "special_offer"}
  ]'::jsonb);

-- Sample agent decisions
insert into agent_decisions (lead_id, agent_type, decision, reasoning, confidence, model_used, tokens_used, latency_ms)
select id, 'orchestrator', 'initiate_voice_call',
  'New lead with high-value dental needs (implants). TCPA consent verified. Best first contact method is voice for immediate qualification.',
  0.92, 'claude-sonnet-4-6', 450, 1200
from leads where status = 'qualified_hot' limit 1;

insert into agent_decisions (lead_id, agent_type, decision, reasoning, confidence, model_used, tokens_used, latency_ms)
select id, 'orchestrator', 'send_sms_followup',
  'Lead did not answer voice call. Consent for SMS verified. Initiating SMS drip sequence before retry call.',
  0.88, 'claude-sonnet-4-6', 380, 980
from leads where status = 'no_answer' limit 1;

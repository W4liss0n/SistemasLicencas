-- Atualizar os tipos de evento permitidos na tabela security_events
ALTER TABLE security_events
DROP CONSTRAINT IF EXISTS security_events_event_type_check;

ALTER TABLE security_events
ADD CONSTRAINT security_events_event_type_check
CHECK (event_type IN (
    'time_manipulation',
    'file_tampering',
    'suspicious_process',
    'multiple_instances',
    'impossible_velocity',
    'excessive_fingerprints',
    'brute_force',
    'blacklisted_ip',
    'license_blocked',
    'license_unblocked',
    'simultaneous_use'
));

-- Atualizar os tipos de ação automatizada
ALTER TABLE security_events
DROP CONSTRAINT IF EXISTS security_events_automated_action_check;

ALTER TABLE security_events
ADD CONSTRAINT security_events_automated_action_check
CHECK (automated_action IN (
    'none',
    'warning',
    'temporary_block',
    'permanent_block',
    'manual_block',
    'manual_unblock'
));
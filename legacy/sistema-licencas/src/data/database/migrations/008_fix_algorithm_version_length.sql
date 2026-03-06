-- Fix algorithm_version column length in device_fingerprints table
-- The default value 'weighted_v1' (11 chars) doesn't fit in varchar(10)

ALTER TABLE device_fingerprints
ALTER COLUMN algorithm_version TYPE VARCHAR(20);
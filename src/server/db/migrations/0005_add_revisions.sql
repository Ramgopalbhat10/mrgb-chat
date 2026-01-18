ALTER TABLE conversations ADD COLUMN revision integer NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN revision integer NOT NULL DEFAULT 0;

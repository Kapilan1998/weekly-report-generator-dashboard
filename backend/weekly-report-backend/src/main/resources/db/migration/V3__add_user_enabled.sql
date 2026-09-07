-- Lets a manager retire a team member without deleting them.
--
-- A hard delete is impossible for anyone who has filed a report: reports.user_id is a
-- NOT NULL foreign key with no cascade, and a submitted report's authorship is part of the
-- audit trail. So "remove" means disabling the account - it can no longer sign in, and its
-- existing tokens stop working, while its report history stays intact.
--
-- DEFAULT b'1' so every existing account stays enabled when this runs.
ALTER TABLE users ADD COLUMN enabled BIT(1) NOT NULL DEFAULT b'1';

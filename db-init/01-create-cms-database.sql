-- Runs once, when the Postgres volume is first created: the CMS gets its own
-- database next to the app's. (On an existing volume, create it by hand:
--   docker compose exec db createdb -U harnesslink harnesslink_cms )
CREATE DATABASE harnesslink_cms OWNER harnesslink;

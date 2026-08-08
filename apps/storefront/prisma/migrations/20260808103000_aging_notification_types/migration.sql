-- Notification types for the operations sweep: orders sitting unfulfilled past the promise
-- window, and return requests nobody has actioned.
--
-- These land as their own types rather than SYSTEM so the notification centre can filter and
-- prioritise them the way it already does for low stock and failed payments.
--
-- IF NOT EXISTS keeps this re-runnable; ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block on PostgreSQL versions before 12, so it is applied as its own statement.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RETURN_AGING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_UNFULFILLED_STALE';

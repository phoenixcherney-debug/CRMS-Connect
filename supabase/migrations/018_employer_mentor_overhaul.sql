-- Migration 018: Add employer_mentor to role enum
-- IMPORTANT: Run this first, then run 019_employer_mentor_schema.sql

ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'employer_mentor';

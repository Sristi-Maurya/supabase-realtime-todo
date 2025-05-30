# Supabase Realtime Todo List

A real-time collaborative todo app built with Next.js and Supabase.

---

## Features

- Assign tasks to other registered users
- Add due dates to tasks
- Filter tasks (assigned to me, created by me, overdue, due today)
- Real-time notifications when someone assigns you a task

---

## Getting Started

### 1. Clone the Repository


### 2. Install Dependencies


### 3. Set Up Supabase

- Go to [https://supabase.com](https://supabase.com) and create a new project.
- In the Supabase dashboard:
  - Run the "Todo List" quickstart in the SQL editor.
  - Add these columns to the `todos` table:  
    - `assigned_to` (uuid)  
    - `due_date` (date)  
    - `created_by` (uuid)
  - Create a `profiles` table and set up the trigger to add new profiles automatically (see below).
  - Enable Realtime on the `todos` table.

#### SQL for `profiles` Table and Trigger

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

### 4. Configure Environment Variables
  Copy .env.example to .env.local

  Fill in your Supabase URL and anon key (from Supabase dashboard > Settings > API)

  Do NOT commit .env.local to GitHub!

5. Run the App
  npm run dev
  Open http://localhost:3000 in your browser.

6.Usage

  Sign up or log in.
  Add todos, assign them to users, and set due dates.
  Use the filter buttons to view tasks assigned to you, created by you, overdue, or due today.

  You’ll get a real-time notification when a task is assigned to you.

7. Environment Variables
  The app needs your Supabase project URL and anon key.
  These should be provided in your .env.local file.

8.Notes
  All database changes are managed through the Supabase dashboard.
  For any issues, check the browser console or ask for help!

Thank you for reviewing!
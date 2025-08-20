-- Initial schema for WildTrails Petanque Tournament Management System
-- Based on existing TypeScript types and JSON data structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE tournament_format AS ENUM ('single_elimination', 'double_elimination', 'round_robin', 'swiss', 'barrage');
CREATE TYPE tournament_status AS ENUM ('draft', 'registration', 'in_progress', 'completed', 'cancelled');
CREATE TYPE team_type AS ENUM ('singles', 'doubles', 'triples');
CREATE TYPE team_status AS ENUM ('registered', 'checked_in', 'active', 'eliminated');
CREATE TYPE match_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE court_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE player_role AS ENUM ('player', 'captain', 'substitute');

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  format tournament_format NOT NULL,
  status tournament_status NOT NULL DEFAULT 'draft',
  max_players INTEGER NOT NULL CHECK (max_players > 0),
  current_players INTEGER NOT NULL DEFAULT 0 CHECK (current_players >= 0),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  registration_deadline TIMESTAMP WITH TIME ZONE,
  location VARCHAR(255),
  settings JSONB DEFAULT '{}',
  bracket_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT valid_registration CHECK (registration_deadline IS NULL OR start_date IS NULL OR registration_deadline <= start_date),
  CONSTRAINT valid_player_count CHECK (current_players <= max_players)
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  club VARCHAR(255),
  rating INTEGER CHECK (rating >= 0),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type team_type NOT NULL,
  status team_status NOT NULL DEFAULT 'registered',
  seed INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique team names per tournament
  UNIQUE(tournament_id, name)
);

-- Team members junction table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role player_role NOT NULL DEFAULT 'player',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique player per team
  UNIQUE(team_id, player_id)
);

-- Courts table
CREATE TABLE courts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  status court_status NOT NULL DEFAULT 'available',
  location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique court names per tournament
  UNIQUE(tournament_id, name)
);

-- Matches table
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL CHECK (round > 0),
  match_number INTEGER NOT NULL CHECK (match_number > 0),
  team1_id UUID REFERENCES teams(id),
  team2_id UUID REFERENCES teams(id),
  winner_id UUID REFERENCES teams(id),
  court_id UUID REFERENCES courts(id),
  status match_status NOT NULL DEFAULT 'pending',
  score JSONB DEFAULT '{}',
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT different_teams CHECK (team1_id != team2_id),
  CONSTRAINT winner_is_participant CHECK (winner_id IS NULL OR winner_id IN (team1_id, team2_id)),
  CONSTRAINT valid_match_times CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time),
  CONSTRAINT unique_match_per_round UNIQUE(tournament_id, round, match_number)
);

-- Match games table (for detailed end-by-end scoring)
CREATE TABLE match_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  game_number INTEGER NOT NULL CHECK (game_number > 0),
  team1_score INTEGER NOT NULL DEFAULT 0 CHECK (team1_score >= 0),
  team2_score INTEGER NOT NULL DEFAULT 0 CHECK (team2_score >= 0),
  winner_id UUID REFERENCES teams(id),
  ends JSONB DEFAULT '[]', -- Array of end-by-end scores
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_game_per_match UNIQUE(match_id, game_number),
  CONSTRAINT winner_validation CHECK (
    (winner_id IS NULL AND team1_score < 13 AND team2_score < 13) OR
    (winner_id IS NOT NULL AND (team1_score = 13 OR team2_score = 13))
  )
);

-- Indexes for performance
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_format ON tournaments(format);
CREATE INDEX idx_tournaments_start_date ON tournaments(start_date);

CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_players_name ON players(name);
CREATE INDEX idx_players_club ON players(club);

CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_teams_type ON teams(type);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_player ON team_members(player_id);

CREATE INDEX idx_courts_tournament ON courts(tournament_id);
CREATE INDEX idx_courts_status ON courts(status);

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_round ON matches(round);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_court ON matches(court_id);
CREATE INDEX idx_matches_teams ON matches(team1_id, team2_id);

CREATE INDEX idx_match_games_match ON match_games(match_id);
CREATE INDEX idx_match_games_game_number ON match_games(game_number);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables with updated_at
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courts_updated_at BEFORE UPDATE ON courts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update tournament player count
CREATE OR REPLACE FUNCTION update_tournament_player_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE tournaments 
        SET current_players = (
            SELECT COUNT(DISTINCT tm.player_id)
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE t.tournament_id = NEW.tournament_id
        )
        WHERE id = NEW.tournament_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE tournaments 
        SET current_players = (
            SELECT COUNT(DISTINCT tm.player_id)
            FROM teams t
            JOIN team_members tm ON t.id = tm.team_id
            WHERE t.tournament_id = (SELECT tournament_id FROM teams WHERE id = OLD.team_id)
        )
        WHERE id = (SELECT tournament_id FROM teams WHERE id = OLD.team_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tournament_player_count_trigger
AFTER INSERT OR DELETE ON team_members
FOR EACH ROW EXECUTE FUNCTION update_tournament_player_count();

-- Enable Row Level Security (RLS) - we'll set up policies later
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_games ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (we'll restrict this later with proper auth)
CREATE POLICY "Allow all operations" ON tournaments FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON players FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON team_members FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON courts FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON matches FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON match_games FOR ALL USING (true);
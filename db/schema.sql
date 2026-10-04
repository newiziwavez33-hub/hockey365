-- ============================================================================
-- Hockey365 — Production PostgreSQL Database Schema (Phase 1)
-- Compatible with Supabase, Neon, and standard PostgreSQL 15+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. LEAGUES & SEASONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leagues (
    id VARCHAR(16) PRIMARY KEY, -- 'NHL', 'KHL', 'VHL', 'MHL'
    name VARCHAR(64) NOT NULL,
    name_en VARCHAR(64) NOT NULL,
    country VARCHAR(8) NOT NULL, -- 'USA/CAN', 'RUS', etc.
    logo_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seasons (
    id VARCHAR(32) PRIMARY KEY, -- 'NHL-2026-27', 'KHL-2026-27'
    league_id VARCHAR(16) NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    year_start INT NOT NULL,
    year_end INT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. TEAMS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'nhl:det', 'khl:spartak'
    league_id VARCHAR(16) NOT NULL REFERENCES leagues(id),
    name VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    short_name VARCHAR(16) NOT NULL,
    city VARCHAR(64),
    arena_name VARCHAR(128),
    arena_capacity INT,
    conference VARCHAR(32),
    division VARCHAR(32),
    logo_url TEXT,
    primary_color VARCHAR(16),
    secondary_color VARCHAR(16),
    colors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. PLAYERS & STATS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'nhl:p_8478402', 'khl:p_goldobin'
    current_team_id VARCHAR(64) REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    position VARCHAR(8) NOT NULL, -- 'C', 'LW', 'RW', 'D', 'G'
    number INT,
    birth_date DATE,
    nationality VARCHAR(8),
    shoots VARCHAR(4), -- 'L', 'R'
    height_cm INT,
    weight_kg INT,
    photo_url TEXT,
    career_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_season_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id VARCHAR(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id VARCHAR(32) NOT NULL REFERENCES seasons(id),
    league_id VARCHAR(16) NOT NULL REFERENCES leagues(id),
    gp INT DEFAULT 0,
    g INT DEFAULT 0,
    a INT DEFAULT 0,
    pts INT DEFAULT 0,
    plus_minus INT DEFAULT 0,
    pim INT DEFAULT 0,
    shots INT DEFAULT 0,
    toi VARCHAR(16),
    gk_stats JSONB DEFAULT NULL, -- { w, l, otl, gaa, svPct, so } for goalies
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(player_id, season_id, league_id)
);

-- ----------------------------------------------------------------------------
-- 4. MATCHES & EVENTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'nhl:2026020035'
    league_id VARCHAR(16) NOT NULL REFERENCES leagues(id),
    season_id VARCHAR(32) NOT NULL REFERENCES seasons(id),
    utc_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(24) NOT NULL, -- 'SCHEDULED', 'LIVE', 'INTERMISSION', 'FINISHED', 'POSTPONED', 'CANCELLED'
    stage VARCHAR(32) DEFAULT 'regular', -- 'preseason', 'regular', 'playoff'
    round INT DEFAULT NULL,
    period INT DEFAULT NULL,
    clock VARCHAR(16) DEFAULT NULL, -- '18:42' or '20:00'
    finished_in VARCHAR(8) DEFAULT NULL, -- 'REG', 'OT', 'SO'
    home_team_id VARCHAR(64) NOT NULL REFERENCES teams(id),
    away_team_id VARCHAR(64) NOT NULL REFERENCES teams(id),
    home_score INT DEFAULT NULL,
    away_score INT DEFAULT NULL,
    home_shots INT DEFAULT NULL,
    away_shots INT DEFAULT NULL,
    home_periods JSONB DEFAULT '[]'::jsonb,
    away_periods JSONB DEFAULT '[]'::jsonb,
    arena_name VARCHAR(128) DEFAULT NULL,
    officials JSONB DEFAULT '{}'::jsonb, -- { referees: [...], linesmen: [...] }
    team_stats JSONB DEFAULT '{}'::jsonb, -- faceoffPct, powerPlay, pims, hits, blocks
    source JSONB NOT NULL, -- { provider: 'NHL Web API', official: true, fetchedAt: ... }
    verified_external_url TEXT DEFAULT NULL, -- e.g. official GameCenter link on nhl.com / khl.ru
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_events (
    id BIGSERIAL PRIMARY KEY,
    match_id VARCHAR(64) NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    period INT NOT NULL,
    time_in_period VARCHAR(16) NOT NULL,
    event_type VARCHAR(32) NOT NULL, -- 'GOAL', 'PENALTY', 'SHOOTOUT', 'GOALIE_CHANGE', 'TIMEOUT'
    team_side VARCHAR(8) NOT NULL, -- 'home', 'away'
    player_id VARCHAR(64) REFERENCES players(id) ON DELETE SET NULL,
    player_name VARCHAR(128),
    score_after VARCHAR(16) DEFAULT NULL, -- '1:0'
    strength VARCHAR(8) DEFAULT 'EV', -- 'EV', 'PP', 'SH', 'EN'
    details JSONB DEFAULT '{}'::jsonb, -- assists, penalty duration, reason, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. LIVE CHAT & MODERATION (Telegram & Google Auth)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_provider VARCHAR(32) NOT NULL, -- 'telegram', 'google'
    auth_id VARCHAR(128) NOT NULL,
    username VARCHAR(64) NOT NULL,
    display_name VARCHAR(64),
    avatar_url TEXT,
    favorite_team_id VARCHAR(64) REFERENCES teams(id) ON DELETE SET NULL,
    role VARCHAR(16) DEFAULT 'fan', -- 'fan', 'moderator', 'admin'
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(auth_provider, auth_id)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
    id VARCHAR(128) PRIMARY KEY, -- 'match:nhl:2026020035', 'league:NHL'
    room_type VARCHAR(16) NOT NULL, -- 'match', 'league', 'team'
    target_id VARCHAR(64) NOT NULL,
    title VARCHAR(128) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(128) NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    user_name VARCHAR(64) NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    is_flagged BOOLEAN DEFAULT FALSE,
    is_moderated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_reports (
    id BIGSERIAL PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES user_profiles(id),
    reason VARCHAR(64) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. USER FAVORITES & NOTIFICATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    entity_type VARCHAR(16) NOT NULL, -- 'team', 'player', 'match'
    entity_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, entity_type, entity_id)
);

-- ----------------------------------------------------------------------------
-- 7. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_matches_utc_date ON matches(utc_date);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_date_league ON matches(utc_date, league_id);
CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id, period);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(current_team_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON chat_messages(room_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. SUPABASE ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_season_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Public read for all sports catalog data
CREATE POLICY "Public Read Leagues" ON leagues FOR SELECT USING (true);
CREATE POLICY "Public Read Seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public Read Teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public Read Players" ON players FOR SELECT USING (true);
CREATE POLICY "Public Read Stats" ON player_season_stats FOR SELECT USING (true);
CREATE POLICY "Public Read Matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public Read Events" ON match_events FOR SELECT USING (true);
CREATE POLICY "Public Read Chat Rooms" ON chat_rooms FOR SELECT USING (true);

-- Chat messages: Anyone can read unflagged, authenticated users can insert
CREATE POLICY "Public Read Approved Chat" ON chat_messages FOR SELECT USING (is_flagged = FALSE);
CREATE POLICY "Authenticated Insert Chat" ON chat_messages FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_banned = FALSE)
);

-- User Profiles: Users can read profiles, and modify only their own
CREATE POLICY "Public Read Profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "User Modify Own Profile" ON user_profiles FOR ALL USING (auth.uid() = id);

-- Favorites: Private per user
CREATE POLICY "User Manage Favorites" ON user_favorites FOR ALL USING (auth.uid() = user_id);

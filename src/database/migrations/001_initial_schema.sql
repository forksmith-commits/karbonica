-- Migration: 001_initial_schema
-- Description: Create initial database schema for Karbonica Carbon Registry Platform
-- Date: 2024-01-15

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('developer', 'verifier', 'administrator', 'buyer')),
  email_verified BOOLEAN DEFAULT FALSE,
  account_locked BOOLEAN DEFAULT FALSE,
  failed_login_attempts INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_access_token_hash ON sessions(access_token_hash);

-- ============================================================================
-- CARDANO WALLETS TABLE
-- ============================================================================
CREATE TABLE cardano_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address VARCHAR(255) UNIQUE NOT NULL,
  stake_address VARCHAR(255),
  public_key TEXT NOT NULL,
  linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cardano_wallets_user_id ON cardano_wallets(user_id);
CREATE INDEX idx_cardano_wallets_address ON cardano_wallets(address);

-- ============================================================================
-- PROJECTS TABLE
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('forest_conservation', 'renewable_energy', 'energy_efficiency', 'methane_capture', 'soil_carbon', 'ocean_conservation', 'direct_air_capture')),
  description TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  country VARCHAR(3) NOT NULL,
  coordinates GEOGRAPHY(POINT),
  emissions_target DECIMAL(15,2) NOT NULL CHECK (emissions_target > 0 AND emissions_target < 10000000),
  start_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_developer_id ON projects(developer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_country ON projects(country);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- ============================================================================
-- PROJECT DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX idx_project_documents_uploaded_by ON project_documents(uploaded_by);

-- ============================================================================
-- VERIFICATION REQUESTS TABLE
-- ============================================================================
CREATE TABLE verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  developer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verifier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_requests_project_id ON verification_requests(project_id);
CREATE INDEX idx_verification_requests_developer_id ON verification_requests(developer_id);
CREATE INDEX idx_verification_requests_verifier_id ON verification_requests(verifier_id);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);

-- ============================================================================
-- VERIFICATION DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_id UUID NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  document_type VARCHAR(100) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_documents_verification_id ON verification_documents(verification_id);
CREATE INDEX idx_verification_documents_uploaded_by ON verification_documents(uploaded_by);
CREATE INDEX idx_verification_documents_document_type ON verification_documents(document_type);

-- ============================================================================
-- VERIFICATION EVENTS TABLE
-- ============================================================================
CREATE TABLE verification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_id UUID NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_events_verification_id ON verification_events(verification_id);
CREATE INDEX idx_verification_events_event_type ON verification_events(event_type);
CREATE INDEX idx_verification_events_created_at ON verification_events(created_at);

-- ============================================================================
-- CREDIT ENTRIES TABLE
-- ============================================================================
CREATE TABLE credit_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_id VARCHAR(50) UNIQUE NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
  vintage INTEGER NOT NULL CHECK (vintage >= 2000 AND vintage <= 2100),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'retired')),
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_entries_credit_id ON credit_entries(credit_id);
CREATE INDEX idx_credit_entries_project_id ON credit_entries(project_id);
CREATE INDEX idx_credit_entries_owner_id ON credit_entries(owner_id);
CREATE INDEX idx_credit_entries_status ON credit_entries(status);
CREATE INDEX idx_credit_entries_vintage ON credit_entries(vintage);

-- ============================================================================
-- CREDIT TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_id UUID NOT NULL REFERENCES credit_entries(id) ON DELETE RESTRICT,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('issuance', 'transfer', 'retirement')),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,
  quantity DECIMAL(15,2) NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  blockchain_tx_hash VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_credit_transactions_credit_id ON credit_transactions(credit_id);
CREATE INDEX idx_credit_transactions_sender_id ON credit_transactions(sender_id);
CREATE INDEX idx_credit_transactions_recipient_id ON credit_transactions(recipient_id);
CREATE INDEX idx_credit_transactions_transaction_type ON credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_blockchain_tx_hash ON credit_transactions(blockchain_tx_hash);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);

-- ============================================================================
-- BLOCKCHAIN TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE blockchain_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_transaction_id UUID REFERENCES credit_transactions(id) ON DELETE SET NULL,
  tx_hash VARCHAR(255) UNIQUE NOT NULL,
  tx_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (tx_status IN ('pending', 'confirmed', 'failed')),
  block_number BIGINT,
  block_hash VARCHAR(255),
  confirmations INTEGER DEFAULT 0,
  metadata JSONB NOT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blockchain_transactions_credit_transaction_id ON blockchain_transactions(credit_transaction_id);
CREATE INDEX idx_blockchain_transactions_tx_hash ON blockchain_transactions(tx_hash);
CREATE INDEX idx_blockchain_transactions_tx_status ON blockchain_transactions(tx_status);
CREATE INDEX idx_blockchain_transactions_submitted_at ON blockchain_transactions(submitted_at);

-- ============================================================================
-- AUDIT LOGS TABLE (with partitioning)
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create initial partitions for audit logs (current year + next year)
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE audit_logs_2024_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE audit_logs_2024_03 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

CREATE TABLE audit_logs_2024_04 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');

CREATE TABLE audit_logs_2024_05 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');

CREATE TABLE audit_logs_2024_06 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');

CREATE TABLE audit_logs_2024_07 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE audit_logs_2024_08 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

CREATE TABLE audit_logs_2024_09 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');

CREATE TABLE audit_logs_2024_10 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');

CREATE TABLE audit_logs_2024_11 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');

CREATE TABLE audit_logs_2024_12 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verification_requests_updated_at BEFORE UPDATE ON verification_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_entries_updated_at BEFORE UPDATE ON credit_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE users IS 'User accounts with authentication and role information';
COMMENT ON TABLE sessions IS 'User session management with JWT tokens';
COMMENT ON TABLE cardano_wallets IS 'Linked Cardano wallet addresses for users';
COMMENT ON TABLE projects IS 'Carbon offset projects registered by developers';
COMMENT ON TABLE project_documents IS 'Documents uploaded for projects';
COMMENT ON TABLE verification_requests IS 'Verification workflow for projects';
COMMENT ON TABLE verification_documents IS 'Documents uploaded during verification';
COMMENT ON TABLE verification_events IS 'Timeline events for verification workflow';
COMMENT ON TABLE credit_entries IS 'Carbon credit entries issued for verified projects';
COMMENT ON TABLE credit_transactions IS 'Transaction history for credit transfers and retirements';
COMMENT ON TABLE blockchain_transactions IS 'Cardano blockchain transaction records';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance';

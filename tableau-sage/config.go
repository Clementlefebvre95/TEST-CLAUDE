package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config is what the setup page saves, in %AppData%\TableauSage\config.json.
type Config struct {
	Server   string `json:"server"`
	Database string `json:"database"`
	Auth     string `json:"auth"` // "windows" or "sql"
	User     string `json:"user,omitempty"`
	Password string `json:"-"`
	Sealed   []byte `json:"password,omitempty"` // Password, encrypted for this Windows user
	Currency string `json:"currency"`
}

func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "TableauSage", "config.json"), nil
}

func loadConfig() (*Config, error) {
	path, err := configPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	plain, err := unprotect(cfg.Sealed)
	if err != nil {
		return nil, err
	}
	cfg.Password = string(plain)
	return &cfg, nil
}

func saveConfig(cfg *Config) error {
	path, err := configPath()
	if err != nil {
		return err
	}
	sealed, err := protect([]byte(cfg.Password))
	if err != nil {
		return err
	}
	out := *cfg
	out.Sealed = sealed
	data, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

package config

import (
	"strings"
	"testing"
)

// setDBEnv satisfies LoadConfig's database requirement so each test can focus
// on the JWT secret rules.
func setDBEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DB_URL", "postgres://user:pass@localhost:5432/synthbull")
}

func TestLoadConfigJWTSecret(t *testing.T) {
	strongSecret := strings.Repeat("k", minJWTSecretLen)

	t.Run("development falls back when unset", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "")
		t.Setenv("GIN_MODE", "")
		t.Setenv("JWT_SECRET", "")

		cfg, err := LoadConfig()
		if err != nil {
			t.Fatalf("expected dev fallback to succeed, got %v", err)
		}
		if string(cfg.JWTSecret) != fallbackJWTSecret {
			t.Errorf("expected the development fallback secret, got %q", cfg.JWTSecret)
		}
	})

	t.Run("development tolerates a short secret", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "")
		t.Setenv("GIN_MODE", "")
		t.Setenv("JWT_SECRET", "short")

		if _, err := LoadConfig(); err != nil {
			t.Fatalf("expected dev to tolerate a short secret, got %v", err)
		}
	})

	t.Run("production rejects an unset secret", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "production")
		t.Setenv("JWT_SECRET", "")

		if _, err := LoadConfig(); err == nil {
			t.Fatal("expected production to reject an unset JWT_SECRET")
		}
	})

	t.Run("production rejects the built-in fallback", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "production")
		t.Setenv("JWT_SECRET", fallbackJWTSecret)

		if _, err := LoadConfig(); err == nil {
			t.Fatal("expected production to reject the development fallback secret")
		}
	})

	t.Run("production rejects a short secret", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "production")
		t.Setenv("JWT_SECRET", strings.Repeat("k", minJWTSecretLen-1))

		if _, err := LoadConfig(); err == nil {
			t.Fatal("expected production to reject a short JWT_SECRET")
		}
	})

	t.Run("production accepts a strong secret", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "production")
		t.Setenv("JWT_SECRET", strongSecret)

		cfg, err := LoadConfig()
		if err != nil {
			t.Fatalf("expected a strong secret to be accepted, got %v", err)
		}
		if string(cfg.JWTSecret) != strongSecret {
			t.Error("configured secret was not carried through")
		}
	})

	t.Run("GIN_MODE=release is treated as production", func(t *testing.T) {
		setDBEnv(t)
		t.Setenv("APP_ENV", "")
		t.Setenv("GIN_MODE", "release")
		t.Setenv("JWT_SECRET", "short")

		if _, err := LoadConfig(); err == nil {
			t.Fatal("expected GIN_MODE=release to enforce production rules")
		}
	})
}

func TestLoadConfigRequiresDatabase(t *testing.T) {
	t.Setenv("DB_URL", "")
	t.Setenv("DB_HOST", "")
	t.Setenv("DB_USER", "")
	t.Setenv("DB_PASSWORD", "")
	t.Setenv("DB_NAME", "")
	t.Setenv("JWT_SECRET", strings.Repeat("k", minJWTSecretLen))

	if _, err := LoadConfig(); err == nil {
		t.Fatal("expected an error when no database configuration is present")
	}
}

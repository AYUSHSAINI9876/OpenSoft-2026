package config

import (
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// fallbackJWTSecret keeps local development frictionless. Anyone who reads this
// repository can forge tokens signed with it, so production must override it.
const fallbackJWTSecret = "synthbull_fallback_secret_change_me"

// minJWTSecretLen is the shortest secret accepted in production. HS256 keys
// below ~32 bytes are brute-forceable offline from a single captured token.
const minJWTSecretLen = 32

// isProduction reports whether the process is running in a deployed
// environment, in which case insecure defaults become fatal instead of merely
// noisy. Set APP_ENV=production (or GIN_MODE=release) when you deploy.
func isProduction() bool {
	env := strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV")))
	if env == "production" || env == "prod" {
		return true
	}
	return strings.ToLower(strings.TrimSpace(os.Getenv("GIN_MODE"))) == "release"
}

type Config struct {
	DBURL     string
	RedisURL  string
	JWTSecret []byte
	SMTPHost  string
	SMTPPort  string
	SMTPUser  string
	SMTPPass  string
}

func LoadConfig() (*Config, error) {
	// Load .env file if it exists, but don't error out if it doesn't (we could be in Docker)
	_ = godotenv.Load()

	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		// Fall back to individual vars — used by docker-compose and local dev.
		host := os.Getenv("DB_HOST")
		port := os.Getenv("DB_PORT")
		user := os.Getenv("DB_USER")
		password := os.Getenv("DB_PASSWORD")
		name := os.Getenv("DB_NAME")

		if host == "" || user == "" || password == "" || name == "" {
			return nil, fmt.Errorf("either DB_URL or all of DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME must be set")
		}
		if port == "" {
			port = "5432"
		}
		dbURL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s", user, password, host, port, name)
	}

	jwtSecretStr := os.Getenv("JWT_SECRET")
	prod := isProduction()

	switch {
	case jwtSecretStr == "" || jwtSecretStr == fallbackJWTSecret:
		if prod {
			return nil, fmt.Errorf(
				"JWT_SECRET is unset or still the built-in development value; " +
					"generate a unique secret (e.g. `openssl rand -base64 48`) and set JWT_SECRET before starting in production")
		}
		jwtSecretStr = fallbackJWTSecret
		log.Println("⚠️  JWT_SECRET not set — using the insecure development fallback. Never deploy with this.")

	case len(jwtSecretStr) < minJWTSecretLen:
		if prod {
			return nil, fmt.Errorf(
				"JWT_SECRET is only %d characters; use at least %d (e.g. `openssl rand -base64 48`)",
				len(jwtSecretStr), minJWTSecretLen)
		}
		log.Printf("⚠️  JWT_SECRET is short (%d chars); use at least %d in production.", len(jwtSecretStr), minJWTSecretLen)
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	return &Config{
		DBURL:     dbURL,
		RedisURL:  redisURL,
		JWTSecret: []byte(jwtSecretStr),
		SMTPHost:  os.Getenv("SMTP_HOST"),
		SMTPPort:  os.Getenv("SMTP_PORT"),
		SMTPUser:  os.Getenv("SMTP_USER"),
		SMTPPass:  os.Getenv("SMTP_PASS"),
	}, nil
}

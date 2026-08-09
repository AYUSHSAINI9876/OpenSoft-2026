package api

import "testing"

func TestBuildOriginChecker(t *testing.T) {
	tests := []struct {
		name   string
		env    string
		origin string
		want   bool
	}{
		// Loopback is trusted unconditionally so local dev needs no config.
		{"localhost allowed with empty config", "", "http://localhost:5173", true},
		{"docker port allowed", "", "http://localhost:3976", true},
		{"loopback IP allowed", "", "http://127.0.0.1:5173", true},
		{"https localhost allowed", "", "https://localhost:5173", true},

		// Without configuration, nothing else gets through.
		{"remote origin blocked by default", "", "https://oak-capital.vercel.app", false},
		{"attacker origin blocked", "", "https://evil.example.com", false},

		// Explicit allowlist.
		{"listed origin allowed", "https://oak-capital.vercel.app", "https://oak-capital.vercel.app", true},
		{"unlisted origin blocked", "https://oak-capital.vercel.app", "https://evil.example.com", false},
		{"scheme mismatch blocked", "https://oak-capital.vercel.app", "http://oak-capital.vercel.app", false},
		{"trailing slash in config tolerated", "https://oak-capital.vercel.app/", "https://oak-capital.vercel.app", true},
		{"whitespace in config tolerated", "  https://a.example.com , https://b.example.com ", "https://b.example.com", true},
		{"case-insensitive host match", "https://Oak-Capital.vercel.app", "https://oak-capital.vercel.app", true},

		// Wildcard suffix for Vercel preview deployments.
		{"wildcard suffix matches preview URL", "https://*.vercel.app", "https://oak-git-abc123.vercel.app", true},
		{"wildcard suffix rejects other TLD", "https://*.vercel.app", "https://oak.vercel.app.evil.com", false},
		{"wildcard suffix respects scheme", "https://*.vercel.app", "http://oak-preview.vercel.app", false},

		// Explicit allow-all.
		{"star allows anything", "*", "https://anything.example.com", true},

		// Malformed input must never be treated as allowed.
		{"empty origin blocked", "https://a.example.com", "", false},
		{"garbage origin blocked", "https://a.example.com", "not-a-url", false},
		{"scheme-only origin blocked", "https://a.example.com", "https://", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("CORS_ALLOWED_ORIGINS", tt.env)
			allow := buildOriginChecker()
			if got := allow(tt.origin); got != tt.want {
				t.Errorf("origin %q with CORS_ALLOWED_ORIGINS=%q: got %v, want %v",
					tt.origin, tt.env, got, tt.want)
			}
		})
	}
}

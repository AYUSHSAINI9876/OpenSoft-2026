package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"synthbull/internal/bot"
	"synthbull/internal/bot/builtin"
)

func main() {
	log.SetFlags(log.Ltime | log.Lmicroseconds)

	cfg := bot.DefaultConfig()
	log.Printf("market maker bot starting (client_id=%s, ws=%s)", cfg.ClientID, bot.WsURL())

	mgr := bot.NewManager(nil)
	mgr.RegisterStrategy("market_maker", builtin.NewMarketMakerStrategy)

	if _, err := mgr.Create("system", "mmb", "market_maker", cfg); err != nil {
		log.Fatalf("create bot: %v", err)
	}

	if err := mgr.Start("mmb"); err != nil {
		log.Fatalf("start bot: %v", err)
	}

	// graceful shutdown on SIGINT/SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("received %v, shutting down", sig)

	mgr.Stop("mmb")
}

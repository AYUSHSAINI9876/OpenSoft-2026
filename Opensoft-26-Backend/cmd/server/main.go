package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"synthbull/internal/api"
	"synthbull/internal/api/ws"
	"synthbull/internal/auth"
	"synthbull/internal/bot"
	"synthbull/internal/candle"
	"synthbull/internal/db"
	"synthbull/internal/dbwriter"
	"synthbull/internal/engine"
	"synthbull/internal/eventbus"
	"synthbull/internal/market"
	"synthbull/internal/portfolio"
	"synthbull/internal/simbot"
	"synthbull/pkg/config"
	"synthbull/pkg/models"
	"syscall"
	"time"
)

// Entry point — loads config, optionally initializes DB, wires services, starts the API server.
func main() {
	log.Println("Starting OpenSoft-26 Backend...")

	// 1. Load configuration (DB is optional — server runs without it)
	cfg, err := config.LoadConfig()
	dbAvailable := true
	if err != nil {
		log.Printf("Warning: config load failed (%v) — running without database", err)
		dbAvailable = false
		cfg = &config.Config{
			JWTSecret: []byte("synthbull_fallback_secret_change_me"),
		}
	}

	// 2. Initialize Database Connection (non-fatal)
	ctx := context.Background()
	if dbAvailable {
		if err := db.InitDB(ctx, cfg.DBURL); err != nil {
			log.Printf("Warning: database init failed (%v) — running without database", err)
			dbAvailable = false
		} else {
			log.Println("Database initialized successfully")
			defer db.CloseDB()
			if err := db.RunMigrations(ctx); err != nil {
				log.Printf("Warning: migration failed: %v", err)
			} else {
				log.Println("Database migrations checked")
			}
		}
	}

	// 3. Initialize Auth & Email Services (needed for WebSocket Hub)
	emailSvc := auth.NewEmailService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPass)
	authService := auth.NewService(db.Pool, cfg.JWTSecret, emailSvc)

	// 2b. Seed instruments and build symbol→id map
	var symbolMap map[string]int64
	if dbAvailable {
		seeds := make([]db.InstrumentSeed, 0, 7)
		for _, p := range market.IndianStockPresets() {
			seeds = append(seeds, db.InstrumentSeed{
				Symbol:        p.Symbol,
				BaseCurrency:  p.Symbol,
				QuoteCurrency: "INR",
				TickSize:      p.Config.TickSize,
				LotSize:       float64(p.Config.MinQty),
			})
		}
		if m, err := db.SeedInstruments(ctx, seeds); err != nil {
			log.Printf("Warning: instrument seed failed: %v", err)
		} else {
			symbolMap = m
		}
	}

	// 4. Initialize Redis event bus (non-fatal)
	var bus *eventbus.Bus
	if cfg.RedisURL != "" {
		b, err := eventbus.New(cfg.RedisURL)
		if err != nil {
			log.Printf("Warning: Redis init failed (%v) — running without event bus", err)
		} else {
			bus = b
			defer bus.Close()
			log.Println("Redis event bus initialized")
		}
	}

	// 4. Parse flags
	//
	// Managed hosts (Render, Railway, Fly.io, Heroku) inject the port to bind
	// as $PORT and route traffic there, so it seeds the default. An explicit
	// -port flag still wins, which keeps local overrides working.
	defaultPort := 8080
	if envPort := strings.TrimSpace(os.Getenv("PORT")); envPort != "" {
		if parsed, err := strconv.Atoi(envPort); err == nil && parsed > 0 && parsed <= 65535 {
			defaultPort = parsed
		} else {
			log.Printf("Warning: ignoring invalid PORT=%q, falling back to %d", envPort, defaultPort)
		}
	}
	port := flag.Int("port", defaultPort, "HTTP server port")
	flag.Parse()

	// 6. Initialize WebSocket hub
	hub := ws.NewHub(authService)
	go hub.Run()
	defer hub.Stop()

	// 7. Initialize BookManager — hub satisfies api.Broadcaster
	bookManager := api.NewBookManager(hub)
	defer bookManager.Close()

	// 8. Portfolio manager (async DB flush only when DB is available)
	portfolioMgr := portfolio.NewManager(db.Pool, hub)
	defer portfolioMgr.Stop()

	// Track user-owned limit orders so deferred simulator fills update portfolio/history.
	limitTracker := api.NewLimitOrderTracker()

	// 9. Start market simulation
	//    Each GBM generator is wired to the SAME engine handle as the corresponding
	//    BookManager book. This means simulated orders and user REST orders all land
	//    in one unified order book per symbol.
	mktMgr := market.NewManager()

	for _, preset := range market.IndianStockPresets() {
		sym := preset.Symbol

		// Pre-create (or get existing) BookManager book for this symbol.
		managed := bookManager.GetOrCreate(sym)

		// Register with the market manager using the shared engine + mutex.
		if err := mktMgr.AddSymbolWithHandle(sym, preset.Class, preset.Config,
			managed.GetHandle(), managed.GetMu()); err != nil {
			log.Printf("Warning: could not add symbol %s: %v", sym, err)
			continue
		}

		info := mktMgr.GetSymbol(sym)
		if info == nil {
			continue
		}

		capturedSym := sym
		capturedManaged := managed
		capturedHub := hub
		capturedBus := bus
		capturedPortfolioMgr := portfolioMgr
		capturedTracker := limitTracker
		var capturedBusPub *eventbus.Publisher
		if capturedBus != nil {
			capturedBusPub = capturedBus.Pub
		}

		info.SetOnTrade(func(_ string, side int, result engine.OrderResult) {
			if len(result.Trades) == 0 {
				return
			}

			capturedTracker.ReconcileTrades(context.Background(), capturedSym, result.Trades, capturedPortfolioMgr, capturedBusPub)

			capturedHub.BroadcastTrades(capturedSym, result.Trades, side)
			depth := capturedManaged.GetDepth()
			capturedHub.BroadcastTicker(capturedSym, depth.BestBid, depth.BestAsk, depth.LastPrice)
			capturedHub.BroadcastDepth(capturedSym, depth)

			if capturedBus != nil {
				now := time.Now().UTC()
				for _, t := range result.Trades {
					takerSide := "sell"
					if side == engine.SideBuy {
						takerSide = "buy"
					}
					_ = capturedBus.Pub.PublishTrade(ctx, eventbus.TradeEvent{
						Symbol:       capturedSym,
						Price:        int64(t.Price),
						Quantity:     int64(t.Qty),
						MakerOrderID: int64(t.MakerOrderID),
						TakerOrderID: int64(t.TakerOrderID),
						TakerSide:    models.Side(takerSide),
						ExecutedAt:   now,
					})
				}
				_ = capturedBus.Pub.PublishTicker(ctx, eventbus.TickerEvent{
					Symbol:    capturedSym,
					BestBid:   int64(depth.BestBid),
					BestAsk:   int64(depth.BestAsk),
					LastPrice: int64(depth.LastPrice),
					Timestamp: now,
				})
			}
		})

		// Wire GBM price ticks into the candle builder and broadcast depth on every tick.
		info.Generator.SetOnBasePrice(func(sample market.BasePriceSample) {
			capturedHub.UpdateCandlePrice(capturedSym, sample.Price, sample.Timestamp)
			depth := capturedManaged.GetDepth()
			capturedHub.BroadcastDepth(capturedSym, depth)
			if capturedBus != nil {
				_ = capturedBus.Pub.PublishGBMTick(ctx, eventbus.GBMTickEvent{
					Symbol:    capturedSym,
					BasePrice: int64(sample.Price * 100),
					Timestamp: time.UnixMilli(sample.Timestamp).UTC(),
				})
			}
		})
	}

	mktMgr.StartAll()
	defer mktMgr.StopAll()
	// Note: do NOT call mktMgr.CloseAll() — the engines are owned by bookManager,
	// which calls Close() on each ManagedBook during its own defer bookManager.Close().

	// 9. Build symbol list and candle repo
	allSymbols := make([]string, 0, 7)
	for _, p := range market.IndianStockPresets() {
		allSymbols = append(allSymbols, p.Symbol)
	}

	var candleRepo *db.CandleRepo
	if symbolMap != nil {
		candleRepo = db.NewCandleRepo(symbolMap)
	}

	// 10. Start candle pipeline (trade events → OHLCV aggregation → Redis → DB)
	if bus != nil {
		cb := candle.NewBuilder(bus.Sub, bus.Pub)
		cb.Start(ctx, allSymbols)
	}

	if bus != nil && candleRepo != nil {
		cw := dbwriter.NewCandleWriter(bus.Sub, 60)
		cw.Start(ctx, allSymbols, []string{"1s"}, func(batch []eventbus.CandleEvent) error {
			return candleRepo.InsertBatch(ctx, batch)
		})
	}

	// 11. Wire DB writers (Redis event streams → PostgreSQL)
	if bus != nil && db.Pool != nil && symbolMap != nil {
		tradeRepo := dbwriter.NewTradeRepository(db.Pool, symbolMap)
		tw := dbwriter.NewTradeWriter(bus.Sub)
		tw.Start(ctx, allSymbols, tradeRepo.InsertTradeHandler(ctx))
	}

	if bus != nil && db.Pool != nil {
		orderRepo := dbwriter.NewOrderRepository(db.Pool)
		ow := dbwriter.NewOrderWriter(bus.Sub)
		ow.Start(ctx, orderRepo.InsertOrderUpdateHandler(ctx))

		errorRepo := dbwriter.NewErrorRepository(db.Pool)
		ew := dbwriter.NewErrorWriter(bus.Sub)
		ew.Start(ctx, errorRepo.InsertErrorHandler(ctx))

		alertRepo := dbwriter.NewAlertRepository(db.Pool)
		aw := dbwriter.NewAlertWriter(bus.Sub)
		aw.StartGlobal(ctx, alertRepo.InsertAlertHandler(ctx))

		botRepo := dbwriter.NewBotStatusRepository(db.Pool)
		bw := dbwriter.NewBotStatusWriter(bus.Sub)
		bw.StartGlobal(ctx, botRepo.InsertBotStatusHandler(ctx))
	}

	// 12. Simulation bot manager
	simbotMgr := simbot.NewBotManager()
	defer simbotMgr.Close()

	// 13. Real trading bot manager
	botMgr := bot.NewManager(hub)

	// 11. Auth & email service -- ALREADY INITIALIZED ABOVE

	// 15. Optional Redis publisher (nil when Redis is unavailable)
	var busPub *eventbus.Publisher
	if bus != nil {
		busPub = bus.Pub
	}

	// 16. Watchlist repo (nil when DB is unavailable)
	var watchlistRepo *db.WatchlistRepo
	if symbolMap != nil {
		watchlistRepo = db.NewWatchlistRepo(symbolMap)
	}

	var userBotPnL *db.UserBotPnLRepo
	var leaderboardRepo *db.LeaderboardRepo
	if db.Pool != nil {
		userBotPnL = db.NewUserBotPnLRepo(db.Pool)
		leaderboardRepo = db.NewLeaderboardRepo(db.Pool)
	}

	// 17. Build router — all routes registered in one place
	ginRouter := api.SetupRouter(
		mktMgr,
		portfolioMgr,
		botMgr,
		authService,
		hub,
		candleRepo,
		simbotMgr,
		bookManager,
		busPub,
		watchlistRepo,
		limitTracker,
		userBotPnL,
		leaderboardRepo,
	)

	// 18. Start HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      ginRouter,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server listening on :%d  (db=%v)", *port, dbAvailable)
		log.Printf("API:       http://localhost:%d/api/v1/", *port)
		log.Printf("WebSocket: ws://localhost:%d/ws", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// 19. Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server shutdown completed")
}

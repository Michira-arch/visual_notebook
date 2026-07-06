package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"

	"github.com/gorilla/websocket"
)

func init() {
	// Load .env if present (mirrors Python's _load_env)
	if f, err := os.Open("../.env"); err == nil {
		defer f.Close()
		s := bufio.NewScanner(f)
		for s.Scan() {
			line := strings.TrimSpace(s.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
				os.Setenv(k, v)
			}
		}
	}
}

var (
	token   string
	clients = sync.Map{} // id -> *session
)

type wsMessage struct {
	Type     string         `json:"type"`
	Data     string         `json:"data"`
	Cols     int            `json:"cols"`
	Rows     int            `json:"rows"`
	CellID   string         `json:"cellId,omitempty"`
	Language string         `json:"language,omitempty"`
	Code     string         `json:"code,omitempty"`
	Registry map[string]any `json:"registry,omitempty"`
	Timeout  int            `json:"timeout,omitempty"`
}

type outputMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

func main() {
	token = os.Getenv("APP_SECRET_TOKEN")
	if token == "" {
		log.Fatal("APP_SECRET_TOKEN must be set in .env")
	}

	port := "8767"
	if p := os.Getenv("GO_TERMD_PORT"); p != "" {
		port = p
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // localhost only in practice
		},
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("token") != token {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("upgrade error: %v", err)
			return
		}
		handleSession(conn)
	})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("shutting down...")
		os.Exit(0)
	}()

	addr := fmt.Sprintf("localhost:%s", port)
	log.Printf("🔥 Go termd listening on ws://%s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func handleSession(conn *websocket.Conn) {
	defer conn.Close()

	var writeMu sync.Mutex
	writeMsg := func(messageType int, data []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		return conn.WriteMessage(messageType, data)
	}

	sess := newSession()
	sess.start(conn)

	done := make(chan struct{})
	go func() {
		defer close(done)
		sess.readOutput(writeMsg)
	}()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg wsMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "input":
			sess.writeInput([]byte(msg.Data))
		case "resize":
			sess.resize(msg.Cols, msg.Rows)
		case "terminate":
			sess.kill()
			return
		case "execute_code":
			go func(m wsMessage) {
				req := ExecuteRequest{
					CellID:   m.CellID,
					Language: m.Language,
					Code:     m.Code,
					Registry: m.Registry,
					Timeout:  m.Timeout,
				}
				res := ExecuteCode(req)
				resBytes, _ := json.Marshal(res)
				writeMsg(websocket.TextMessage, resBytes)
			}(msg)
		case "detect_compilers":
			go func() {
				compilers := DetectCompilers()
				res := map[string]any{
					"type":      "compilers_result",
					"compilers": compilers,
				}
				resBytes, _ := json.Marshal(res)
				writeMsg(websocket.TextMessage, resBytes)
			}()
		}
	}

	sess.kill()
	<-done
}

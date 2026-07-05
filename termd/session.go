package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type session struct {
	mu   sync.Mutex
	pty  ptyHandle
	dead bool
}

func newSession() *session {
	return &session{}
}

func (s *session) kill() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.dead = true
	if s.pty != nil {
		s.pty.Close()
	}
}

func (s *session) writeInput(data []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dead || s.pty == nil {
		return
	}
	s.pty.Write(data)
}

func (s *session) resize(cols, rows int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dead || s.pty == nil {
		return
	}
	s.pty.Resize(cols, rows)
}

func (s *session) readOutput(conn *websocket.Conn) {
	buf := make([]byte, 4096)
	for {
		n, err := s.pty.Read(buf)
		if err != nil {
			break
		}
		if n > 0 {
			msg, _ := json.Marshal(outputMessage{
				Type: "output",
				Data: string(buf[:n]),
			})
			conn.WriteMessage(websocket.TextMessage, msg)
		}
	}
	// Send exit signal
	msg, _ := json.Marshal(outputMessage{
		Type: "exit",
	})
	conn.WriteMessage(websocket.TextMessage, msg)
}

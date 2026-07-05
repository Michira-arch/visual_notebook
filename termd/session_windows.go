//go:build windows

package main

import (
	"os/exec"

	"github.com/UserExistsError/conpty"
)

type winSession struct {
	cpty *conpty.ConPty
	cmd  *exec.Cmd
}

func (s *session) start(conn interface{}) {
	cpty, err := conpty.Start(`powershell.exe -NoProfile -NoLogo`)
	if err != nil {
		// Fallback to cmd
		cpty, err = conpty.Start(`cmd.exe`)
		if err != nil {
			return
		}
	}

	// Set initial size
	cpty.Resize(120, 40)

	s.pty = &winSession{
		cpty: cpty,
	}
}

func (w *winSession) Read(p []byte) (int, error) {
	return w.cpty.Read(p)
}

func (w *winSession) Write(p []byte) (int, error) {
	return w.cpty.Write(p)
}

func (w *winSession) Resize(cols, rows int) error {
	return w.cpty.Resize(cols, rows)
}

func (w *winSession) Close() error {
	return w.cpty.Close()
}

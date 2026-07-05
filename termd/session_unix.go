//go:build !windows

package main

import (
	"os"
	"os/exec"

	"github.com/creack/pty"
)

type unixSession struct {
	file *os.File
	cmd  *exec.Cmd
}

func (s *session) start(conn interface{}) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	f, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: 120, Rows: 40})
	if err != nil {
		return
	}

	s.pty = &unixSession{
		file: f,
		cmd:  cmd,
	}
}

func (u *unixSession) Read(p []byte) (int, error) {
	return u.file.Read(p)
}

func (u *unixSession) Write(p []byte) (int, error) {
	return u.file.Write(p)
}

func (u *unixSession) Resize(cols, rows int) error {
	return pty.Setsize(u.file, &pty.Winsize{
		Cols: uint16(cols),
		Rows: uint16(rows),
	})
}

func (u *unixSession) Close() error {
	if u.cmd != nil && u.cmd.Process != nil {
		u.cmd.Process.Kill()
	}
	return u.file.Close()
}

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// ExecuteRequest defines the input payload for running code
type ExecuteRequest struct {
	CellID   string            `json:"cellId"`
	Language string            `json:"language"`
	Code     string            `json:"code"`
	Registry map[string]any    `json:"registry"`
	Timeout  int               `json:"timeout"` // in seconds
}

// ExecuteResponse defines the output payload returned to the client
type ExecuteResponse struct {
	Type     string            `json:"type"` // "execute_result"
	CellID   string            `json:"cellId"`
	Status   string            `json:"status"` // "success", "error", "timeout", "no-compiler"
	Stdout   string            `json:"stdout"`
	Stderr   string            `json:"stderr"`
	ExitCode int               `json:"exitCode"`
	Duration int64             `json:"duration"` // in milliseconds
	Outputs  map[string]any    `json:"outputs"`  // registry updates parsed from stdout
}

// ExecuteCode writes, compiles (if necessary), and runs the code
func ExecuteCode(req ExecuteRequest) ExecuteResponse {
	start := time.Now()
	
	if req.Timeout <= 0 {
		req.Timeout = 15 // default 15s timeout
	}

	// 1. Check if compiler/interpreter is available
	compilerPath, available := CheckCompiler(req.Language)
	if !available {
		return ExecuteResponse{
			Type:     "execute_result",
			CellID:   req.CellID,
			Status:   "no-compiler",
			Stderr:   fmt.Sprintf("Error: Compiler or interpreter for '%s' not found on system PATH.", req.Language),
			ExitCode: -1,
			Duration: time.Since(start).Milliseconds(),
		}
	}

	// 2. Create a temp directory
	tempDir, err := os.MkdirTemp("", "vnb-run-*")
	if err != nil {
		return ExecuteResponse{
			Type:     "execute_result",
			CellID:   req.CellID,
			Status:   "error",
			Stderr:   fmt.Sprintf("Failed to create temp directory: %v", err),
			ExitCode: -1,
			Duration: time.Since(start).Milliseconds(),
		}
	}
	defer os.RemoveAll(tempDir)

	// 3. Determine filename and compile/run commands
	var fileName string
	var compileCmd *exec.Cmd
	var runCmd *exec.Cmd

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(req.Timeout)*time.Second)
	defer cancel()

	lang := strings.ToLower(req.Language)
	switch lang {
	case "python", "py":
		fileName = "main.py"
		runCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName))
		
	case "javascript", "js":
		fileName = "main.js"
		runCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName))
		
	case "typescript", "ts":
		fileName = "main.ts"
		if strings.HasSuffix(compilerPath, "npx") {
			runCmd = exec.CommandContext(ctx, compilerPath, "tsx", filepath.Join(tempDir, fileName))
		} else {
			runCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName))
		}
		
	case "go":
		fileName = "main.go"
		// go run needs to run inside temp directory or point to the file
		runCmd = exec.CommandContext(ctx, compilerPath, "run", filepath.Join(tempDir, fileName))
		
	case "rust", "rs":
		fileName = "main.rs"
		exePath := filepath.Join(tempDir, "main.exe")
		compileCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName), "-o", exePath)
		runCmd = exec.CommandContext(ctx, exePath)
		
	case "c":
		fileName = "main.c"
		exePath := filepath.Join(tempDir, "main.exe")
		compileCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName), "-o", exePath)
		runCmd = exec.CommandContext(ctx, exePath)
		
	case "cpp", "c++":
		fileName = "main.cpp"
		exePath := filepath.Join(tempDir, "main.exe")
		compileCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName), "-o", exePath)
		runCmd = exec.CommandContext(ctx, exePath)
		
	case "java":
		// Java needs the file name to match the public class name. Let's parse it.
		fileName = "Main.java"
		className := "Main"
		re := regexp.MustCompile(`public\s+class\s+([a-zA-Z0-9_]+)`)
		matches := re.FindStringSubmatch(req.Code)
		if len(matches) > 1 {
			className = matches[1]
			fileName = className + ".java"
		}
		
		compileCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName))
		// Java runner
		javaPath, err := exec.LookPath("java")
		if err != nil {
			return ExecuteResponse{
				Type:     "execute_result",
				CellID:   req.CellID,
				Status:   "no-compiler",
				Stderr:   "Error: 'java' runtime not found on system PATH (needed to execute compiled class).",
				ExitCode: -1,
				Duration: time.Since(start).Milliseconds(),
			}
		}
		runCmd = exec.CommandContext(ctx, javaPath, "-cp", tempDir, className)
		
	case "bash", "sh":
		fileName = "main.sh"
		runCmd = exec.CommandContext(ctx, compilerPath, filepath.Join(tempDir, fileName))
		
	default:
		return ExecuteResponse{
			Type:     "execute_result",
			CellID:   req.CellID,
			Status:   "error",
			Stderr:   fmt.Sprintf("Execution not supported for language: %s", req.Language),
			ExitCode: -1,
			Duration: time.Since(start).Milliseconds(),
		}
	}

	// 4. Write code to file
	err = os.WriteFile(filepath.Join(tempDir, fileName), []byte(req.Code), 0644)
	if err != nil {
		return ExecuteResponse{
			Type:     "execute_result",
			CellID:   req.CellID,
			Status:   "error",
			Stderr:   fmt.Sprintf("Failed to write source file: %v", err),
			ExitCode: -1,
			Duration: time.Since(start).Milliseconds(),
		}
	}

	// 5. Compile if necessary
	if compileCmd != nil {
		var compileStderr bytes.Buffer
		compileCmd.Stderr = &compileStderr
		err = compileCmd.Run()
		if err != nil {
			status := "error"
			if ctx.Err() == context.DeadlineExceeded {
				status = "timeout"
			}
			return ExecuteResponse{
				Type:     "execute_result",
				CellID:   req.CellID,
				Status:   status,
				Stderr:   fmt.Sprintf("Compilation Error:\n%s\n%v", compileStderr.String(), err),
				ExitCode: 1,
				Duration: time.Since(start).Milliseconds(),
			}
		}
	}

	// 6. Run executable
	var stdoutBuf, stderrBuf bytes.Buffer
	runCmd.Stdout = &stdoutBuf
	runCmd.Stderr = &stderrBuf

	err = runCmd.Run()
	duration := time.Since(start).Milliseconds()

	status := "success"
	exitCode := 0

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			status = "timeout"
			exitCode = -1
		} else {
			status = "error"
			exitCode = 1
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			}
		}
	}

	// 7. Parse outputs and extract __VNB_SET__
	cleanStdout, outputs := parseVnbOutputs(stdoutBuf.String())

	return ExecuteResponse{
		Type:     "execute_result",
		CellID:   req.CellID,
		Status:   status,
		Stdout:   cleanStdout,
		Stderr:   stderrBuf.String(),
		ExitCode: exitCode,
		Duration: duration,
		Outputs:  outputs,
	}
}

// Parse __VNB_SET__:{"name":"x","value":42} lines from stdout
func parseVnbOutputs(stdout string) (string, map[string]any) {
	outputs := make(map[string]any)
	var cleanLines []string
	
	lines := strings.Split(stdout, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "__VNB_SET__:") {
			jsonStr := strings.TrimPrefix(trimmed, "__VNB_SET__:")
			var update struct {
				Name  string `json:"name"`
				Value any    `json:"value"`
			}
			if err := json.Unmarshal([]byte(jsonStr), &update); err == nil {
				outputs[update.Name] = update.Value
			}
		} else {
			// Retain original line (including newline endings if they weren't stripped)
			cleanLines = append(cleanLines, line)
		}
	}
	
	return strings.Join(cleanLines, "\n"), outputs
}

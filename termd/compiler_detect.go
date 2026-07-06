package main

import (
	"os/exec"
	"strings"
)

// Language to compiler/interpreter mapping
var compilerBins = map[string][]string{
	"python":     {"python3", "python"},
	"go":         {"go"},
	"rust":       {"rustc"},
	"c":          {"gcc", "clang", "cc"},
	"cpp":        {"g++", "clang++", "c++"},
	"java":       {"javac"},
	"javascript": {"node"},
	"typescript": {"tsx", "ts-node", "npx"},
	"bash":       {"bash", "sh"},
}

// DetectCompilers checks which compilers are installed and returns their paths
func DetectCompilers() map[string]string {
	result := make(map[string]string)
	for lang, bins := range compilerBins {
		for _, bin := range bins {
			path, err := exec.LookPath(bin)
			if err == nil {
				// Save the bin name that worked (or full path)
				result[lang] = path
				break
			}
		}
	}
	return result
}

// CheckCompiler checks if a compiler for a specific language is available
func CheckCompiler(lang string) (string, bool) {
	bins, ok := compilerBins[strings.ToLower(lang)]
	if !ok {
		return "", false
	}
	for _, bin := range bins {
		path, err := exec.LookPath(bin)
		if err == nil {
			return path, true
		}
	}
	return "", false
}

//go:build !windows

package main

import (
	"errors"
	"syscall"
)

// The real target is Windows; these fallbacks only exist so the app can be
// built and tested on other systems.

func setupConsole() {}

func protect(plain []byte) ([]byte, error) { return plain, nil }

func unprotect(sealed []byte) ([]byte, error) { return sealed, nil }

func setBroadcast(fd uintptr) error {
	return syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
}

func minimizeConsole() {}

func autostartSupported() bool { return false }
func autostartEnabled() bool   { return false }

func setAutostart(bool) error {
	return errors.New("démarrage automatique disponible sous Windows uniquement")
}

func keepAwakeSupported() bool { return false }
func setKeepAwake(bool)        {}

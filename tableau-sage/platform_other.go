//go:build !windows

package main

import "syscall"

// The real target is Windows; these fallbacks only exist so the app can be
// built and tested on other systems.

func setupConsole() {}

func protect(plain []byte) ([]byte, error) { return plain, nil }

func unprotect(sealed []byte) ([]byte, error) { return sealed, nil }

func setBroadcast(fd uintptr) error {
	return syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
}

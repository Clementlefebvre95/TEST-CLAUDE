//go:build windows

package main

import (
	"errors"
	"os"
	"runtime"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// setupConsole switches the console to UTF-8 so accents print correctly.
func setupConsole() {
	windows.SetConsoleOutputCP(65001)
}

// protect encrypts a secret with DPAPI: only this Windows user on this PC can
// decrypt it, so the password never sits in clear text in the config file.
func protect(plain []byte) ([]byte, error) {
	if len(plain) == 0 {
		return nil, nil
	}
	in := windows.DataBlob{Size: uint32(len(plain)), Data: &plain[0]}
	var out windows.DataBlob
	if err := windows.CryptProtectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out); err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(out.Data)))
	return append([]byte(nil), unsafe.Slice(out.Data, out.Size)...), nil
}

func unprotect(sealed []byte) ([]byte, error) {
	if len(sealed) == 0 {
		return nil, nil
	}
	in := windows.DataBlob{Size: uint32(len(sealed)), Data: &sealed[0]}
	var out windows.DataBlob
	if err := windows.CryptUnprotectData(&in, nil, nil, 0, nil, windows.CRYPTPROTECT_UI_FORBIDDEN, &out); err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(out.Data)))
	return append([]byte(nil), unsafe.Slice(out.Data, out.Size)...), nil
}

func setBroadcast(fd uintptr) error {
	return syscall.SetsockoptInt(syscall.Handle(fd), syscall.SOL_SOCKET, syscall.SO_BROADCAST, 1)
}

var (
	kernel32                    = windows.NewLazySystemDLL("kernel32.dll")
	user32                      = windows.NewLazySystemDLL("user32.dll")
	procGetConsoleWindow        = kernel32.NewProc("GetConsoleWindow")
	procSetThreadExecutionState = kernel32.NewProc("SetThreadExecutionState")
	procShowWindow              = user32.NewProc("ShowWindow")
)

// minimizeConsole shrinks the black window to the taskbar when Windows starts
// the dashboard at logon: it keeps running, and can still be closed.
func minimizeConsole() {
	if hwnd, _, _ := procGetConsoleWindow.Call(); hwnd != 0 {
		const swMinimize = 6
		procShowWindow.Call(hwnd, swMinimize)
	}
}

const (
	runKey   = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValue = "TableauSage"
)

func autostartSupported() bool { return true }

// autostartEnabled reports whether Windows starts the dashboard at logon.
func autostartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	v, _, err := k.GetStringValue(runValue)
	return err == nil && v != ""
}

// setAutostart adds or removes this program in the current user's Run key.
func setAutostart(on bool) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if !on {
		if err := k.DeleteValue(runValue); err != nil && !errors.Is(err, registry.ErrNotExist) {
			return err
		}
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	return k.SetStringValue(runValue, `"`+exe+`" -autostart`)
}

func keepAwakeSupported() bool { return true }

var awake struct {
	sync.Mutex
	stop chan struct{}
}

// setKeepAwake stops Windows from going to sleep on its own while the
// dashboard runs, so phones can reach it. The screen may still turn off.
// The request belongs to a thread, hence the goroutine locked to one.
func setKeepAwake(on bool) {
	awake.Lock()
	defer awake.Unlock()
	if on == (awake.stop != nil) {
		return
	}
	if !on {
		close(awake.stop)
		awake.stop = nil
		return
	}
	stop := make(chan struct{})
	awake.stop = stop
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		const esContinuous, esSystemRequired = 0x80000000, 0x00000001
		procSetThreadExecutionState.Call(esContinuous | esSystemRequired)
		<-stop
		procSetThreadExecutionState.Call(esContinuous)
	}()
}

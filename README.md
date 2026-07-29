# CorePanel

> Modern web-based system management panel for Windows and Linux.

CorePanel is an open-source web control panel designed for managing Windows and Linux systems directly from your browser.

The goal of CorePanel is to provide a clean, fast and modern interface for system administration without requiring Remote Desktop, VNC or SSH for everyday tasks.

---

## Features

### Authentication

- One-time administrator registration
- Secure login system
- Session authentication

### Console

- Interactive terminal
- Multiple terminal tabs
- ANSI color support
- Full keyboard support
- Windows Command Prompt / PowerShell
- Linux Bash (coming soon)

### Task Manager

- Live process list
- Search processes
- Sort by CPU, RAM, PID or name
- End process
- Suspend process
- Resume process
- Real executable icons
- Process information
- Resource usage bars

### Services

- View installed services
- Start services
- Stop services
- Restart services
- Change startup type
- Search services

### System Information

- Operating system
- Kernel version
- CPU usage
- RAM usage
- Disk usage
- Network statistics
- Hardware information

### Virtualization

- QEMU management
- Virtual machine control
- VM status
- Start / Stop / Restart virtual machines

### File Manager *(planned)*

- Browse files
- Upload files
- Download files
- Edit text files
- Create folders
- Delete files
- Rename files

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| Windows 10 | ✅ Supported |
| Windows 11 | ✅ Supported |
| Windows Server | ✅ Planned |
| Debian | 🚧 In Development |
| Ubuntu | 🚧 Planned |
| Arch Linux | 🚧 Planned |

---

## Screenshots

Coming soon.

---

## Roadmap

- [x] Authentication
- [x] Terminal
- [x] System Information
- [x] Task Manager
- [ ] Services
- [ ] File Manager
- [ ] QEMU Manager
- [ ] Users
- [ ] Network Manager
- [ ] Firewall
- [ ] Package Manager
- [ ] Settings
- [ ] Plugins

---

## Technologies

- Node.js
- Express
- Socket.IO
- xterm.js
- systeminformation
- HTML5
- CSS3
- JavaScript

---

## Installation

```bash
git clone https://github.com/L1ghtn1ngXD/CorePanel.git

cd CorePanel

npm install

node server.js
```

Open:

```
http://localhost:3000
```

---

## License

This project is currently not licensed.

---

## Author

Created by **V0ltage**

GitHub:
https://github.com/L1ghtn1ngXD

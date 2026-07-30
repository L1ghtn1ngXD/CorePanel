# CorePanel Documentation

> Version: 1.0
>
> Last Updated: August 2026

---

# Table of Contents

- Chapter 1 - Introduction
- Chapter 2 - System Requirements
- Chapter 3 - Installation
- Chapter 4 - First Launch
- Chapter 5 - Authentication
- Chapter 6 - Dashboard
- Chapter 7 - Console
- Chapter 8 - File Manager
- Chapter 9 - Task Manager
- Chapter 10 - Services
- Chapter 11 - System Information
- Chapter 12 - QEMU
- Chapter 13 - Configuration
- Chapter 14 - API Reference
- Chapter 15 - Reverse Proxy
- Chapter 16 - HTTPS
- Chapter 17 - Security
- Chapter 18 - Troubleshooting
- Chapter 19 - Frequently Asked Questions

---

# Chapter 1 - Introduction

## What is CorePanel?

CorePanel is a lightweight web-based server management panel written in Node.js.

The project is designed to provide a modern and simple interface for managing Windows and Linux servers without requiring a full desktop environment.

CorePanel runs as a standalone application and can be accessed through any modern web browser.

Unlike many enterprise control panels, CorePanel focuses on simplicity, speed and low resource usage while still providing powerful administration tools.

---

## Main Goals

CorePanel was created with several goals in mind.

- Lightweight architecture
- Easy deployment
- Modern web interface
- Cross-platform support
- Fast response time
- Easy maintenance
- Minimal dependencies
- Native operating system integration

Every feature is designed to work directly with the operating system whenever possible.

---

## Supported Platforms

Current versions officially support

| Platform | Status |
|----------|--------|
| Windows 10 | Supported |
| Windows 11 | Supported |
| Debian Linux | Supported |

Additional operating systems may be supported in future releases.

---

## Main Features

CorePanel currently includes the following modules.

- Dashboard
- Interactive Console
- File Manager
- Task Manager
- Services
- System Information
- QEMU Virtual Machine Manager

Each module is described in detail later in this document.

---

## Browser Compatibility

CorePanel supports modern browsers including

- Firefox
- Chromium
- Google Chrome
- Microsoft Edge
- Brave
- Vivaldi

JavaScript must be enabled.

---

## Network Requirements

CorePanel communicates using HTTP or HTTPS.

The server must be reachable through the configured network port.

When using HTTPS, a valid TLS certificate is recommended.

---

## Permissions

Some functions require elevated operating system permissions.

Examples include

- Managing services
- Reading hardware information
- Starting virtual machines
- Accessing protected directories

Always run CorePanel using an account that has the required permissions for your environment.

---

# Chapter 2 - System Requirements

## Minimum Requirements

| Component | Requirement |
|----------|-------------|
| CPU | Dual Core |
| RAM | 2 GB |
| Storage | 200 MB Free Space |
| Network | Ethernet or Wi-Fi |
| Browser | Modern Browser |

---

## Recommended Requirements

| Component | Recommended |
|----------|-------------|
| CPU | Quad Core or Better |
| RAM | 4 GB or More |
| Storage | SSD |
| Network | Gigabit Ethernet |
| Browser | Latest Firefox or Chromium |

---

## Supported Node.js Version

CorePanel requires a modern Node.js installation.

Recommended version

```
Node.js 22 LTS or newer
```

---

## Linux Packages

Depending on enabled features, the following packages may be required.

```
nodejs
npm
libvirt-daemon-system
libvirt-clients
qemu-system
qemu-utils
```

Additional packages may be necessary depending on your Linux distribution.

---

## Windows Requirements

Windows systems require

- Node.js
- Administrator permissions for some features
- PowerShell

No additional database server is required.

---

# Chapter 3 - Installation

## Installing Node.js

Download the latest Long Term Support version of Node.js.

Verify installation.

```bash
node --version
npm --version
```

---

## Downloading CorePanel

Clone the repository.

```bash
git clone https://github.com/L1ghtn1ngXD/CorePanel.git
```

or download the ZIP archive from GitHub.

---

## Installing Dependencies

Open a terminal inside the project directory.

Run

```bash
npm install
```

CorePanel will automatically install all required Node.js packages listed in package.json.

---

## Linux Installation

Install required packages.

```bash
sudo apt update

sudo apt install nodejs npm
```

If QEMU support is required

```bash
sudo apt install \
libvirt-daemon-system \
libvirt-clients \
qemu-system \
qemu-utils
```

Enable libvirt.

```bash
sudo systemctl enable --now libvirtd
```

---

## Windows Installation

Install Node.js.

Open Command Prompt.

Navigate to the project directory.

Run

```cmd
npm install
```

No additional software is required for standard functionality.

---

## Verifying Installation

Start CorePanel.

```bash
node server.js
```

If everything is configured correctly you should see a message indicating that the server is listening on the configured address and port.

---

# Chapter 4 - First Launch

## Starting CorePanel

Launch the application.

```bash
node server.js
```

The server starts immediately and begins listening for incoming HTTP requests.

---

## Opening the Web Interface

Open your preferred browser.

Navigate to

```
http://SERVER-IP:PORT
```

Example

```
http://192.168.1.15:3000
```

Replace the IP address and port with your own server configuration.

---

## Logging In

After opening the web interface you will be presented with the login screen.

Enter your administrator credentials.

After successful authentication the Dashboard will be displayed.

---

## Initial Navigation

The navigation menu provides access to all available modules.

Typical layout

- Dashboard
- Console
- Files
- Task Manager
- Services
- System Information
- QEMU
- Settings

The available pages may differ depending on the operating system and installed components.

---

## First Things to Check

After logging in it is recommended to verify

- Console functionality
- File Manager access
- System Information
- Network connectivity
- Available storage
- Service management
- QEMU support (Linux)

This confirms that CorePanel has sufficient permissions to manage the server.

---

> [!TIP]
Before exposing CorePanel to the Internet, configure HTTPS and place the application behind a reverse proxy such as Nginx.

---

# Chapter 5 - Authentication

## Overview

Authentication protects CorePanel from unauthorized access.

Every user must successfully authenticate before accessing any management page or API endpoint.

The authentication system is responsible for:

- Verifying user credentials
- Creating authenticated sessions
- Protecting API endpoints
- Preventing unauthorized access
- Managing login state

---

## Login Screen

When opening CorePanel, the login page is displayed automatically.

Typical fields include:

| Field | Description |
|---------|-------------|
| Username | Administrator username |
| Password | Administrator password |
| Login | Starts authentication |

If the provided credentials are valid, CorePanel redirects the user to the Dashboard.

---

## Sessions

After successful authentication, CorePanel creates a server-side session.

The session remains active until:

- The user logs out
- The session expires
- The server is restarted (depending on configuration)

All authenticated requests automatically use the active session.

---

## Authentication Required

The following modules require authentication:

- Dashboard
- Console
- Files
- Task Manager
- Services
- System Information
- QEMU

API endpoints are also protected.

Unauthenticated requests receive an authorization error.

---

## Logging Out

Logging out immediately destroys the current session.

After logout:

- API requests become invalid
- Protected pages are no longer accessible
- Login is required again

---

> [!TIP]
Never share administrator credentials with other users.

---

# Chapter 6 - Dashboard

## Overview

The Dashboard is the first page displayed after successful login.

Its purpose is to provide quick access to every major CorePanel module.

The Dashboard is designed to minimize navigation time while presenting useful information about the server.

---

## Navigation Menu

The left navigation panel contains shortcuts to all available pages.

Typical layout:

```
Dashboard
Console
Files
Task Manager
Services
System Information
QEMU
Settings
Logout
```

Some pages may not be available depending on the operating system.

---

## Layout

The Dashboard is divided into logical sections.

Example:

```
+--------------------------------------+
| Navigation |      Dashboard          |
|            |                         |
|            | Server Information      |
|            |                         |
|            | Quick Actions           |
|            |                         |
+--------------------------------------+
```

---

## Quick Access

The Dashboard allows administrators to quickly navigate between modules.

Typical workflow:

```
Login

↓

Dashboard

↓

Console

↓

Files

↓

System Information
```

without returning to the login screen.

---

## Responsive Design

CorePanel is designed to work on different screen sizes.

The interface automatically adjusts for:

- Desktop
- Laptop
- Tablet

For the best experience, a desktop browser is recommended.

---

## Status Information

Depending on installed modules, the Dashboard may display:

- Hostname
- Operating System
- Current User
- Server Uptime
- CPU Usage
- Memory Usage
- Disk Usage

Additional widgets may be added in future versions.

---

## Refreshing Information

Most Dashboard information updates automatically.

Some modules provide their own refresh button for manual updates.

---

> [!NOTE]
Dashboard information is intended to provide a quick overview.
For detailed information, use the dedicated pages such as
System Information or Task Manager.

---

# Chapter 7 - Console

## Overview

The Console module provides an interactive terminal directly inside the web browser.

Commands entered into the Console are executed on the server.

The Console behaves similarly to a local terminal window.

---

## Supported Operating Systems

### Windows

Default shells include:

```
cmd.exe
```

or

```
powershell.exe
```

depending on the server configuration.

---

### Linux

The default shell is

```
/bin/bash
```

or another configured shell.

---

## Starting a Session

Open the **Console** page.

CorePanel automatically creates a new terminal session.

After a short delay, the shell prompt appears.

---

## Executing Commands

Commands can be entered exactly as they would in a local terminal.

Example:

Linux

```bash
ls -la
pwd
uname -a
```

Windows

```cmd
dir
systeminfo
ipconfig
```

Output appears immediately inside the browser.

---

## Terminal Resize

The terminal automatically adjusts to the browser window size.

If the browser window changes size, the terminal dimensions are updated automatically.

---

## Reconnecting

If the browser is refreshed or the network connection is interrupted, a new terminal session may be created.

Long-running commands may continue depending on the server configuration.

---

## Keyboard Support

The Console supports standard keyboard input.

Common shortcuts include:

| Shortcut | Description |
|-----------|-------------|
| Enter | Execute command |
| Ctrl+C | Interrupt current process |
| Ctrl+L | Clear terminal (Linux) |
| Arrow Up | Previous command |
| Arrow Down | Next command |
| Tab | Command completion (shell dependent) |

---

## Copy and Paste

Standard browser copy and paste operations are supported.

Large amounts of text may take a short time to appear depending on the network connection.

---

## Security

Commands executed through the Console have the same permissions as the account running CorePanel.

Be careful when executing commands that modify the operating system.

Examples include:

Linux

```bash
rm -rf
systemctl stop
chmod
```

Windows

```cmd
del
shutdown
diskpart
```

These commands can permanently modify the system.

---

> [!WARNING]
CorePanel does not prevent dangerous commands from being executed.
Always verify commands before pressing **Enter**.

---

## Recommended Usage

The Console is intended for:

- System administration
- Software installation
- Log inspection
- Network diagnostics
- File management
- Package management
- Running maintenance scripts

For graphical file operations, use the File Manager whenever possible.

---

# Chapter 8 - File Manager

## Overview

The File Manager provides direct access to the server's filesystem through the CorePanel web interface.

It allows administrators to browse directories without requiring SSH, RDP or other remote desktop software.

The File Manager is designed to be fast, responsive and easy to use.

---

## Features

The File Manager currently supports:

- Browsing directories
- Opening folders
- Displaying files
- Displaying folders
- Viewing file size
- Viewing modification date
- Viewing file permissions (Linux)
- Displaying mounted drives
- Refreshing the current directory

Future versions may include:

- File upload
- File download
- File editor
- File rename
- Copy
- Move
- Delete
- Archive extraction

---

## Windows

On Windows the File Manager automatically detects available drives.

Example

```
C:\
D:\
E:\
```

Each drive can be opened independently.

Network drives are displayed if available.

---

## Linux

Linux always starts browsing from the root directory.

```
/
```

From there any mounted filesystem can be accessed.

Examples

```
/

├── home
├── root
├── etc
├── var
├── usr
├── boot
├── opt
└── tmp
```

---

## Navigation

To open a folder simply click on its name.

To return to the previous directory use the parent directory button.

The current path is displayed at the top of the page.

Example

```
/home/admin/Documents
```

---

## Refresh

The Refresh button reloads the current directory.

Use Refresh if files were modified outside CorePanel.

---

## File Information

Every entry displays useful information.

Typical columns

| Column | Description |
|---------|-------------|
| Name | File or directory name |
| Type | File or Folder |
| Size | File size |
| Modified | Last modification date |

Future versions may display

- Owner
- Group
- Permissions
- MIME Type

---

## Symbolic Links

Linux symbolic links are displayed as normal entries.

Depending on the operating system configuration, following symbolic links may be restricted.

---

## Mounted Filesystems

Linux automatically detects mounted filesystems.

Examples

```
/

/boot

/home

/mnt/storage

/media/usb
```

---

## Recommended Usage

The File Manager is ideal for

- Viewing configuration files
- Browsing logs
- Checking available storage
- Navigating directories
- Verifying installation paths

---

> [!TIP]
For very large file operations, using SCP or SFTP may provide better performance.

---

# Chapter 9 - Task Manager

## Overview

The Task Manager displays currently running processes.

It provides an overview of active applications and operating system processes.

Unlike desktop operating systems, CorePanel only displays information and does not require a graphical environment.

---

## Process List

Every running process appears as a separate entry.

Typical columns

| Column | Description |
|---------|-------------|
| PID | Process Identifier |
| Name | Process name |
| CPU | Current CPU usage |
| Memory | Current memory usage |
| User | Process owner |
| Status | Current process state |

---

## Process Identifier (PID)

Every process has a unique Process Identifier.

Example

```
PID 1

systemd
```

or

```
PID 1438

node
```

PIDs may change after a reboot.

---

## CPU Usage

CPU usage is displayed as a percentage.

Example

```
0.3%

4.6%

32.1%
```

Higher values indicate increased processor activity.

---

## Memory Usage

Memory usage represents the amount of RAM currently allocated to the process.

Large values do not necessarily indicate a problem.

---

## Process Owner

The User column displays the account responsible for the process.

Linux example

```
root

www-data

admin
```

Windows example

```
SYSTEM

Administrator
```

---

## Refresh

The process list updates automatically.

A manual refresh button is also available.

---

## Typical Processes

Linux

```
systemd

sshd

nginx

node

bash
```

Windows

```
explorer.exe

svchost.exe

powershell.exe

cmd.exe
```

---

## Recommended Usage

Task Manager is useful for

- Monitoring CPU usage
- Monitoring memory usage
- Detecting unexpected processes
- Diagnosing high system load
- Verifying running applications

---

> [!NOTE]
CorePanel displays information provided by the operating system.
Some system processes may be hidden depending on permissions.

---

# Chapter 10 - Services

## Overview

The Services page provides access to operating system services.

CorePanel automatically detects the current operating system and uses the appropriate service manager.

---

## Windows

On Windows, CorePanel communicates with Windows Services.

Typical operations include

- Start
- Stop
- Restart
- Refresh

---

## Linux

On Linux, CorePanel uses

```
systemctl
```

through systemd.

Typical commands

```
systemctl start

systemctl stop

systemctl restart

systemctl status
```

---

## Service List

Each service displays

| Column | Description |
|---------|-------------|
| Name | Service name |
| Status | Current state |
| Startup | Startup mode |

---

## Status

Possible service states include

```
Running

Stopped

Failed

Starting

Stopping
```

---

## Refresh

Refresh reloads the current service list.

Use Refresh after manually changing service states.

---

## Non-systemd Systems

Some Linux distributions use a different init system.

Examples

- runit
- OpenRC
- s6
- SysVinit

If CorePanel detects that systemd is unavailable, the Services page displays an informational message.

Example

```
This system does not use systemd.

Service management is unavailable.

Please use your distribution's native service management commands.
```

No errors are generated.

---

## Recommended Usage

Use the Services page for

- Restarting web servers
- Starting database services
- Monitoring daemon status
- Verifying system services
- Checking failed services

---

> [!WARNING]
Restarting critical services may interrupt active users or network connections.

Always verify the service before stopping or restarting it.

---

# Chapter 11 - System Information

## Overview

The **System Information** page provides a detailed overview of the current operating system, hardware, and runtime environment.

Unlike the Dashboard, which displays only a summary, this page focuses on detailed system statistics collected directly from the operating system.

The available information may vary depending on the operating system, virtualization platform and hardware capabilities.

---

## Operating System

The following information is displayed:

| Property | Description |
|----------|-------------|
| Operating System | Full operating system name |
| Distribution | Linux distribution or Windows edition |
| Version | Installed operating system version |
| Kernel | Linux kernel version or Windows build |
| Architecture | x64, ARM64, x86, etc. |
| Hostname | System hostname |

Example

```
Operating System:
Debian GNU/Linux 13 (Trixie)

Kernel:
6.12.43-amd64

Architecture:
x64

Hostname:
server01
```

---

## Processor

CorePanel displays detailed CPU information.

Typical fields include

- Processor Model
- Physical Cores
- Logical Processors
- Current CPU Usage
- Base Frequency
- Maximum Frequency

Example

```
Processor

AMD EPYC 7543P

Physical Cores

32

Logical Processors

64

Current Usage

12%
```

---

## Memory

The Memory section displays RAM usage.

Information includes

- Total Memory
- Used Memory
- Available Memory
- Memory Usage Percentage

Example

```
Total

8 GB

Used

2.3 GB

Available

5.7 GB

Usage

29%
```

---

## Storage

Storage information includes every detected filesystem.

Typical information

- Mount Point
- Total Capacity
- Used Space
- Free Space
- Usage Percentage

Linux example

```
/

120 GB

Used

24 GB

Free

96 GB
```

Windows example

```
Drive C:

512 GB

Used

146 GB

Free

366 GB
```

---

## Network

CorePanel displays interface speed.

Example

```
Download - 24 B/s
Upload - 44 B/s
```

---

## System Uptime

System uptime indicates how long the operating system has been running since the last reboot.

Example

```
12 Days
4 Hours
18 Minutes
```

---

## CPU Temperature

If hardware sensors are available, CorePanel displays processor temperature.

Example

```
47°C
```

---

Some environments do not expose hardware sensors.

Examples include

- Virtual Dedicated Servers (VDS)
- Cloud servers
- Some virtual machines

In these cases the temperature field displays

```
Unavailable
```

instead of reporting incorrect values.

---

## Refresh

System Information automatically updates at regular intervals.

A manual Refresh button is also available.

---

> [!NOTE]
Not every operating system exposes the same hardware information.
Unavailable fields are displayed when the operating system cannot provide the requested data.

---

# Chapter 12 - QEMU

## Overview

The **QEMU** page allows administrators to monitor and control virtual machines managed by **libvirt**.

CorePanel communicates directly with the libvirt management layer.

Guest operating systems do not require additional software.

---

## Requirements

QEMU management requires

```
libvirt
virsh
qemu-system
```

The libvirt daemon must be running.

Verify using

```bash
systemctl status libvirtd
```

---

## Virtual Machine List

CorePanel automatically retrieves all registered virtual machines.

Example

```
24/7 VM

Running

2 vCPU

4096 MB

Autostart Enabled
```

If no virtual machines exist, CorePanel displays

```
No virtual machines were found.
```

---

## Available Operations

The following actions are available.

### Start

Starts a powered-off virtual machine.

---

### Shutdown

Requests a graceful shutdown.

Equivalent to pressing the power button on a physical computer.

---

### Reboot

Restarts the guest operating system.

---

### Reset

Immediately resets the virtual machine.

Comparable to pressing the reset button on a physical computer.

---

### Suspend

Pauses execution while preserving memory contents.

---

### Resume

Continues execution after suspension.

---

### Force Off

Immediately powers off the virtual machine.

No shutdown request is sent to the guest.

---

> [!WARNING]
Force Off may cause data loss if applications inside the guest have unsaved work.

---

## Autostart

Autostart determines whether a virtual machine starts automatically when libvirt starts.

Enabled

```
✓
```

Disabled

```
✗
```

---

## Refresh

The Refresh button reloads the virtual machine list.

CorePanel also performs automatic background refreshes.

---

## Supported Hypervisor

Current versions support

```
QEMU/KVM through libvirt
```

Additional virtualization technologies may be supported in future releases.

---

# Chapter 13 - Configuration

## Overview

CorePanel is designed to require minimal configuration before use.

Most settings are detected automatically during startup.

---

## Server Address

CorePanel listens on the configured HTTP address.

Example

```
http://0.0.0.0:3000
```

When accessed remotely

```
http://SERVER-IP:3000
```

---

## Running as a Service

Linux administrators may create a systemd service.

Example

```bash
systemctl enable corepanel
systemctl start corepanel
```

Windows administrators may use services such as

- NSSM
- WinSW

to automatically start CorePanel after boot.

---

## Firewall

Ensure the configured port is allowed.

Linux example

```bash
ufw allow 3000/tcp
```

Windows

Allow the application through Windows Defender Firewall.

---

## Reverse Proxy

Using a reverse proxy is strongly recommended.

Supported reverse proxies include

- Nginx
- Apache
- Caddy

Reverse proxies simplify HTTPS configuration and improve security.

A complete Nginx example is provided later in this documentation.

---

## Backups

Regular backups are recommended.

Important files include

- Configuration files
- Authentication database
- User settings
- Application data

---

## Updating CorePanel

To update CorePanel

1. Stop the application.
2. Download the latest release.
3. Replace the application files.
4. Run

```bash
npm install
```

if dependencies have changed.

5. Restart CorePanel.

---

## Best Practices

For production environments it is recommended to

- Keep Node.js updated.
- Keep the operating system updated.
- Enable HTTPS.
- Use a reverse proxy.
- Restrict public access.
- Create regular backups.
- Monitor system logs.

---

# Chapter 14 - API Reference

## Overview

CorePanel exposes a REST-style HTTP API used by the web interface.

Every page inside CorePanel communicates with the backend through these endpoints.

Unless otherwise specified, all API responses are returned in JSON format.

---

## Authentication

Most endpoints require authentication.

Unauthenticated requests return

```http
401 Unauthorized
```

Example

```json
{
    "success": false,
    "message": "Authentication required."
}
```

---

## Base URL

Example

```
http://SERVER-IP:3000/api/
```

---

## Response Format

Successful requests

```json
{
    "success": true
}
```

Failed requests

```json
{
    "success": false,
    "message": "Description of the error."
}
```

---

# Authentication Endpoints

---

## POST /api/login

Authenticates a user.

### Request

```json
{
    "username": "admin",
    "password": "password"
}
```

### Successful Response

```json
{
    "success": true
}
```

### Error Response

```json
{
    "success": false,
    "message": "Invalid username or password."
}
```

---

## POST /api/logout

Logs out the current user.

### Response

```json
{
    "success": true
}
```

---

## GET /api/session

Returns information about the current session.

### Example

```json
{
    "authenticated": true,
    "username": "admin"
}
```

---

# Dashboard

---

## GET /api/dashboard

Returns information used by the Dashboard.

Example

```json
{
    "hostname": "server01",
    "os": "Debian GNU/Linux 13",
    "uptime": 42891,
    "cpu": 17,
    "memory": 41
}
```

---

# Console

---

## POST /api/terminal/create

Creates a new terminal session.

### Response

```json
{
    "success": true,
    "terminalId": "b92f..."
}
```

---

## WebSocket

Terminal communication uses WebSocket.

The browser sends keyboard input.

The server returns terminal output.

---

# File Manager

---

## GET /api/files

Returns directory contents.

### Parameters

| Parameter | Description |
|-----------|-------------|
| path | Directory path |

Example

```
GET /api/files?path=/home
```

---

### Response

```json
{
    "success": true,
    "entries": [
        {
            "name": "Documents",
            "type": "directory"
        },
        {
            "name": "notes.txt",
            "type": "file"
        }
    ]
}
```

---

## GET /api/drives

Windows

Returns all detected drives.

Example

```json
[
    "C:",
    "D:"
]
```

Linux

Returns

```json
[
    "/"
]
```

---

# Task Manager

---

## GET /api/processes

Returns all running processes.

Example

```json
{
    "success": true,
    "processes": [
        {
            "pid": 1438,
            "name": "node",
            "cpu": 2.1,
            "memory": 84
        }
    ]
}
```

---

## POST /api/processes/:pid/kill

Terminates a process.

Example

```
POST /api/processes/1438/kill
```

---

# Services

---

## GET /api/services

Returns detected services.

Example

```json
{
    "success": true,
    "services": [
        {
            "name": "nginx",
            "status": "running"
        }
    ]
}
```

---

## POST /api/services/:name/start

Starts a service.

---

## POST /api/services/:name/stop

Stops a service.

---

## POST /api/services/:name/restart

Restarts a service.

---

# System Information

---

## GET /api/system/info

Returns complete operating system information.

Example

```json
{
    "hostname": "server01",
    "os": "Debian GNU/Linux 13",
    "kernel": "6.12",
    "architecture": "x64",
    "cpu": {
        "model": "AMD EPYC",
        "usage": 12
    },
    "memory": {
        "total": 8589934592,
        "used": 3120562176
    }
}
```

---

# QEMU

---

## GET /api/qemu/status

Returns QEMU support information.

Example

```json
{
    "supported": true,
    "uri": "qemu:///system"
}
```

---

## GET /api/qemu/machines

Returns all registered virtual machines.

Example

```json
{
    "success": true,
    "machines": [
        {
            "name": "DisplayVM",
            "state": "Running",
            "memory": 4294967296,
            "vcpus": 2
        }
    ]
}
```

---

## POST /api/qemu/machines/:name/start

Starts a virtual machine.

---

## POST /api/qemu/machines/:name/shutdown

Gracefully shuts down a virtual machine.

---

## POST /api/qemu/machines/:name/reboot

Reboots a virtual machine.

---

## POST /api/qemu/machines/:name/reset

Resets a virtual machine.

---

## POST /api/qemu/machines/:name/suspend

Suspends execution.

---

## POST /api/qemu/machines/:name/resume

Resumes execution.

---

## POST /api/qemu/machines/:name/destroy

Immediately powers off the virtual machine.

---

## POST /api/qemu/machines/:name/autostart

Changes the autostart configuration.

Request

```json
{
    "enabled": true
}
```

---

# HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

---

# Error Handling

Whenever possible CorePanel returns descriptive error messages.

Example

```json
{
    "success": false,
    "message": "Virtual machine does not exist."
}
```

---

## API Versioning

Current API version

```
v1
```

Future versions may introduce additional endpoints while maintaining backward compatibility whenever possible.

---

## Best Practices

- Always authenticate before sending requests.
- Validate user input before calling the API.
- Check the `success` field in every response.
- Handle network errors gracefully.
- Avoid excessive polling where possible.

---

# Chapter 15 - Reverse Proxy

## Overview

Although CorePanel can be accessed directly through its built-in HTTP server, using a reverse proxy is strongly recommended for production environments.

A reverse proxy provides several advantages:

- HTTPS support
- Better security
- HTTP/2 and HTTP/3 support
- Easier certificate management
- Better compatibility with firewalls
- Ability to host multiple web applications on one server

CorePanel is compatible with:

- Nginx
- Apache HTTP Server
- Caddy

---

## Nginx Example

The following configuration forwards all requests to CorePanel running on port **3000**.

```nginx
server {
    listen 80;
    server_name panel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;

        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Reload Nginx.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Apache Example

Enable required modules.

```bash
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
```

Virtual host example

```apache
<VirtualHost *:80>

ServerName panel.example.com

ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/

</VirtualHost>
```

Restart Apache.

---

## Caddy Example

```
panel.example.com {

    reverse_proxy localhost:3000

}
```

---

# Chapter 16 - HTTPS

## Why HTTPS?

HTTPS encrypts communication between the browser and CorePanel.

Without HTTPS:

- Passwords can be intercepted
- Sessions can be stolen
- Traffic can be modified

HTTPS is strongly recommended whenever CorePanel is accessible outside a trusted local network.

---

## Let's Encrypt

Install Certbot.

Debian

```bash
sudo apt install certbot python3-certbot-nginx
```

Obtain a certificate.

```bash
sudo certbot --nginx
```

Certificates are renewed automatically by Certbot.

---

## Self-Signed Certificates

Self-signed certificates may be used for development or internal testing.

Modern browsers display a warning because the certificate is not issued by a trusted Certificate Authority.

---

# Chapter 17 - Security Recommendations

## General Recommendations

Always follow basic security practices.

Recommended:

- Use HTTPS.
- Keep CorePanel updated.
- Keep Node.js updated.
- Keep the operating system updated.
- Restrict access using a firewall.
- Create regular backups.
- Use strong administrator passwords.

---

## Administrator Account

Choose a password that

- contains uppercase letters
- contains lowercase letters
- contains numbers
- contains symbols
- is at least 16 characters long

Avoid dictionary words.

---

## Firewall

Only expose required ports.

Example

```
22
80
443
```

Avoid exposing development ports directly to the Internet.

---

## Running as Root

Running CorePanel as root is generally not recommended unless required by your environment.

Whenever possible, create a dedicated service account.

---

## Reverse Proxy

A reverse proxy provides an additional security layer.

Benefits include

- HTTPS termination
- Rate limiting
- IP filtering
- Logging
- Compression

---

## Public Internet

If CorePanel is publicly accessible

- Enable HTTPS
- Monitor logs
- Update regularly
- Use strong passwords

---

# Chapter 18 - Troubleshooting

## CorePanel Does Not Start

Possible causes

- Node.js is not installed
- Missing dependencies
- Incorrect permissions

Verify

```bash
node --version
npm install
```

---

## Cannot Log In

Possible causes

- Incorrect username
- Incorrect password
- Corrupted authentication database

Verify credentials.

---

## Console Does Not Open

Possible causes

- Missing shell
- Missing permissions
- Terminal backend failed

Restart CorePanel.

---

## File Manager Is Empty

Possible causes

- Invalid path
- Permission denied
- Filesystem unavailable

Verify operating system permissions.

---

## Services Page Does Not Work

Linux

If the system does not use systemd, CorePanel cannot manage services through systemctl.

Use your distribution's native init system instead.

---

## CPU Temperature Is Unavailable

Possible causes

- Virtual machine
- Virtual Dedicated Server (VDS)
- Missing hardware sensors
- Unsupported hardware

This is expected behavior on many virtual environments.

---

## QEMU Shows No Virtual Machines

Verify

```bash
virsh list --all
```

If no virtual machines are listed, CorePanel will also display an empty list.

---

## API Returns 401

Authentication has expired.

Log in again.

---

## Browser Cannot Connect

Verify

- CorePanel is running
- Correct IP address
- Correct port
- Firewall configuration
- Reverse proxy configuration

---

# Chapter 19 - Frequently Asked Questions

## Does CorePanel require a desktop environment?

No.

CorePanel works perfectly on headless servers.

---

## Does CorePanel support Windows?

Yes.

Windows 10 and Windows 11 are supported.

---

## Does CorePanel support Linux?

Yes.

Current versions officially support Debian Linux.

---

## Does CorePanel require a database?

No.

An external database server is not required for standard installations.

---

## Can I use CorePanel on a Virtual Dedicated Server (VDS)?

Yes.

Some hardware information such as CPU temperature may not be available because the virtualization platform does not expose hardware sensors.

---

## Can I manage QEMU virtual machines?

Yes.

When libvirt and QEMU are installed, CorePanel can manage registered virtual machines.

---

## Can I use CorePanel through HTTPS?

Yes.

Using HTTPS together with a reverse proxy is strongly recommended.

---

## Is CorePanel open source?

Refer to the project's GitHub repository for licensing information.

---

# Appendix A - Keyboard Shortcuts

| Shortcut | Description |
|----------|-------------|
| Enter | Execute command |
| Ctrl + C | Interrupt current process |
| Arrow Up | Previous command |
| Arrow Down | Next command |
| Tab | Auto-complete |

---

# Appendix B - Useful Linux Commands

```bash
ls -la
pwd
df -h
free -h
uptime
uname -a
systemctl status
journalctl
```

---

# Appendix C - Useful Windows Commands

```cmd
dir
systeminfo
tasklist
ipconfig
ping
netstat
hostname
```

---

# Appendix D - Glossary

| Term | Description |
|-------|-------------|
| API | Application Programming Interface |
| CPU | Central Processing Unit |
| RAM | Random Access Memory |
| PID | Process Identifier |
| QEMU | Open-source machine emulator and virtualizer |
| KVM | Kernel-based Virtual Machine |
| libvirt | Virtualization management library |
| daemon | Background service running on Linux |
| service | Background process managed by the operating system |
| reverse proxy | Server that forwards requests to another server |

---

# End of Documentation

Thank you for using CorePanel.

For the latest releases, documentation updates and source code, visit:

https://github.com/L1ghtn1ngXD/CorePanel

---

CorePanel Documentation

Version 1.0

Copyright © 2026 V0ltage

Licensed under the MIT License.

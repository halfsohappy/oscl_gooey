# annieOSC

**A lightweight, fully featured GUI for sending, monitoring, and receiving [Open Sound Control (OSC)](https://opensoundcontrol.stanford.edu) messages.**

Built with Python. Runs in your browser. One command to start.  
Optimized for [TheaterGWD / annieData](https://github.com/halfsohappy/TheaterGWD) sensor devices.

---

## Features

| Feature | Description |
|---------|-------------|
| **Send** | Compose and fire OSC messages with typed arguments (int, float, string). Send once or loop at an interval. Batch-send from JSON. |
| **Receive** | Listen on any UDP port. Filter by address pattern (include or exclude). Real-time log with auto-scroll. |
| **Bridge** | Forward messages between ports/hosts with optional filtering — great for routing sensor data to multiple destinations. |
| **TheaterGWD Presets** | One-click commands for annieData devices: blackout, restore, patch start/stop, create message, save/load config, and more. |
| **Monitor** | Unified message log across all directions with live message rate, text filter, and color-coded tags. |
| **Real-time** | WebSocket-powered — messages appear instantly as they arrive. |
| **Responsive** | Works on desktop, tablet, and mobile. |
| **Standalone** | Pure Python — no build tools, no npm, no Electron. Just `pip install` and run. |

---

## Quick Start

```bash
git clone https://github.com/halfsohappy/annieOSC.git
cd annieOSC
bash install.sh
```

That's it — one command after cloning.  The installer checks for Python, creates a virtual environment, installs dependencies, and launches the GUI in your browser.

You can also pass options through to the server:

```bash
bash install.sh --port 8080
bash install.sh --host 0.0.0.0 --no-browser
```

The GUI opens automatically at **http://127.0.0.1:5000**.

---

## Full Install Guide

### What You Need

- **Python 3.8 or newer** — that's it!

Check if you already have it:

```bash
python3 --version
```

If not, install it:

| Platform | Install Command |
|----------|----------------|
| **macOS** | `brew install python` or download from [python.org](https://www.python.org/downloads/) |
| **Ubuntu / Debian / Raspberry Pi** | `sudo apt update && sudo apt install python3 python3-pip python3-venv` |
| **Fedora / RHEL** | `sudo dnf install python3 python3-pip` |
| **Windows** | Download from [python.org](https://www.python.org/downloads/) — **check "Add Python to PATH"** during install |

---

### Install on macOS

```bash
# 1. Install Python (skip if you already have it)
brew install python

# 2. Clone the project
git clone https://github.com/halfsohappy/annieOSC.git
cd annieOSC

# 3. Run the installer (creates venv, installs deps, launches the GUI)
bash install.sh
```

### Install on Ubuntu / Debian / Raspberry Pi

```bash
# 1. Install Python and pip
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 2. Clone the project
git clone https://github.com/halfsohappy/annieOSC.git
cd annieOSC

# 3. Run the installer
bash install.sh
```

### Install on Windows

1. Download and install Python from [python.org](https://www.python.org/downloads/)
   - ✅ **Check "Add Python to PATH"** during installation
2. Open **Command Prompt** or **PowerShell**:

```powershell
# 1. Clone the project
git clone https://github.com/halfsohappy/annieOSC.git
cd annieOSC

# 2. Run the installer (uses Git Bash or WSL)
bash install.sh
```

If you don't have `bash` on Windows, you can run manually:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

---

### Running Standalone (No Virtual Environment)

If you prefer a simpler setup without a virtual environment:

```bash
git clone https://github.com/halfsohappy/annieOSC.git
cd annieOSC
pip install -r requirements.txt
python run.py
```

That's 4 commands. You're done.

---

### Running as a Background Service

To run annieOSC as a persistent background service (e.g., on a Raspberry Pi or show control machine):

**Linux / macOS:**
```bash
# Run in the background, accessible from any device on your network
nohup python run.py --host 0.0.0.0 --no-browser > annieosc.log 2>&1 &

# View the log
tail -f annieosc.log

# Stop it
# Find the process ID and kill it:
ps aux | grep run.py
kill <PID>
```

**Using systemd (Linux — auto-start on boot):**

Create `/etc/systemd/system/annieosc.service`:
```ini
[Unit]
Description=annieOSC — OSC Control GUI
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/oscl_gooey
ExecStart=/path/to/oscl_gooey/venv/bin/python run.py --host 0.0.0.0 --no-browser
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable annieosc
sudo systemctl start annieosc
sudo systemctl status annieosc
```

---

### Building a Standalone Executable (Optional)

You can package annieOSC into a single executable file using [PyInstaller](https://pyinstaller.org/) — no Python installation required on the target machine.

```bash
# Install PyInstaller
pip install pyinstaller

# Build the executable
pyinstaller --onefile \
  --add-data "app/templates:app/templates" \
  --add-data "app/static:app/static" \
  --name annieOSC \
  run.py

# The executable is at dist/annieOSC (or dist/annieOSC.exe on Windows)
./dist/annieOSC
```

The resulting binary is fully standalone — copy it to any machine and run.

---

## Command-Line Options

```
python run.py [OPTIONS]

Options:
  --port PORT       Web server port (default: 5000)
  --host HOST       Web server host (default: 127.0.0.1)
  --no-browser      Don't auto-open browser on startup
  --debug           Enable debug mode
```

**Examples:**

```bash
# Default — opens browser automatically
python run.py

# Use a different port
python run.py --port 8080

# Allow access from other devices on your network
python run.py --host 0.0.0.0

# Headless mode (no browser, great for servers)
python run.py --host 0.0.0.0 --no-browser
```

---

## Usage Guide

### Send Tab

Send individual OSC messages or batch messages from JSON.

| Field | Description |
|-------|-------------|
| **Host** | Target IP address (e.g., `127.0.0.1`, `192.168.1.50`) |
| **Port** | Target UDP port (1–65535) |
| **OSC Address** | Message path — must start with `/` (e.g., `/sensor/x`) |
| **Arguments** | Space-separated values: integers (`42`), floats (`3.14`), strings (`hello`) |
| **Interval** | Repeat interval in milliseconds for continuous sending |

**Buttons:**
- **Send Once** — fire a single message
- **Start Repeat** — send continuously at the specified interval
- **Stop** — stop repeated sending

**JSON Batch Send** — paste a JSON array:
```json
[
  { "address": "/light/dimmer", "args": [255] },
  { "address": "/light/color", "args": [1.0, 0.5, 0.0] },
  { "address": "/status", "args": ["ready"] }
]
```

### Receive Tab

Listen for incoming OSC messages on a specified port.

| Field | Description |
|-------|-------------|
| **Listen Port** | UDP port to listen on (default: 9000) |
| **Filter** | `sensor` → show only matching addresses. `-debug` → hide matching addresses. |

Multiple listeners on different ports can run simultaneously.

### Bridge Tab

Forward OSC messages between endpoints with optional filtering.

| Field | Description |
|-------|-------------|
| **Listen Port** | Port to receive messages on |
| **Output Host** | Destination IP to forward to |
| **Output Port** | Destination port |
| **Filter** | Same include/exclude filtering as Receive |

### TheaterGWD Tab

Pre-configured controls for [TheaterGWD / annieData](https://github.com/halfsohappy/TheaterGWD) sensor devices.

**Device Settings:**
| Field | Description |
|-------|-------------|
| **Device Host** | IP address of your annieData device |
| **Device Port** | OSC port (default: 8000) |
| **Device Name** | Identifier used in OSC addresses (default: `bart`) |

**Quick Commands:**
| Button | OSC Address | What It Does |
|--------|-------------|-------------|
| ⬛ Blackout | `/annieData/{device}/blackout` | Stop all sensor output |
| 🔆 Restore | `/annieData/{device}/restore` | Resume sensor output |
| 💾 Save | `/annieData/{device}/save` | Save config to NVS |
| 📂 Load | `/annieData/{device}/load` | Load config from NVS |
| 📊 Status | `/annieData/{device}/status/config` | Request device config |
| 🗑️ NVS Clear | `/annieData/{device}/nvs/clear` | Clear NVS storage |
| 📋 Messages | `/annieData/{device}/list/msgs` | List configured messages |
| 📋 Patches | `/annieData/{device}/list/patches` | List configured patches |
| 📋 All | `/annieData/{device}/list/all` | List everything |

**Patch Control** — start/stop named patches (groups of sensor messages).

**Create Message** — configure a sensor data stream:
- Choose a sensor value (`accelX`, `gyroY`, `baro`, `eulerZ`, etc.)
- Set the target IP, port, and OSC address where data should be sent

**Config String Builder** — visually compose config payloads with individual fields for every key that [TheaterGWD](https://github.com/halfsohappy/TheaterGWD) accepts:

| Key | Description |
|-----|-------------|
| `value` | Which sensor to read (accelX, gyroY, baro, etc.) |
| `ip` | Destination IP address |
| `port` | Destination port number |
| `adr` | OSC address path (aliases: addr, address) |
| `low` | Output range minimum (alias: min) |
| `high` | Output range maximum (alias: max) |
| `patch` | Assign message to a patch |
| `period` | Send interval in ms (direct command only) |

The builder shows a live preview of the config string and lets you either send it as a `direct` command or create a named message.

**Keywords & Definitions** — searchable reference for all TheaterGWD commands, config keys, and sensor value names with plain-language descriptions.

**Device Reply Listener** — listen for `/reply/{device}/...` responses.

### Monitor Tab

Full message log across all directions (send/receive/bridge).

- **Auto-scroll** — keeps the log at the latest message
- **Filter** — real-time text filter on message addresses
- **Stats** — live message count and messages-per-second rate
- **Clear** — reset the log

---

## Project Structure

```
annieOSC/
├── run.py                  # Entry point — starts the web server
├── install.sh              # One-command installer (venv + deps + launch)
├── requirements.txt        # Python dependencies (3 packages)
├── app/
│   ├── __init__.py
│   ├── main.py             # Flask routes, API endpoints, SocketIO events
│   ├── osc_handler.py      # OSC engine: send, receive, bridge, monitor
│   ├── templates/
│   │   └── index.html      # Single-page GUI
│   └── static/
│       ├── favicon.svg     # Browser tab icon (Annabel Portfolio style)
│       ├── css/
│       │   └── style.css   # Stylesheet (Annabel Portfolio design)
│       └── js/
│           ├── app.js      # Frontend logic & WebSocket
│           └── socket.io.min.js  # Bundled Socket.IO client
├── LICENSE
└── README.md
```

**Tech Stack:**
| Component | Technology |
|-----------|-----------|
| Backend | Python 3 + Flask |
| Real-time | Flask-SocketIO (WebSocket) |
| OSC | python-osc |
| Frontend | Vanilla HTML / CSS / JS (no build step) |

**Dependencies** (just 3 packages):
- `flask` — web server
- `flask-socketio` — WebSocket support
- `python-osc` — OSC protocol

---

## Troubleshooting

### Port already in use

```
OSError: [Errno 98] Address already in use
```

Another process is using that port. Use a different one:
```bash
python run.py --port 8080
```

### Can't receive messages from another device

1. Make sure your firewall allows incoming UDP on the listen port
2. The sending device should target your machine's actual IP, not `127.0.0.1`
3. Run with `--host 0.0.0.0` to accept connections from other devices

### Messages not showing up

- Check that the listener is active (green dot in the Active Listeners list)
- Check your filter — it might be hiding messages
- Verify the sending device targets the correct IP and port

### Browser doesn't open automatically

Use the URL printed in the terminal, or run without `--no-browser`.

---

## License

[MIT License](LICENSE)

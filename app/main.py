"""Flask application with SocketIO for real-time OSC communication GUI."""

import json
import re

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO

from .osc_handler import OSCEngine

app = Flask(__name__)
app.config["SECRET_KEY"] = "annieosc-secret"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
engine = OSCEngine(socketio)

# --- Validation helpers ---

_IP_RE = re.compile(
    r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$"
)


def _resolve_host(host):
    h = host.strip()
    if h.lower() == "localhost":
        return "127.0.0.1"
    return h


def _valid_host(host):
    h = _resolve_host(host)
    return bool(_IP_RE.match(h))


def _valid_port(port):
    try:
        p = int(port)
        return 1 <= p <= 65535
    except (ValueError, TypeError):
        return False


def _valid_address(addr):
    return isinstance(addr, str) and addr.startswith("/")


def _error(msg, code=400):
    return jsonify({"status": "error", "message": msg}), code


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/send", methods=["POST"])
def api_send():
    data = request.get_json(silent=True) or {}
    host = data.get("host", "").strip()
    port = data.get("port", "")
    address = data.get("address", "").strip()
    args = data.get("args")

    if not host:
        return _error("Host is required")
    if not _valid_host(host):
        return _error("Invalid host IP address")
    if not _valid_port(port):
        return _error("Port must be 1-65535")
    if not _valid_address(address):
        return _error("OSC address must start with /")

    result = engine.send_message(_resolve_host(host), int(port), address, args)
    return jsonify(result)


@app.route("/api/send/repeat", methods=["POST"])
def api_send_repeat():
    data = request.get_json(silent=True) or {}
    host = data.get("host", "").strip()
    port = data.get("port", "")
    address = data.get("address", "").strip()
    args = data.get("args")
    interval = data.get("interval", 1000)
    send_id = data.get("id", "default")

    if not host:
        return _error("Host is required")
    if not _valid_host(host):
        return _error("Invalid host IP address")
    if not _valid_port(port):
        return _error("Port must be 1-65535")
    if not _valid_address(address):
        return _error("OSC address must start with /")

    try:
        interval = max(10, int(interval))
    except (ValueError, TypeError):
        return _error("Invalid interval")

    result = engine.start_repeated_send(
        send_id, _resolve_host(host), int(port), address, args, interval)
    return jsonify(result)


@app.route("/api/send/stop", methods=["POST"])
def api_send_stop():
    data = request.get_json(silent=True) or {}
    send_id = data.get("id", "default")
    result = engine.stop_repeated_send(send_id)
    return jsonify(result)


@app.route("/api/send/json", methods=["POST"])
def api_send_json():
    data = request.get_json(silent=True) or {}
    host = data.get("host", "").strip()
    port = data.get("port", "")
    messages = data.get("messages", [])
    interval = data.get("interval", 0)

    if not host:
        return _error("Host is required")
    if not _valid_host(host):
        return _error("Invalid host IP address")
    if not _valid_port(port):
        return _error("Port must be 1-65535")
    if not isinstance(messages, list) or not messages:
        return _error("Messages must be a non-empty array")

    result = engine.send_json_messages(
        _resolve_host(host), int(port), messages, int(interval))
    return jsonify(result)


@app.route("/api/recv/start", methods=["POST"])
def api_recv_start():
    data = request.get_json(silent=True) or {}
    port = data.get("port", 9000)
    filter_str = data.get("filter", "")
    recv_id = data.get("id", f"recv-{port}")

    if not _valid_port(port):
        return _error("Port must be 1-65535")

    result = engine.start_receiver(recv_id, int(port), filter_str)
    return jsonify(result)


@app.route("/api/recv/stop", methods=["POST"])
def api_recv_stop():
    data = request.get_json(silent=True) or {}
    recv_id = data.get("id", "")
    if not recv_id:
        return _error("Receiver id is required")
    result = engine.stop_receiver(recv_id)
    return jsonify(result)


@app.route("/api/bridge/start", methods=["POST"])
def api_bridge_start():
    data = request.get_json(silent=True) or {}
    in_port = data.get("in_port", "")
    out_host = data.get("out_host", "").strip()
    out_port = data.get("out_port", "")
    filter_str = data.get("filter", "")
    bridge_id = data.get("id", f"bridge-{in_port}-{out_port}")

    if not _valid_port(in_port):
        return _error("Input port must be 1-65535")
    if not out_host:
        return _error("Output host is required")
    if not _valid_host(out_host):
        return _error("Invalid output host IP address")
    if not _valid_port(out_port):
        return _error("Output port must be 1-65535")

    result = engine.start_bridge(
        bridge_id, int(in_port), _resolve_host(out_host),
        int(out_port), filter_str)
    return jsonify(result)


@app.route("/api/bridge/stop", methods=["POST"])
def api_bridge_stop():
    data = request.get_json(silent=True) or {}
    bridge_id = data.get("id", "")
    if not bridge_id:
        return _error("Bridge id is required")
    result = engine.stop_bridge(bridge_id)
    return jsonify(result)


@app.route("/api/log", methods=["GET"])
def api_log():
    return jsonify({"status": "ok", "log": engine.get_log()})


@app.route("/api/log/clear", methods=["POST"])
def api_log_clear():
    return jsonify(engine.clear_log())


@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({"status": "ok", **engine.get_status()})


@app.route("/api/stop-all", methods=["POST"])
def api_stop_all():
    return jsonify(engine.stop_all())


# --- SocketIO events ---

@socketio.on("connect")
def handle_connect():
    socketio.emit("status", engine.get_status())


@socketio.on("ping_server")
def handle_ping():
    socketio.emit("pong_server", {"status": "ok"})


# --- TheaterGWD presets ---

THEATER_GWD_PRESETS = {
    "sensor_values": [
        "accelX", "accelY", "accelZ", "accelLength",
        "gyroX", "gyroY", "gyroZ", "gyroLength",
        "baro",
        "eulerX", "eulerY", "eulerZ",
    ],
    "commands": {
        "create_message": "/annieData/{device}/msg/{name}",
        "create_patch": "/annieData/{device}/patch/{name}",
        "start_patch": "/annieData/{device}/patch/{name}/start",
        "stop_patch": "/annieData/{device}/patch/{name}/stop",
        "delete_msg": "/annieData/{device}/msg/{name}/delete",
        "enable_msg": "/annieData/{device}/msg/{name}/enable",
        "disable_msg": "/annieData/{device}/msg/{name}/disable",
        "info_msg": "/annieData/{device}/msg/{name}/info",
        "delete_patch": "/annieData/{device}/patch/{name}/delete",
        "add_msg": "/annieData/{device}/patch/{name}/addMsg",
        "remove_msg": "/annieData/{device}/patch/{name}/removeMsg",
        "patch_period": "/annieData/{device}/patch/{name}/period",
        "patch_override": "/annieData/{device}/patch/{name}/override",
        "patch_adr_mode": "/annieData/{device}/patch/{name}/adrMode",
        "patch_set_all": "/annieData/{device}/patch/{name}/setAll",
        "patch_solo": "/annieData/{device}/patch/{name}/solo",
        "patch_unsolo": "/annieData/{device}/patch/{name}/unsolo",
        "patch_enable_all": "/annieData/{device}/patch/{name}/enableAll",
        "info_patch": "/annieData/{device}/patch/{name}/info",
        "clone_msg": "/annieData/{device}/clone/msg",
        "clone_patch": "/annieData/{device}/clone/patch",
        "rename_msg": "/annieData/{device}/rename/msg",
        "rename_patch": "/annieData/{device}/rename/patch",
        "move_msg": "/annieData/{device}/move",
        "list_messages": "/annieData/{device}/list/msgs",
        "list_patches": "/annieData/{device}/list/patches",
        "list_all": "/annieData/{device}/list/all",
        "blackout": "/annieData/{device}/blackout",
        "restore": "/annieData/{device}/restore",
        "status_config": "/annieData/{device}/status/config",
        "status_level": "/annieData/{device}/status/level",
        "save": "/annieData/{device}/save",
        "save_msg": "/annieData/{device}/save/msg",
        "save_patch": "/annieData/{device}/save/patch",
        "load": "/annieData/{device}/load",
        "nvs_clear": "/annieData/{device}/nvs/clear",
        "direct": "/annieData/{device}/direct/{name}",
    },
    "defaults": {
        "port": 8000,
        "device_name": "bart",
    },
    "config_keys": {
        "value": "Which sensor to read (e.g. accelX, gyroY, baro). See sensor values list.",
        "ip": "Destination IP address where sensor data is sent.",
        "port": "Destination UDP port number.",
        "adr": "OSC address path at the destination (e.g. /fader/1). Aliases: addr, address.",
        "low": "Output range minimum — raw sensor value is scaled from 0 to this. Alias: min.",
        "high": "Output range maximum — raw sensor value is scaled to this at 1. Alias: max.",
        "patch": "Name of a patch to assign this message to.",
        "period": "Send interval in milliseconds (only for direct command). e.g. period:50 = 20 Hz.",
    },
    "keywords": {
        "blackout": "Stop all patches immediately — all sensor output halts.",
        "restore": "Restart all patches that were running before blackout.",
        "save": "Persist all messages and patches to NVS (non-volatile storage) so they survive reboot.",
        "load": "Reload all messages and patches from NVS.",
        "nvs/clear": "Erase all saved OSC data from NVS — factory reset for OSC config.",
        "msg": "A named message — maps a sensor value to a target IP, port, and OSC address.",
        "patch": "A named group of messages that can be started or stopped together.",
        "direct": "One-step command: creates msg + patch, links them, and starts sending immediately.",
        "start": "Begin streaming all messages belonging to a patch.",
        "stop": "Stop streaming all messages belonging to a patch.",
        "delete": "Remove a message or patch from the device registry.",
        "enable": "Enable a previously disabled message so it sends again.",
        "disable": "Mute a message — it stays registered but does not send.",
        "info": "Request the parameters of a specific message or patch.",
        "addMsg": "Add one or more existing messages to a patch (comma-separated names).",
        "removeMsg": "Remove a message from a patch.",
        "period": "Set how often a patch sends its messages, in milliseconds.",
        "override": "Set which fields (ip, port, adr, low, high) a patch forces on its messages.",
        "adrMode": "Set how the patch composes OSC addresses for its messages.",
        "setAll": "Apply a config string to every message in a patch at once.",
        "solo": "Enable one message in a patch, mute all others.",
        "unsolo": "Unmute all messages in a patch after a solo.",
        "enableAll": "Enable all messages in a patch.",
        "clone": "Copy a message or patch to a new name (payload: srcName, destName).",
        "rename": "Rename a message or patch (payload: oldName, newName).",
        "move": "Move a message from one patch to another (payload: msgName, patchName).",
        "list": "Request the device to list its configured messages, patches, or both. Add 'verbose' for detail.",
        "status/config": "Set where the device sends status/reply messages (payload is a config string).",
        "status/level": "Set minimum status level: error, warn, info, or debug.",
        "save/msg": "Save one specific message to NVS (payload: message name).",
        "save/patch": "Save one specific patch to NVS (payload: patch name).",
        "accelX": "Accelerometer X-axis — tilt left/right.",
        "accelY": "Accelerometer Y-axis — tilt forward/back.",
        "accelZ": "Accelerometer Z-axis — vertical acceleration.",
        "accelLength": "Total acceleration magnitude (combined X, Y, Z).",
        "gyroX": "Gyroscope X-axis — rotational velocity around X.",
        "gyroY": "Gyroscope Y-axis — rotational velocity around Y.",
        "gyroZ": "Gyroscope Z-axis — rotational velocity around Z.",
        "gyroLength": "Total rotational velocity magnitude (combined X, Y, Z).",
        "baro": "Barometric pressure sensor — altitude / air pressure changes.",
        "eulerX": "Euler angle X (roll) — orientation around X-axis in degrees.",
        "eulerY": "Euler angle Y (pitch) — orientation around Y-axis in degrees.",
        "eulerZ": "Euler angle Z (yaw) — orientation around Z-axis in degrees.",
    },
}


@app.route("/api/presets/theater-gwd", methods=["GET"])
def api_theater_gwd_presets():
    return jsonify({"status": "ok", "presets": THEATER_GWD_PRESETS})


def create_app():
    """Create and return the Flask app."""
    return app, socketio

"""Flask application with SocketIO for real-time OSC communication GUI."""

import json
import re

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO

from .osc_handler import OSCEngine

app = Flask(__name__)
app.config["SECRET_KEY"] = "oscl-gooey-secret"
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
        "list_messages": "/annieData/{device}/list/msgs",
        "list_patches": "/annieData/{device}/list/patches",
        "list_all": "/annieData/{device}/list/all",
        "blackout": "/annieData/{device}/blackout",
        "restore": "/annieData/{device}/restore",
        "status_config": "/annieData/{device}/status/config",
        "status_level": "/annieData/{device}/status/level",
        "save": "/annieData/{device}/save",
        "load": "/annieData/{device}/load",
        "nvs_clear": "/annieData/{device}/nvs/clear",
        "direct": "/annieData/{device}/direct/{name}",
    },
    "defaults": {
        "port": 8000,
        "device_name": "bart",
    },
}


@app.route("/api/presets/theater-gwd", methods=["GET"])
def api_theater_gwd_presets():
    return jsonify({"status": "ok", "presets": THEATER_GWD_PRESETS})


def create_app():
    """Create and return the Flask app."""
    return app, socketio

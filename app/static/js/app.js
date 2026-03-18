/* ==============================================
   annieOSC — Frontend Application
   Real-time OSC control via WebSocket + REST API
   ============================================== */

(function () {
  "use strict";

  const MAX_LOG_ENTRIES = 500;

  // ---- Socket.IO connection ----
  const socket = io({ transports: ["websocket", "polling"] });

  // ---- DOM references ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const statusDot = $("#statusDot");
  const statusText = $("#statusText");

  // ---- Connection status ----
  socket.on("connect", () => {
    statusDot.className = "status-dot connected";
    statusText.textContent = "Connected";
  });

  socket.on("disconnect", () => {
    statusDot.className = "status-dot error";
    statusText.textContent = "Disconnected";
  });

  // ---- Tab navigation ----
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      $$(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = $(`#tab-${btn.dataset.tab}`);
      if (panel) panel.classList.add("active");
    });
  });

  // ---- Toast notifications ----
  function toast(msg, type) {
    type = type || "info";
    const container = $("#toastContainer");
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      el.style.transition = "all 0.25s ease-out";
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ---- API helper ----
  function api(endpoint, data) {
    return fetch(`/api/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res.status === "error") {
          toast(res.message, "error");
        }
        return res;
      })
      .catch((err) => {
        toast("Request failed: " + err.message, "error");
        return { status: "error", message: err.message };
      });
  }

  // ---- Log rendering ----
  function renderLogEntry(entry) {
    const div = document.createElement("div");
    div.className = "log-entry";

    const tagClass = {
      send: "log-tag-send",
      recv: "log-tag-recv",
      bridge: "log-tag-bridge",
    };

    const argsStr = entry.args
      .map((a) => {
        if (a.type === "s") return `"${a.value}"`;
        return a.value;
      })
      .join(" ");

    let destInfo = "";
    if (entry.dest) destInfo = ` → ${entry.dest}`;
    if (entry.source && entry.dest)
      destInfo = ` ${entry.source} → ${entry.dest}`;
    else if (entry.source) destInfo = ` ← ${entry.source}`;

    div.innerHTML = [
      `<span class="log-time">${entry.time}</span>`,
      `<span class="log-tag ${tagClass[entry.direction] || "log-tag-error"}">${entry.direction}</span>`,
      `<span class="log-address">${entry.address}</span>`,
      argsStr ? `<span class="log-args">(${argsStr})</span>` : "",
      destInfo ? `<span class="log-dest">${destInfo}</span>` : "",
    ].join("");

    return div;
  }

  function appendToFeed(feedEl, entry, autoScrollCheckbox) {
    feedEl.appendChild(renderLogEntry(entry));
    // Cap entries
    while (feedEl.children.length > MAX_LOG_ENTRIES) {
      feedEl.removeChild(feedEl.firstChild);
    }
    if (autoScrollCheckbox && autoScrollCheckbox.checked) {
      feedEl.scrollTop = feedEl.scrollHeight;
    }
  }

  // ---- Message counter for monitor ----
  let msgCount = 0;
  let msgRate = 0;
  let lastRateCheck = Date.now();
  let rateCounter = 0;

  setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastRateCheck) / 1000;
    if (elapsed > 0) {
      msgRate = Math.round(rateCounter / elapsed);
      rateCounter = 0;
      lastRateCheck = now;
    }
    const countEl = $("#monCount");
    const rateEl = $("#monRate");
    if (countEl) countEl.textContent = `${msgCount} messages`;
    if (rateEl) rateEl.textContent = `${msgRate} msg/s`;
  }, 1000);

  // ---- Real-time message handler ----
  socket.on("osc_message", (entry) => {
    msgCount++;
    rateCounter++;

    // Receive tab feed
    if (entry.direction === "recv") {
      appendToFeed($("#recvFeed"), entry, $("#recvAutoScroll"));
    }

    // Preset tab feed (recv messages for device replies)
    if (entry.direction === "recv") {
      const presetFeed = $("#presetFeed");
      if (presetFeed) {
        appendToFeed(presetFeed, entry, { checked: true });
      }
    }

    // Monitor tab feed (all messages)
    const monFilter = $("#monFilter");
    const filterText = monFilter ? monFilter.value.trim().toLowerCase() : "";
    if (!filterText || entry.address.toLowerCase().includes(filterText)) {
      appendToFeed($("#monFeed"), entry, $("#monAutoScroll"));
    }
  });

  // ==================== SEND TAB ====================

  let sendRepeating = false;

  $("#sendForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      host: $("#sendHost").value,
      port: parseInt($("#sendPort").value, 10),
      address: $("#sendAddress").value,
      args: $("#sendArgs").value || null,
    };
    api("send", data).then((res) => {
      if (res.status === "ok") toast("Message sent", "success");
    });
  });

  $("#btnSendRepeat").addEventListener("click", () => {
    const data = {
      host: $("#sendHost").value,
      port: parseInt($("#sendPort").value, 10),
      address: $("#sendAddress").value,
      args: $("#sendArgs").value || null,
      interval: parseInt($("#sendInterval").value, 10) || 1000,
      id: "send-repeat",
    };
    api("send/repeat", data).then((res) => {
      if (res.status === "ok") {
        sendRepeating = true;
        $("#btnSendRepeat").disabled = true;
        $("#btnSendStop").disabled = false;
        toast("Repeat send started", "info");
      }
    });
  });

  $("#btnSendStop").addEventListener("click", () => {
    api("send/stop", { id: "send-repeat" }).then((res) => {
      if (res.status === "ok") {
        sendRepeating = false;
        $("#btnSendRepeat").disabled = false;
        $("#btnSendStop").disabled = true;
        toast("Repeat send stopped", "info");
      }
    });
  });

  // JSON send
  $("#btnSendJson").addEventListener("click", () => {
    let messages;
    try {
      messages = JSON.parse($("#jsonInput").value);
    } catch (err) {
      toast("Invalid JSON: " + err.message, "error");
      return;
    }
    const data = {
      host: $("#jsonHost").value,
      port: parseInt($("#jsonPort").value, 10),
      messages: messages,
      interval: parseInt($("#jsonInterval").value, 10) || 0,
    };
    api("send/json", data).then((res) => {
      if (res.status === "ok") {
        toast(`Sent ${messages.length} messages`, "success");
      }
    });
  });

  // ==================== RECEIVE TAB ====================

  const activeReceivers = {};

  function updateReceiverList() {
    const list = $("#activeReceivers");
    const items = Object.entries(activeReceivers);
    if (items.length === 0) {
      list.innerHTML =
        '<h3>Active Listeners</h3><div class="list-empty">No active listeners</div>';
      return;
    }
    let html = "<h3>Active Listeners</h3>";
    list.innerHTML = html;
    items.forEach(([id, info]) => {
      const row = document.createElement("div");
      row.className = "active-item";
      const infoEl = document.createElement("div");
      infoEl.className = "active-item-info";
      infoEl.innerHTML = '<span class="active-item-dot"></span>';
      const label = document.createElement("span");
      label.textContent = `Port ${info.port}${info.filter ? ` (filter: ${info.filter})` : ""}`;
      infoEl.appendChild(label);
      const btn = document.createElement("button");
      btn.className = "btn btn-small btn-stop";
      btn.textContent = "Stop";
      btn.addEventListener("click", () => stopReceiver(id));
      row.appendChild(infoEl);
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function stopReceiver(id) {
    api("recv/stop", { id: id }).then((res) => {
      if (res.status === "ok") {
        delete activeReceivers[id];
        updateReceiverList();
        toast("Listener stopped", "info");
        if (Object.keys(activeReceivers).length === 0) {
          $("#btnRecvStop").disabled = true;
        }
      }
    });
  }

  $("#recvForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const port = parseInt($("#recvPort").value, 10);
    const filter = $("#recvFilter").value;
    const id = `recv-${port}`;
    api("recv/start", { port: port, filter: filter, id: id }).then((res) => {
      if (res.status === "ok") {
        activeReceivers[id] = { port: port, filter: filter };
        updateReceiverList();
        $("#btnRecvStop").disabled = false;
        toast(`Listening on port ${port}`, "success");
      }
    });
  });

  $("#btnRecvStop").addEventListener("click", () => {
    Object.keys(activeReceivers).forEach((id) => stopReceiver(id));
  });

  $("#btnRecvClear").addEventListener("click", () => {
    $("#recvFeed").innerHTML = "";
  });

  // ==================== BRIDGE TAB ====================

  const activeBridges = {};

  function updateBridgeList() {
    const list = $("#activeBridges");
    const items = Object.entries(activeBridges);
    if (items.length === 0) {
      list.innerHTML =
        '<h3>Active Bridges</h3><div class="list-empty">No active bridges</div>';
      return;
    }
    let html = "<h3>Active Bridges</h3>";
    list.innerHTML = html;
    items.forEach(([id, info]) => {
      const row = document.createElement("div");
      row.className = "active-item";
      const infoEl = document.createElement("div");
      infoEl.className = "active-item-info";
      infoEl.innerHTML = '<span class="active-item-dot"></span>';
      const label = document.createElement("span");
      label.textContent = `:${info.in_port} → ${info.out_host}:${info.out_port}${info.filter ? ` (${info.filter})` : ""}`;
      infoEl.appendChild(label);
      const btn = document.createElement("button");
      btn.className = "btn btn-small btn-stop";
      btn.textContent = "Stop";
      btn.addEventListener("click", () => stopBridge(id));
      row.appendChild(infoEl);
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  function stopBridge(id) {
    api("bridge/stop", { id: id }).then((res) => {
      if (res.status === "ok") {
        delete activeBridges[id];
        updateBridgeList();
        toast("Bridge stopped", "info");
        if (Object.keys(activeBridges).length === 0) {
          $("#btnBridgeStop").disabled = true;
        }
      }
    });
  }

  $("#bridgeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const inPort = parseInt($("#bridgeInPort").value, 10);
    const outHost = $("#bridgeOutHost").value;
    const outPort = parseInt($("#bridgeOutPort").value, 10);
    const filter = $("#bridgeFilter").value;
    const id = `bridge-${inPort}-${outPort}`;
    api("bridge/start", {
      in_port: inPort,
      out_host: outHost,
      out_port: outPort,
      filter: filter,
      id: id,
    }).then((res) => {
      if (res.status === "ok") {
        activeBridges[id] = {
          in_port: inPort,
          out_host: outHost,
          out_port: outPort,
          filter: filter,
        };
        updateBridgeList();
        $("#btnBridgeStop").disabled = false;
        toast(`Bridge started: :${inPort} → ${outHost}:${outPort}`, "success");
      }
    });
  });

  $("#btnBridgeStop").addEventListener("click", () => {
    Object.keys(activeBridges).forEach((id) => stopBridge(id));
  });

  // ==================== THEATERGWD PRESETS TAB ====================

  function presetAddress(template) {
    const device = $("#presetDevice").value || "bart";
    const patchName = $("#presetPatchName") ? $("#presetPatchName").value : "";
    return template
      .replace("{device}", device)
      .replace("{name}", patchName);
  }

  // Quick command buttons
  $$(".btn-preset[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      const presets = {
        blackout: "/annieData/{device}/blackout",
        restore: "/annieData/{device}/restore",
        save: "/annieData/{device}/save",
        load: "/annieData/{device}/load",
        status_config: "/annieData/{device}/status/config",
        nvs_clear: "/annieData/{device}/nvs/clear",
        list_messages: "/annieData/{device}/list/msgs",
        list_patches: "/annieData/{device}/list/patches",
        list_all: "/annieData/{device}/list/all",
        start_patch: "/annieData/{device}/patch/{name}/start",
        stop_patch: "/annieData/{device}/patch/{name}/stop",
      };

      const template = presets[cmd];
      if (!template) return;

      const address = presetAddress(template);
      const host = $("#presetHost").value;
      const port = parseInt($("#presetPort").value, 10);

      api("send", { host: host, port: port, address: address }).then((res) => {
        if (res.status === "ok") toast(`Sent: ${address}`, "success");
      });
    });
  });

  // Create message
  $("#btnPresetCreateMsg").addEventListener("click", () => {
    const device = $("#presetDevice").value || "bart";
    const msgName = $("#presetMsgName").value || "accelX";
    const sensorVal = $("#presetMsgValue").value;
    const targetIP = $("#presetMsgTargetIP").value;
    const targetPort = $("#presetMsgTargetPort").value;
    const targetAddr = $("#presetMsgTargetAddr").value;
    const host = $("#presetHost").value;
    const port = parseInt($("#presetPort").value, 10);

    const address = `/annieData/${device}/msg/${msgName}`;
    const payload = `value:${sensorVal}, ip:${targetIP}, port:${targetPort}, adr:${targetAddr}`;

    api("send", {
      host: host,
      port: port,
      address: address,
      args: payload,
    }).then((res) => {
      if (res.status === "ok")
        toast(`Created message: ${msgName}`, "success");
    });
  });

  // Config string builder — update preview when fields change
  function updateCfgPreview() {
    var parts = [];
    var val = $("#cfgValue") ? $("#cfgValue").value : "";
    var ip = $("#cfgIP") ? $("#cfgIP").value : "";
    var port = $("#cfgPort") ? $("#cfgPort").value : "";
    var adr = $("#cfgAdr") ? $("#cfgAdr").value : "";
    var low = $("#cfgLow") ? $("#cfgLow").value.trim() : "";
    var high = $("#cfgHigh") ? $("#cfgHigh").value.trim() : "";
    var patchField = $("#cfgPatch") ? $("#cfgPatch").value.trim() : "";
    var period = $("#cfgPeriod") ? $("#cfgPeriod").value.trim() : "";
    if (val) parts.push("value:" + val);
    if (ip) parts.push("ip:" + ip);
    if (port) parts.push("port:" + port);
    if (adr) parts.push("adr:" + adr);
    if (low) parts.push("low:" + low);
    if (high) parts.push("high:" + high);
    if (patchField) parts.push("patch:" + patchField);
    if (period) parts.push("period:" + period);
    var preview = $("#cfgPreview");
    if (preview) preview.value = parts.join(", ");
  }

  ["cfgValue", "cfgIP", "cfgPort", "cfgAdr", "cfgLow", "cfgHigh", "cfgPatch", "cfgPeriod"].forEach(function (id) {
    var el = $("#" + id);
    if (el) el.addEventListener("input", updateCfgPreview);
    if (el) el.addEventListener("change", updateCfgPreview);
  });

  updateCfgPreview();

  // Direct send via config builder
  $("#btnCfgDirect").addEventListener("click", () => {
    const device = $("#presetDevice").value || "bart";
    const name = $("#cfgDirectName").value || "quickSend";
    const payload = $("#cfgPreview").value;
    const host = $("#presetHost").value;
    const port = parseInt($("#presetPort").value, 10);

    const address = `/annieData/${device}/direct/${name}`;

    api("send", {
      host: host,
      port: port,
      address: address,
      args: payload || null,
    }).then((res) => {
      if (res.status === "ok") toast(`Direct sent: ${name}`, "success");
    });
  });

  // Create Message via config builder
  $("#btnCfgCreateMsg").addEventListener("click", () => {
    const device = $("#presetDevice").value || "bart";
    const name = $("#cfgDirectName").value || "quickSend";
    const payload = $("#cfgPreview").value;
    const host = $("#presetHost").value;
    const port = parseInt($("#presetPort").value, 10);

    const address = `/annieData/${device}/msg/${name}`;

    api("send", {
      host: host,
      port: port,
      address: address,
      args: payload || null,
    }).then((res) => {
      if (res.status === "ok") toast(`Created message: ${name}`, "success");
    });
  });

  // Copy config string
  $("#btnCfgCopy").addEventListener("click", () => {
    const text = $("#cfgPreview").value;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        toast("Config string copied", "success");
      });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast("Config string copied", "success");
    }
  });

  // Preset listen
  let presetListening = false;

  $("#btnPresetListen").addEventListener("click", () => {
    const port = parseInt($("#presetListenPort").value, 10);
    const device = $("#presetDevice").value || "bart";
    api("recv/start", {
      port: port,
      filter: `/reply/${device}`,
      id: `preset-recv-${port}`,
    }).then((res) => {
      if (res.status === "ok") {
        presetListening = true;
        $("#btnPresetListen").disabled = true;
        $("#btnPresetListenStop").disabled = false;
        toast(`Listening for /reply/${device}/ on port ${port}`, "success");
      }
    });
  });

  $("#btnPresetListenStop").addEventListener("click", () => {
    const port = parseInt($("#presetListenPort").value, 10);
    api("recv/stop", { id: `preset-recv-${port}` }).then((res) => {
      if (res.status === "ok") {
        presetListening = false;
        $("#btnPresetListen").disabled = false;
        $("#btnPresetListenStop").disabled = true;
        toast("Preset listener stopped", "info");
      }
    });
  });

  // Keywords & Definitions reference
  fetch("/api/presets/theater-gwd")
    .then((r) => r.json())
    .then((data) => {
      if (data.presets && data.presets.keywords) {
        renderKeywords(data.presets.keywords);
      }
    })
    .catch(() => {});

  function renderKeywords(keywords) {
    const list = $("#keywordList");
    if (!list) return;
    var entries = Object.entries(keywords).sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });
    list.innerHTML = "";
    entries.forEach(function (pair) {
      var div = document.createElement("div");
      div.className = "keyword-item";
      div.innerHTML =
        '<span class="keyword-term">' + pair[0] + "</span>" +
        '<span class="keyword-def">' + pair[1] + "</span>";
      list.appendChild(div);
    });

    // Search/filter
    var search = $("#keywordSearch");
    if (search) {
      search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase();
        var items = list.querySelectorAll(".keyword-item");
        items.forEach(function (item) {
          var text = item.textContent.toLowerCase();
          item.style.display = text.includes(q) ? "" : "none";
        });
      });
    }
  }

  // ==================== MONITOR TAB ====================

  $("#btnMonClear").addEventListener("click", () => {
    $("#monFeed").innerHTML = "";
    msgCount = 0;
    rateCounter = 0;
    api("log/clear", {});
  });

  // Load existing log on page load
  fetch("/api/log")
    .then((r) => r.json())
    .then((data) => {
      if (data.log) {
        data.log.forEach((entry) => {
          appendToFeed($("#monFeed"), entry, $("#monAutoScroll"));
          msgCount++;
        });
      }
    })
    .catch(() => {});

  // Fetch initial status
  fetch("/api/status")
    .then((r) => r.json())
    .then((data) => {
      // Restore active receivers
      if (data.receivers) {
        Object.entries(data.receivers).forEach(([id, info]) => {
          activeReceivers[id] = info;
        });
        updateReceiverList();
        if (Object.keys(data.receivers).length > 0) {
          $("#btnRecvStop").disabled = false;
        }
      }
      // Restore active bridges
      if (data.bridges) {
        Object.entries(data.bridges).forEach(([id, info]) => {
          activeBridges[id] = info;
        });
        updateBridgeList();
        if (Object.keys(data.bridges).length > 0) {
          $("#btnBridgeStop").disabled = false;
        }
      }
    })
    .catch(() => {});
})();

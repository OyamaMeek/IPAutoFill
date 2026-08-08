#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "IPAutoFill 无法启动" message "未检测到 Node.js。请先安装 Node.js 18 或更高版本。" as critical'
  exit 1
fi

if curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then
  open http://127.0.0.1:3000/
  exit 0
fi

node server.js > /tmp/ipautofill.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then
    open http://127.0.0.1:3000/
    exit 0
  fi
  sleep 0.25
done

kill "$SERVER_PID" 2>/dev/null || true
osascript -e 'display alert "IPAutoFill 启动失败" message "请检查 /tmp/ipautofill.log。" as critical'
exit 1
